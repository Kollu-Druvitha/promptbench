import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import { mistral } from "@ai-sdk/mistral";
import { TestResult } from "@/lib/types";

// -----------------------------------------------------------------------
// Model router: given a model id, calls the right provider and returns
// a normalized result. This is the ONE place that knows about provider
// specifics — everything else in the app just deals with TestResult.
// -----------------------------------------------------------------------

// NOTE: Groq deprecated llama-3.3-70b-versatile and llama-3.1-8b-instant
// on June 17, 2026. Both now route to Groq's recommended replacement,
// openai/gpt-oss-20b (still free tier). The internal modelId strings
// ("llama-3.3-70b" etc.) are kept as-is so nothing else in the app needs
// to change — only this file maps them to a real, currently-live model.
const PRICING_PER_1K_TOKENS: Record<string, number> = {
  "gemini-2.0-flash": 0,
  "gemini-2.5-flash": 0,
  "llama-3.3-70b": 0,
  "llama-3.1-8b": 0,
  "mistral-small": 0,
  "gpt-4-turbo": 0.01,
  "claude-3-opus": 0.015,
};

function getModel(modelId: string) {
  switch (modelId) {
    case "gemini-2.0-flash":
    case "gemini-2.5-flash":
      return google("gemini-2.0-flash");
    case "llama-3.3-70b":
      return groq("openai/gpt-oss-20b");
    case "llama-3.1-8b":
      return groq("openai/gpt-oss-20b");
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
      qualityScore: 0,
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