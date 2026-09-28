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

// NOTE: As of Aug 2026, Groq no longer hosts any Llama chat models; Gemini
// 2.0 Flash and 2.5 Flash are shut down. This file maps the app's stable
// internal ids to *currently-live* models so the UI stays honest (the ids
// are kept as-is so stored history + UI dot colors keep working):
//   - "llama-3.3-70b"  -> openai/gpt-oss-120b  (Groq flagship, best quality)
//   - "llama-3.1-8b"   -> openai/gpt-oss-20b   (Groq fast/cheap workhorse)
//   - "gemini-2.0-flash" -> gemini-3.6-flash   (current Flash generation)
//   - "gemini-2.5-flash" -> gemini-3.6-flash
//
// Pricing is per 1,000,000 tokens (the unit providers actually quote).
// Free/zero rows are genuinely free-tier; paid rows (gpt-4, claude-3) stay
// scaffolded and disabled until wired up.
const PRICING_PER_1M_TOKENS: Record<string, number> = {
  "gemini-2.0-flash": 0,
  "gemini-2.5-flash": 0,
  "llama-3.3-70b": 0.6, // gpt-oss-120b @ $0.60 / 1M out
  "llama-3.1-8b": 0.3, // gpt-oss-20b @ $0.30 / 1M out
  "mistral-small": 0,
  "gpt-4-turbo": 10,
  "claude-3-opus": 15,
};

function getModel(modelId: string) {
  switch (modelId) {
    case "gemini-2.0-flash":
    case "gemini-2.5-flash":
      return google("gemini-3.6-flash");
    case "llama-3.3-70b":
      return groq("openai/gpt-oss-120b");
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
  "gemini-2.0-flash": { name: "Gemini 3.6 Flash", provider: "Google" },
  "gemini-2.5-flash": { name: "Gemini 3.6 Flash", provider: "Google" },
  "llama-3.3-70b": { name: "GPT-OSS 120B", provider: "Groq" },
  "llama-3.1-8b": { name: "GPT-OSS 20B", provider: "Groq" },
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
    // Cap output length: unbounded generation is the #1 cause of the
    // "long to respond" feeling — verbosity cost grows linearly while
    // value doesn't. A 2048-token cap bounds worst-case wall time.
    const result = await generateText({
      model,
      prompt,
      maxOutputTokens: 2048,
    });
    const latencyMs = Date.now() - start;

    const totalTokens =
      result.usage.totalTokens ??
      (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0);

    const pricePer1M = PRICING_PER_1M_TOKENS[modelId] ?? 0;
    const costUsd = (totalTokens / 1_000_000) * pricePer1M;

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