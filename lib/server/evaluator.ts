import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import { TestType, FactualityCategory } from "@/lib/types";

const JUDGE_MODEL_ID = "openai/gpt-oss-20b";

const RUBRIC_BY_TYPE: Record<TestType, string> = {
  qa: "The response directly and correctly answers the question asked, is factually plausible, and is not evasive or padded with irrelevant content.",
  coding:
    "The code is syntactically correct, solves the stated problem, handles reasonable edge cases, and follows common best practices for its language.",
  summarization:
    "The summary captures the key points of the source material accurately, is meaningfully shorter than a full response would be, and does not introduce claims not supported by typical source material for this kind of prompt.",
  rag: "The response is well-grounded and plausible. (No context file was supplied for this RAG test, so grade for reasonableness and hedging on uncertain claims.)",
};

interface JudgeOutput { score: number; reason: string; pass: boolean; }

function extractJson(text: string): JudgeOutput | null {
  const cleaned = text.replace(/```json|```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed.score === "number" && typeof parsed.reason === "string") {
      return { score: parsed.score, reason: parsed.reason, pass: Boolean(parsed.pass) };
    }
    return null;
  } catch { return null; }
}

export async function callJudge(prompt: string): Promise<string> {
  try {
    const res = await generateText({
      model: groq(JUDGE_MODEL_ID),
      prompt,
      maxOutputTokens: 512,
    });
    return res.text;
  } catch {
    // Fallback: older Gemini Flash models are shut down — use current 3.6.
    const res = await generateText({
      model: google("gemini-3.6-flash"),
      prompt,
      maxOutputTokens: 512,
    });
    return res.text;
  }
}

export async function evaluateResponse(
  testType: TestType,
  originalPrompt: string,
  modelOutput: string,
  context?: string
): Promise<{ qualityScore: number; reason: string }> {
  const isGroundedRag = testType === "rag" && !!context;
  const rubric = isGroundedRag
    ? "The response must be firmly grounded in the provided context. It must NOT invent, extrapolate, or assert facts missing from the context; it should hedge or say it doesn't know when the context lacks the answer; and it should use the context's information accurately."
    : RUBRIC_BY_TYPE[testType];

  const contextBlock = isGroundedRag
    ? `Retrieved context the assistant was given:\n"""\n${context}\n"""\n\n`
    : "";

  const judgePrompt = `You are grading an AI assistant's response.

${contextBlock}Grading criteria: ${rubric}

${isGroundedRag
    ? "Because this is a grounded RAG test, your reason MUST state whether the response is fully supported by the retrieved context (and which passage it used) or what the response fabricated / asserted without support, e.g. \"Fully supported by retrieved passage 2\" or \"Fabricated a detail not present in the context.\"\n\n"
    : ""}Original prompt given to the assistant:
"""
${originalPrompt}
"""

Assistant's response:
"""
${modelOutput}
"""

Score the response from 0 to 10 based on the grading criteria (10 = fully meets the criteria, 0 = completely fails it).
Respond with ONLY a JSON object, no other text, in this exact shape:
{"score": <number 0-10>, "reason": "<1-2 sentences explaining the score with concrete evidence from the response>", "pass": <true if score >= 6, else false>}`;

  try {
    const resultText = await callJudge(judgePrompt);
    const parsed = extractJson(resultText);
    if (parsed) {
      return { qualityScore: Math.max(0, Math.min(10, parsed.score)), reason: parsed.reason };
    }
    return { qualityScore: 5, reason: "Evaluator response could not be parsed; default score applied." };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { qualityScore: 0, reason: `Evaluation failed: ${message}` };
  }
}

interface FactualityJudgeOutput { category: FactualityCategory; reason: string; }

function extractFactualityJson(text: string): FactualityJudgeOutput | null {
  const cleaned = text.replace(/```json|```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    const category = String(parsed.category).toUpperCase().trim();
    if (["A", "B", "C", "D", "E"].includes(category) && typeof parsed.reason === "string") {
      return { category: category as FactualityCategory, reason: parsed.reason };
    }
    return null;
  } catch { return null; }
}

