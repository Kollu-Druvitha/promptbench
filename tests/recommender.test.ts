import { describe, expect, it } from "vitest";
import { buildRecommendations } from "@/lib/server/recommender";
import { TestRecord, TestResult, TestType } from "@/lib/types";

function makeResult(
  modelId: string,
  quality: number,
  latencyMs: number,
  costUsd: number,
  isBestQuality = false
): TestResult {
  return {
    modelId,
    modelName: modelId,
    modelVersion: modelId,
    provider: "Test",
    responseText: "",
    qualityScore: quality,
    tokens: 100,
    latencyMs,
    costUsd,
    isBestQuality,
  };
}

function makeRecord(type: TestType, results: TestResult[]): TestRecord {
  return {
    testId: `t-${Math.random().toString(36).slice(2)}`,
    date: new Date().toISOString(),
    prompt: "prompt",
    testType: type,
    modelsUsed: results.map((r) => r.modelId),
    results,
    bestModel: results[0]?.modelId ?? "",
    totalCost: results.reduce((s, r) => s + r.costUsd, 0),
  };
}

// One record, one model — quality/latency/cost configurable per model.
function record(type: TestType, modelId: string, quality: number, latencyMs: number, costUsd: number): TestRecord {
  return makeRecord(type, [makeResult(modelId, quality, latencyMs, costUsd)]);
}

describe("buildRecommendations", () => {
  it("ranks the higher-quality model first for the quality priority", () => {
    const records = [
      ...Array.from({ length: 10 }, () => record("qa", "model-a", 9, 100, 1)),
      ...Array.from({ length: 10 }, () => record("qa", "model-b", 8, 100, 1)),
    ];
    const payload = buildRecommendations(records, "qa", "quality");
    expect(payload.recommendation[0].model).toBe("model-a");
    expect(payload.recommendation[0].score).toBeGreaterThan(payload.recommendation[1].score);
  });

  it("ranks the faster model first for the speed priority", () => {
    const records = [
      ...Array.from({ length: 10 }, () => record("qa", "model-fast", 7, 100, 1)),
      ...Array.from({ length: 10 }, () => record("qa", "model-slow", 7, 300, 1)),
    ];
    const payload = buildRecommendations(records, "qa", "speed");
    expect(payload.recommendation[0].model).toBe("model-fast");
  });

  it("ranks the cheaper-per-quality model first for the value priority", () => {
    const records = [
      ...Array.from({ length: 10 }, () => record("qa", "model-cheap", 8, 100, 0.8)),
      ...Array.from({ length: 10 }, () => record("qa", "model-pricey", 8, 100, 1.6)),
    ];
    const payload = buildRecommendations(records, "qa", "value");
    expect(payload.recommendation[0].model).toBe("model-cheap");
  });

  it("only considers records of the requested task type", () => {
    const qa = [...Array.from({ length: 10 }, () => record("qa", "model-a", 9, 100, 1))];
    const rag = [...Array.from({ length: 10 }, () => record("rag", "model-rag", 3, 100, 1))];
    const payload = buildRecommendations([...qa, ...rag], "qa", "quality");
    expect(payload.totalTests).toBe(10);
    expect(payload.leaderboard.map((l) => l.model)).not.toContain("model-rag");
  });

  it("marks enoughData=false below 5 runs for the type, true at 5+", () => {
    const few = [...Array.from({ length: 3 }, () => record("qa", "model-a", 8, 100, 1))];
    expect(buildRecommendations(few, "qa", "quality").enoughData).toBe(false);

    const enough = [...Array.from({ length: 6 }, () => record("qa", "model-a", 8, 100, 1))];
    expect(buildRecommendations(enough, "qa", "quality").enoughData).toBe(true);
  });

  it("applies Bayesian shrinkage: a single lucky 10/10 run is pulled toward the prior", () => {
    const records = [
      ...Array.from({ length: 9 }, () => record("qa", "model-tested", 8, 100, 1)),
      record("qa", "model-lucky", 10, 100, 1), // one perfect run
    ];
    const payload = buildRecommendations(records, "qa", "quality");
    const lucky = payload.recommendation.find((r) => r.model === "model-lucky");
    // Raw mean is 10; shrinkage toward the group prior must bring it below 10.
    expect(lucky).toBeDefined();
    expect(lucky!.score).toBeLessThan(10);
  });

  it("grows confidence with sample size", () => {
    const records = [
      ...Array.from({ length: 10 }, () => record("qa", "model-a", 8, 100, 1)),
      ...Array.from({ length: 25 }, () => record("qa", "model-b", 8, 100, 1)),
    ];
    const payload = buildRecommendations(records, "qa", "quality");
    const a = payload.recommendation.find((r) => r.model === "model-a")!;
    const b = payload.recommendation.find((r) => r.model === "model-b")!;
    expect(b.confidence).toBeGreaterThan(a.confidence);
    expect(b.confidence).toBeLessThanOrEqual(1);
  });

  it("flags personalized=true when custom weights are supplied", () => {
    const records = [...Array.from({ length: 6 }, () => record("qa", "model-a", 8, 100, 1))];
    const payload = buildRecommendations(records, "qa", "quality", {
      quality: 2,
      speed: 1,
      value: 1,
    });
    expect(payload.personalized).toBe(true);
    expect(payload.weights.quality).toBe(2);
  });

  it("sorts the leaderboard by quality descending", () => {
    const records = [
      ...Array.from({ length: 10 }, () => record("qa", "model-high", 9, 100, 1)),
      ...Array.from({ length: 10 }, () => record("qa", "model-low", 6, 100, 1)),
    ];
    const payload = buildRecommendations(records, "qa", "quality");
    const scores = payload.leaderboard.map((l) => l.quality);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });
});
