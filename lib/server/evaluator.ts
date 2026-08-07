import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import { TestType } from "@/lib/types";

// -----------------------------------------------------------------------
// Evaluator: scores a model's response using a second LLM call ("judge").
// We use Gemini 2.5 Flash as the judge since it's free — this means
// evaluation costs nothing, same as the models being tested.
//
// Honest scope note: this is a general-purpose quality rubric grader,
// adapted per test type (modeled on promptfoo's grading approach — see
// the "llm-rubric" pattern). It is NOT a full factuality/hallucination
// checker in the strict sense (that requires a ground-truth reference
// answer to compare against, which this MVP doesn't collect yet — see
// README "What's deferred"). For RAG specifically, once you add context
// file parsing, extend this prompt to check the response against the
// actual retrieved context rather than general plausibility.
// -----------------------------------------------------------------------

const RUBRIC_BY_TYPE: Record<TestType, string> = {
  qa: "The response directly and correctly answers the question asked, is factually plausible, and is not evasive or padded with irrelevant content.",
  coding:
    "The code is syntactically correct, solves the stated problem, handles reasonable edge cases, and follows common best practices for its language.",
  summarization:
    "The summary captures the key points of the source material accurately, is meaningfully shorter than a full response would be, and does not introduce claims not supported by typical source material for this kind of prompt.",
  rag: "The response is well-grounded, avoids confidently stating unverifiable specifics, and would be an appropriate answer if backed by retrieved context (no context was supplied to verify against in this MVP — grade for plausibility and hedging on uncertain claims).",
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
  modelOutput: string
): Promise<{ qualityScore: number; reason: string }> {
  const rubric = RUBRIC_BY_TYPE[testType];

  const judgePrompt = `You are grading an AI assistant's response.

Grading criteria: ${rubric}

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
