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

async function callJudge(prompt: string): Promise<string> {
  try {
    const res = await generateText({ model: groq(JUDGE_MODEL_ID), prompt });
    return res.text;
  } catch {
    const res = await generateText({ model: google("gemini-2.0-flash"), prompt });
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

Original prompt given to the assistant:
"""
${originalPrompt}
"""

Assistant's response:
"""
${modelOutput}
"""

Score the response from 0 to 10 based on the grading criteria (10 = fully meets the criteria, 0 = completely fails it).
Respond with ONLY a JSON object, no other text, in this exact shape:
{"score": <number 0-10>, "reason": "<one sentence explaining the score>", "pass": <true if score >= 6, else false>}`;

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