import { NextRequest, NextResponse } from "next/server";
import { callModel, isModelError } from "@/lib/server/models";
import { evaluateResponse } from "@/lib/server/evaluator";
import {
  ComparisonMetric,
  PromptComparisonResult,
  TestType,
} from "@/lib/types";

function buildMetrics(
  v1: { score: number; tokens: number; latencyMs: number },
  v2: { score: number; tokens: number; latencyMs: number }
): ComparisonMetric[] {
  function metric(
    label: string,
    a: number,
    b: number,
    upIsGood: boolean,
    format: (n: number) => string
  ): ComparisonMetric {
    const diff = b - a;
    const direction: ComparisonMetric["direction"] =
      diff > 0 ? "up" : diff < 0 ? "down" : "flat";
    const sign = diff > 0 ? "+" : "";
    return {
      label,
      v1Value: format(a),
      v2Value: format(b),
      delta: `${sign}${format(diff)}`,
      direction,
      upIsGood,
    };
  }

  return [
    metric("Quality Score", v1.score, v2.score, true, (n) => n.toFixed(1)),
    metric("Tokens Used", v1.tokens, v2.tokens, false, (n) => String(Math.round(n))),
    metric("Latency (ms)", v1.latencyMs, v2.latencyMs, false, (n) =>
      String(Math.round(n))
    ),
  ];
}

export async function POST(req: NextRequest) {
  let body: {
    promptV1?: string;
    promptV2?: string;
    testType?: TestType;
    modelIds?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { promptV1, promptV2, testType, modelIds } = body;

  if (!promptV1?.trim() || !promptV2?.trim()) {
    return NextResponse.json(
      { error: "Both promptV1 and promptV2 are required" },
      { status: 400 }
    );
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

  const results: PromptComparisonResult[] = [];
  const errors: { modelId: string; version: "v1" | "v2"; error: string }[] = [];

  for (const modelId of modelIds) {
    const [callV1, callV2] = await Promise.all([
      callModel(modelId, promptV1),
      callModel(modelId, promptV2),
    ]);

    if (isModelError(callV1) || isModelError(callV2)) {
      if (isModelError(callV1)) errors.push({ modelId, version: "v1", error: callV1.error });
      if (isModelError(callV2)) errors.push({ modelId, version: "v2", error: callV2.error });
      continue;
    }

    const [evalV1, evalV2] = await Promise.all([
      evaluateResponse(testType, promptV1, callV1.responseText),
      evaluateResponse(testType, promptV2, callV2.responseText),
    ]);

    const metrics = buildMetrics(
      { score: evalV1.qualityScore, tokens: callV1.tokens, latencyMs: callV1.latencyMs },
      { score: evalV2.qualityScore, tokens: callV2.tokens, latencyMs: callV2.latencyMs }
    );

    results.push({
      modelId,
      modelName: callV1.modelName,
      evalId: `eval-${modelId}-${Date.now().toString(36)}`,
      metrics,
    });
  }

  if (results.length === 0) {
    return NextResponse.json(
      { error: "All model calls failed", details: errors },
      { status: 502 }
    );
  }

  return NextResponse.json({
    results,
    partialErrors: errors.length > 0 ? errors : undefined,
  });
}
