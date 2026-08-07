import { TestResult } from "./types";

// Given a set of results, marks the winner in each category.
// Shared by mockData.ts and the real /api/tests route so the "best
// quality / fastest / best value" logic only lives in one place.
export function withBadges(results: TestResult[]): TestResult[] {
  if (results.length === 0) return results;

  const bestQuality = results.reduce((a, b) =>
    b.qualityScore > a.qualityScore ? b : a
  );
  const fastest = results.reduce((a, b) => (b.latencyMs < a.latencyMs ? b : a));

  // Guard against division by zero when a model scored 0.
  const valueOf = (r: TestResult) =>
    r.qualityScore > 0 ? r.costUsd / r.qualityScore : Infinity;
  const bestValue = results.reduce((a, b) => (valueOf(b) < valueOf(a) ? b : a));

  return results.map((r) => ({
    ...r,
    isBestQuality: r.modelId === bestQuality.modelId,
    isFastest: r.modelId === fastest.modelId,
    isBestValue: r.modelId === bestValue.modelId,
  }));
}
