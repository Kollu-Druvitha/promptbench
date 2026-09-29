import { NextRequest, NextResponse } from "next/server";
import { callModel, isModelError } from "@/lib/server/models";
import { evaluateResponse } from "@/lib/server/evaluator";
import {
  ComparisonMetric,
  PromptComparisonResult,
  TestType,
} from "@/lib/types";

// 2 model calls + 2 judge calls per model, run in parallel — give serverless
// hosts headroom (Vercel Hobby caps at 60s).
export const maxDuration = 60;

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

  // Run every model (and its v1+v2 calls + judge evals) concurrently.
  // The old loop was serial per model -> N x (2 model calls + 2 judge calls)
  // of wall time; the parallel version is just ONE round-trip per stage.
  const outcomes = await Promise.allSettled(
    modelIds.map(async (modelId, idx) => {
      const [callV1, callV2] = await Promise.all([
        callModel(modelId, promptV1),
        callModel(modelId, promptV2),
      ]);

      if (isModelError(callV1) || isModelError(callV2)) {
        if (isModelError(callV1))
          errors.push({ modelId, version: "v1", error: callV1.error });
        if (isModelError(callV2))
          errors.push({ modelId, version: "v2", error: callV2.error });
        return null;
      }

      const [evalV1, evalV2] = await Promise.all([
        evaluateResponse(testType, promptV1, callV1.responseText),
        evaluateResponse(testType, promptV2, callV2.responseText),
      ]);

      const metrics = buildMetrics(
        { score: evalV1.qualityScore, tokens: callV1.tokens, latencyMs: callV1.latencyMs },
        { score: evalV2.qualityScore, tokens: callV2.tokens, latencyMs: callV2.latencyMs }
      );

      return {
        modelId,
        modelName: callV1.modelName,
        evalId: `eval-${modelId}-${idx}-${Date.now().toString(36)}`,
        metrics,
      };
    })
  );

  for (const outcome of outcomes) {
    if (outcome.status === "fulfilled" && outcome.value) {
      results.push(outcome.value);
    } else if (outcome.status === "rejected") {
      // Shouldn't normally happen (callModel catches its own errors), but
      // keep it safe: surface a generic per-model error instead of failing.
      const modelId = modelIds[outcomes.indexOf(outcome)] ?? "unknown";
      errors.push({ modelId, version: "v1", error: String(outcome.reason) });
    }
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