export async function evaluateFactuality(
  question: string,
  reference: string,
  modelOutput: string
): Promise<{ category: FactualityCategory; pass: boolean; reason: string }> {
  const judgePrompt = `You are comparing an AI assistant's answer to a known-correct reference answer.

Question: "${question}"
Reference (known correct) answer: "${reference}"
Assistant's answer: "${modelOutput}"

Classify the relationship between the assistant's answer and the reference answer. Choose exactly one:
(A) Assistant's answer is a subset of the reference — less detail, but consistent, no contradictions
(B) Assistant's answer is a superset of the reference — more detail, but consistent, no contradictions
(C) Assistant's answer and the reference are essentially equivalent
(D) Assistant's answer and the reference disagree / contradict each other
(E) Assistant's answer differs in some way, but the difference doesn't affect factual correctness (e.g. rounding, phrasing)

Respond with ONLY a JSON object, no other text:
{"category": "A"|"B"|"C"|"D"|"E", "reason": "<one sentence explaining your choice>"}`;

  try {
    const resultText = await callJudge(judgePrompt);
    const parsed = extractFactualityJson(resultText);
    if (parsed) {
      const pass = parsed.category !== "D";
      return { category: parsed.category, pass, reason: parsed.reason };
    }
    return { category: "E", pass: false, reason: "Judge response could not be parsed; treated as fail for safety." };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { category: "D", pass: false, reason: `Evaluation failed: ${message}` };
  }
}

// ---------------------------------------------------------------------------
// Batch-evaluation judge metrics (RAGAS-style). Kept here with the rest of the
// judge logic so they share `callJudge` and its Groq→Gemini fallback, and so
// lib/server/metrics.ts (the deterministic metrics) stays free of AI-SDK
// imports and fully unit-testable offline.
// ---------------------------------------------------------------------------

function extractScoreJson(text: string): number | null {
  const cleaned = text.replace(/```json|```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    const score = Number(parsed.score ?? parsed.faithfulness);
    if (Number.isFinite(score)) return Math.max(0, Math.min(1, score));
  } catch {
    // fall through
  }
  // Some judges answer with a bare 0..1 number.
  const bare = cleaned.match(/^\s*(\d(?:\.\d+)?)\s*$/);
  if (bare) {
    const n = Number(bare[1]);
    if (Number.isFinite(n)) return Math.max(0, Math.min(1, n));
  }
  return null;
}

/**
 * RAGAS-style faithfulness: the judge splits the answer into claims and counts
 * how many are supported by the provided context. Faithfulness = supported /
 * total. An answer with no extractable claims scores 1.0 (nothing to be
 * unfaithful to).
 */
export async function evaluateFaithfulness(
  question: string,
  context: string,
  answer: string
): Promise<{ score: number; note: string }> {
  const prompt = `You are evaluating an AI assistant's answer for faithfulness to a provided context.

Context:
"""
${context}
"""

Question: "${question}"

Assistant's answer:
"""
${answer}
"""

Steps:
1. List the factual claims the assistant makes in its answer.
2. Mark each claim as SUPPORTED (directly supported by the context) or UNSUPPORTED (not in the context, or contradicts it).
3. faithfulness = supported_claims / total_claims.

Respond with ONLY a JSON object:
{"supported_claims": <number>, "total_claims": <number>, "score": <0..1>, "reason": "<one sentence, e.g. '2 of 3 claims supported; invented the missing statistic'>"}`;

  try {
    const text = await callJudge(prompt);
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    const total = Number(parsed.total_claims ?? parsed.total);
    const supported = Number(parsed.supported_claims ?? parsed.supported);
    if (Number.isFinite(total) && total > 0) {
      const score = Math.max(0, Math.min(1, supported / total));
      return {
        score,
        note: String(parsed.reason ?? `${supported}/${total} claims supported`),
      };
    }
    if (Number.isFinite(total) && total === 0) {
      return { score: 1, note: "Answer made no extractable claims." };
    }
    const score = extractScoreJson(text);
    if (score !== null) {
      return { score, note: String(parsed?.reason ?? "Judge score") };
    }
    return { score: 0, note: "Could not parse faithfulness output." };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { score: 0, note: `Faithfulness evaluation failed: ${message}` };
  }
}

/**
 * RAGAS-style answer relevance: how directly does the answer address the
 * question, regardless of factual correctness? 0..1.
 */
export async function evaluateAnswerRelevance(
  question: string,
  answer: string
): Promise<{ score: number; note: string }> {
  const prompt = `You are evaluating whether an AI assistant's answer is relevant to the question asked.

Question: "${question}"

Assistant's answer:
"""
${answer}
"""

Score the answer's relevance to the question from 0 to 1:
- 1.0 = directly and fully addresses what was asked.
- 0.5 = partially addresses it (tangential, or answers a related but different question).
- 0.0 = completely off-topic.

Respond with ONLY a JSON object:
{"score": <0..1>, "reason": "<one sentence explaining the score>"}`;

  try {
    const text = await callJudge(prompt);
    const score = extractScoreJson(text);
    if (score !== null) {
      let note = "Judge score";
      try {
        const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
        if (parsed && typeof parsed.reason === "string") note = parsed.reason;
      } catch {
        // bare number — no reason available
      }
      return { score, note };
    }
    return { score: 0, note: "Could not parse relevance output." };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { score: 0, note: `Relevance evaluation failed: ${message}` };
  }
}