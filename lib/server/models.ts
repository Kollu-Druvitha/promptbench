import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import { mistral } from "@ai-sdk/mistral";
import { TestResult } from "@/lib/types";

// -----------------------------------------------------------------------
// Model router: given a model id, calls the right provider and returns
// a normalized result. This is the ONE place that knows about provider
// specifics — everything else in the app just deals with TestResult.
//
// To add a new model later (e.g. once you enable GPT-4/Claude):
//   1. `npm install @ai-sdk/openai` (or whichever provider)
//   2. Add a case below
//   3. Flip `enabled: true` in lib/availableModels.ts
// -----------------------------------------------------------------------

// Both Gemini and Groq have free tiers — cost is $0 for these.
// Pricing stubs are here so paid models can be added later without
// restructuring this function.
const PRICING_PER_1K_TOKENS: Record<string, number> = {
  "gemini-2.0-flash": 0,
  "gemini-2.5-flash": 0,
  "llama-3.3-70b": 0,
  "llama-3.1-8b": 0,
  "mistral-small": 0, // free tier on Mistral's Experiment (no-credit-card) plan
  "gpt-4-turbo": 0.01,
  "claude-3-opus": 0.015,
};

function getModel(modelId: string) {
  switch (modelId) {
    case "gemini-2.0-flash":
    case "gemini-2.5-flash":
      return google("gemini-2.0-flash");
    case "llama-3.3-70b":
      return groq("llama-3.3-70b-versatile");
    case "llama-3.1-8b":
      return groq("llama-3.1-8b-instant");
    case "mistral-small":
      return mistral("mistral-small-latest");
    default:
      throw new Error(
        `Model "${modelId}" is not wired up yet. Check lib/server/models.ts.`
      );
  }
}

export const MODEL_DISPLAY: Record<string, { name: string; provider: string }> = {
  "gemini-2.0-flash": { name: "Gemini 2.0 Flash", provider: "Google" },
  "gemini-2.5-flash": { name: "Gemini 2.0 Flash", provider: "Google" },
  "llama-3.3-70b": { name: "Llama 3.3 70B", provider: "Groq" },
  "llama-3.1-8b": { name: "Llama 3.1 8B", provider: "Groq" },
  "mistral-small": { name: "Mistral Small", provider: "Mistral" },
};

export interface ModelCallError {
  modelId: string;
  error: string;
}

export async function callModel(
  modelId: string,
  prompt: string
): Promise<TestResult | ModelCallError> {
  const display = MODEL_DISPLAY[modelId];
  if (!display) {
    return { modelId, error: `Unknown model id "${modelId}"` };
  }

  const start = Date.now();
  try {
    const model = getModel(modelId);
    const result = await generateText({ model, prompt });
    const latencyMs = Date.now() - start;

    const totalTokens =
      result.usage.totalTokens ??
      (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0);

    const pricePer1k = PRICING_PER_1K_TOKENS[modelId] ?? 0;
    const costUsd = (totalTokens / 1000) * pricePer1k;

    return {
      modelId,
      modelName: display.name,
      modelVersion: modelId,
      provider: display.provider,
      responseText: result.text,
      qualityScore: 0, // filled in by the evaluator afterward
      tokens: totalTokens,
      latencyMs,
      costUsd,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { modelId, error: message };
  }
}

export function isModelError(
  result: TestResult | ModelCallError
): result is ModelCallError {
  return "error" in result;
}
