import { NextRequest, NextResponse } from "next/server";
import { callModel, isModelError, MODEL_DISPLAY } from "@/lib/server/models";
import { evaluateResponse } from "@/lib/server/evaluator";
import { saveTest } from "@/lib/server/db";
import { withBadges } from "@/lib/badges";
import { TestRecord, TestResult, TestType } from "@/lib/types";

export async function POST(req: NextRequest) {
  let body: { prompt?: string; testType?: TestType; modelIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { prompt, testType, modelIds } = body;

  if (!prompt || !prompt.trim()) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }
  if (!testType) {
    return NextResponse.json({ error: "testType is required" }, { status: 400 });
  }
  if (!modelIds || modelIds.length === 0) {
    return NextResponse.json(
      { error: "At least one modelId is required" },
      { status: 400 }
    );
  }

  // Call every selected model in parallel. Promise.allSettled means one
  // provider failing (bad key, rate limit, network) doesn't kill the others.
  const callResults = await Promise.allSettled(
    modelIds.map((id) => callModel(id, prompt))
  );

  const results: TestResult[] = [];
  const errors: { modelId: string; error: string }[] = [];

  for (let i = 0; i < callResults.length; i++) {
    const outcome = callResults[i];
    const modelId = modelIds[i];

    if (outcome.status === "fulfilled" && !isModelError(outcome.value)) {
      results.push(outcome.value);
    } else {
      const errMessage =
        outcome.status === "rejected"
          ? String(outcome.reason)
          : (outcome.value as { error: string }).error;
      errors.push({ modelId, error: errMessage });
      const display = MODEL_DISPLAY[modelId] ?? {
        name: modelId,
        provider: "AI Provider",
      };
      results.push({
        modelId,
        modelName: display.name,
        modelVersion: modelId,
        provider: display.provider,
        responseText: `⚠️ Model Call Failed: ${errMessage}\n\nNote: If using Google Gemini, make sure your .env.local file contains a valid GOOGLE_GENERATIVE_AI_API_KEY from https://aistudio.google.com/apikey`,
        qualityScore: 0,
        tokens: 0,
        latencyMs: 0,
        costUsd: 0,
      });
    }
  }

  if (results.length === 0) {
    return NextResponse.json(
      {
        error: "All model calls failed",
        details: errors,
      },
      { status: 502 }
    );
  }

  // Evaluate each successful response (also in parallel).
  const evaluated = await Promise.all(
    results.map(async (r) => {
      const { qualityScore } = await evaluateResponse(testType, prompt, r.responseText);
      return { ...r, qualityScore };
    })
  );

  const withScores = withBadges(evaluated);

  const testId = `eval-${Date.now().toString(36)}`;
  const record: TestRecord = {
    testId,
    date: new Date().toISOString(),
    prompt,
    testType,
    modelsUsed: withScores.map((r) => r.modelId),
    results: withScores,
    bestModel:
      withScores.find((r) => r.isBestQuality)?.modelId ?? withScores[0].modelId,
    totalCost: withScores.reduce((sum, r) => sum + r.costUsd, 0),
  };

  saveTest(record);

  return NextResponse.json({
    testId,
    // Surface partial failures so the frontend/README-checker can see
    // which model(s) didn't return, without failing the whole request.
    partialErrors: errors.length > 0 ? errors : undefined,
  });
}

export async function GET() {
  const { listTests } = await import("@/lib/server/db");
  return NextResponse.json(listTests());
}
