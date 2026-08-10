import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import { TestType } from "@/lib/types";

// -----------------------------------------------------------------------
// Evaluator: scores a model's response using a second LLM call ("judge").
// The judge is Groq's Llama 3.3 70B (free + reliable), with Gemini as a
// fallback. IMPORTANT: do NOT make the judge a model being evaluated, and
// keep it on Groq — if the judge itself is unreliable it silently corrupts
// every score, not just one model's results.
//
// Honest scope note: this is a general-purpose quality rubric grader,
// adapted per test type (modeled on promptfoo's grading approach — see
// the "llm-rubric" pattern). It is NOT a full factuality/hallucination
// checker (that requires a ground-truth reference answer). RAG tests that
// supply a context file are graded for groundedness against the ACTUAL
// retrieved context (see the `context` parameter below); RAG tests without
// a context file fall back to plausibility grading.
// -----------------------------------------------------------------------

const RUBRIC_BY_TYPE: Record<TestType, string> = {
  qa: "The response directly and correctly answers the question asked, is factually plausible, and is not evasive or padded with irrelevant content.",
  coding:
    "The code is syntactically correct, solves the stated problem, handles reasonable edge cases, and follows common best practices for its language.",
  summarization:
    "The summary captures the key points of the source material accurately, is meaningfully shorter than a full response would be, and does not introduce claims not supported by typical source material for this kind of prompt.",
  rag: "The response is well-grounded and plausible. (No context file was supplied for this RAG test, so grade for reasonableness and hedging on uncertain claims.)",
};

interface JudgeOutput {
  score: number;
  reason: string;
  pass: boolean;
}

function extractJson(text: string): JudgeOutput | null {
  // Judge models sometimes wrap JSON in ```json fences despite instructions.
  const cleaned = text.replace(/```json|```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (
      typeof parsed.score === "number" &&
      typeof parsed.reason === "string"
    ) {
      return {
        score: parsed.score,
        reason: parsed.reason,
        pass: Boolean(parsed.pass),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function evaluateResponse(
  testType: TestType,
  originalPrompt: string,
  modelOutput: string,
  context?: string
): Promise<{ qualityScore: number; reason: string }> {
  // RAG with a real context file: grade groundedness against the actual
  // retrieved context instead of general plausibility.
  const isGroundedRag = testType === "rag" && !!context;
  const rubric = isGroundedRag
    ? "The response must be firmly grounded in the provided context. It must NOT invent, extrapolate, or assert facts missing from the context; it should hedge or say it doesn't know when the context lacks the answer; and it should use the context's information accurately."
    : RUBRIC_BY_TYPE[testType];

  const contextBlock = isGroundedRag
    ? `Retrieved context the assistant was given:\n\"\"\"\n${context}\n\"\"\"\n\n`
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
  let resultText = "";
  try {
    const res = await generateText({
      model: groq("llama-3.3-70b-versatile"),
      prompt: judgePrompt,
    });
    resultText = res.text;
  } catch {
    const res = await generateText({
      model: google("gemini-2.0-flash"),
      prompt: judgePrompt,
    });
    resultText = res.text;
  }
  

    const parsed = extractJson(resultText);
    if (parsed) {
      return { qualityScore: Math.max(0, Math.min(10, parsed.score)), reason: parsed.reason };
    }
    // Judge didn't return valid JSON — don't fail the whole test, just
    // fall back to a neutral score with a visible reason.
    return {
      qualityScore: 5,
      reason: "Evaluator response could not be parsed; default score applied.",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      qualityScore: 0,
      reason: `Evaluation failed: ${message}`,
    };
  }
}
