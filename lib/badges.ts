import { TestResult } from "./types";

/**
 * Sentinel used when a model's cost is 0 / null / NaN — i.e. genuinely free
 * or local-tier calls where "quality points per dollar" would be unbounded.
 * We cap it so downstream math never sees Infinity and so the UI can show a
 * clean "Free" label instead.
 */
export const FREE_TIER_VALUE_SCORE = 1_000_000;

/**
 * Quality-per-cost metric: quality points earned per US dollar spent.
 * Higher = better. Guards against free-tier (0/null cost) and zero-quality
 * results so we never divide by zero or surface Infinity.
 */
export function valueScoreOf(
  result: Pick<TestResult, "qualityScore" | "costUsd">
): number {
  const cost = result.costUsd;
  if (result.qualityScore <= 0) return 0; // no quality -> no value
  if (!cost || cost <= 0 || !Number.isFinite(cost)) {
    return FREE_TIER_VALUE_SCORE; // free / local-tier call
  }
  return result.qualityScore / cost;
}

/**
 * True when a result's cost was free/local-tier (so its valueScore is the
 * free-tier sentinel and the UI should render "Free" rather than a number).
 */
export function isFreeTierValue(
  result: Pick<TestResult, "qualityScore" | "costUsd">
): boolean {
  const cost = result.costUsd;
  return (
    result.qualityScore > 0 &&
    (!cost || cost <= 0 || !Number.isFinite(cost))
  );
}

// Given a set of results, marks the winner in each category.
// Shared by mockData.ts and the real /api/tests route so the "best
// quality / fastest / best value" logic only lives in one place.
export function withBadges(results: TestResult[]): TestResult[] {
  if (results.length === 0) return results;

  const bestQuality = results.reduce((a, b) =>
    b.qualityScore > a.qualityScore ? b : a
  );
  const fastest = results.reduce((a, b) => (b.latencyMs < a.latencyMs ? b : a));
  // Best value = the highest quality-per-cost metric (free-tier results are
  // the sentinel value, so a genuinely free model wins the "Best Value"
  // badge — the same behaviour the old cost/quality formula produced).
  const bestValue = results.reduce((a, b) =>
    valueScoreOf(b) > valueScoreOf(a) ? b : a
  );

  return results.map((r) => ({
    ...r,
    valueScore: valueScoreOf(r),
    isBestQuality: r.modelId === bestQuality.modelId,
    isFastest: r.modelId === fastest.modelId,
    isBestValue: r.modelId === bestValue.modelId,
  }));
}
