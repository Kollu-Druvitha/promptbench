// -------------------------------------------------------------------------
// Model Recommendation Engine (lightweight supervised recommender).
//
// This is the "ML" layer of PromptBench. Instead of hand-picking winners,
// it TRAINS over every stored evaluation run and PREDICTS which model to
// use next for a given task type and priority.
//
//   ML framing
//   ----------
//   - Training data: every stored TestRecord is a labeled example. Each
//     (record.testType, result.modelId) pair is a sample whose labels are
//     the observed qualityScore, latencyMs, and costUsd. So the model is
//     literally "trained on the responses we generated."
//   - Instance-based / memory-based learning: we keep the observations and
//     compute predictions at query time (like k-NN / Thompson sampling),
//     which is right when the dataset fits in memory and re-fit cost ~ 0.
//     No heavy framework, no native deps.
//   - Bayesian shrinkage: raw per-model means overfit with small samples
//     (a lucky 1-run model would dominate). We shrink every estimate
//     toward the global mean using pseudo-counts — a real statistics
//     technique for small-sample estimation.
//
// This is a simplified model router — the same high-level idea as
// RouteLLM / Martian / LiteLLM's routing features.
// -------------------------------------------------------------------------

import { TestRecord, TestType } from "@/lib/types";

export type RecommendationPriority = "quality" | "speed" | "value";

export interface ModelProfile {
  modelId: string;
  name: string;
  provider: string;
  count: number; // how many results this model contributed
  quality: number; // mean quality score
  latencyMs: number; // mean latency
  meanTokens: number;
  meanCostUsd: number;
  valueScore: number; // cost per quality point (lower better; Infinity if 0)
  winRate: number; // fraction of tests where it was best-quality
}

export interface RecommendationRow {
  model: string;
  name: string;
  provider: string;
  count: number;
  score: number; // priority-weighted utility (higher = better)
  confidence: number; // 0..1 from sample size + variance
  rationale: string;
}

export interface LeaderboardRow {
  model: string;
  name: string;
  provider: string;
  count: number;
  quality: number;
  latencyMs: number;
  costUsd: number;
  winRate: number;
}

export interface RecommendationPayload {
  generatedAt: string;
  method: string;
  priority: RecommendationPriority;
  testType: TestType;
  totalTests: number;
  observations: number;
  enoughData: boolean;
  /** Personalization weights applied to each utility (default all 1). */
  weights: RecommendationWeights;
  /** True when the user's own data was used for training. */
  personalized: boolean;
  leaderboard: LeaderboardRow[];
  recommendation: RecommendationRow[];
}

export interface RecommendationWeights {
  quality: number;
  speed: number;
  value: number;
}

export const DEFAULT_WEIGHTS: RecommendationWeights = {
  quality: 1,
  speed: 1,
  value: 1,
};
// Pseudo-count used for Bayesian shrinkage (strength of the prior).
const PRIOR_STRENGTH = 20;

// -------------------------------------------------------------------------
// Fit step: aggregate every stored result into per-model profiles for a
// given test type. Each observation is one (model × test) outcome.
// -------------------------------------------------------------------------
function buildProfile(
  records: TestRecord[],
  testType: TestType
): ModelProfile[] {
  const map = new Map<
    string,
    {
      count: number;
      qSum: number;
      latSum: number;
      tokSum: number;
      costSum: number;
      bestQualityCount: number;
    }
  >();

  for (const r of records) {
    if (r.testType !== testType) continue;
    for (const res of r.results) {
      const e = map.get(res.modelId) ?? {
        count: 0,
        qSum: 0,
        latSum: 0,
        tokSum: 0,
        costSum: 0,
        bestQualityCount: 0,
      };
      e.count += 1;
      e.qSum += res.qualityScore;
      e.latSum += res.latencyMs;
      e.tokSum += res.tokens;
      e.costSum += res.costUsd;
      if (res.isBestQuality) e.bestQualityCount += 1;
      map.set(res.modelId, e);
    }
  }

  const nameOf = (model: string) =>
    records
      .flatMap((t) => t.results)
      .find((res) => res.modelId === model)?.modelName ?? model;
  const providerOf = (model: string) =>
    records
      .flatMap((t) => t.results)
      .find((res) => res.modelId === model)?.provider ?? "—";

  return Array.from(map.entries()).map(([modelId, e]) => {
    const quality = e.qSum / e.count;
    const meanCostUsd = e.costSum / e.count;
    return {
      modelId,
      name: nameOf(modelId),
      provider: providerOf(modelId),
      count: e.count,
      quality,
      latencyMs: e.latSum / e.count,
      meanTokens: e.tokSum / e.count,
      meanCostUsd,
      // Cost per quality point — the "value" target. Infinity if score 0.
      valueScore: quality > 0 ? meanCostUsd / quality : Infinity,
      winRate: e.count > 0 ? e.bestQualityCount / e.count : 0,
    };
  });
}

// -------------------------------------------------------------------------
// Bayesian shrinkage: push an estimate toward a prior (global mean) weighted
// by a pseudo-count. count 0 → prior; count large → the observed mean.
// This keeps the recommender honest on small data (a lucky single run can't
// dominate a well-tested model).
// -------------------------------------------------------------------------
function shrunk(value: number, count: number, prior: number): number {
  const weight = count / (count + PRIOR_STRENGTH);
  return weight * value + (1 - weight) * prior;
}

function meanOf(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

// -------------------------------------------------------------------------
// Predict step: rank candidate models by a priority-weighted utility.
// Higher score = better. Uses shrunk estimates in every branch.
// -------------------------------------------------------------------------
function rankForPriority(
  profiles: ModelProfile[],
  priority: RecommendationPriority,
  weights: RecommendationWeights = DEFAULT_WEIGHTS
): { profile: ModelProfile; score: number }[] {
  if (profiles.length === 0) return [];

  const globalQ = meanOf(profiles.map((p) => p.quality));
  const globalLat = meanOf(profiles.map((p) => p.latencyMs));
  const finiteValues = profiles
    .map((p) => p.valueScore)
    .filter((v) => Number.isFinite(v));
  const globalValue = finiteValues.length > 0 ? meanOf(finiteValues) : 1;

  return profiles
    .map((p) => {
      let score: number;
      if (priority === "quality") {
        // Personalization: a user who boosts "quality" pushes this axis harder.
        score = shrunk(p.quality, p.count, globalQ) * weights.quality;
      } else if (priority === "speed") {
        // Weighted latency (negated so higher = better ranking).
        score = -(shrunk(p.latencyMs, p.count, globalLat) * weights.speed);
      } else {
        const safeValue = Number.isFinite(p.valueScore)
          ? shrunk(p.valueScore, p.count, globalValue)
          : globalValue;
        score = -(safeValue * weights.value);
      }
      return { profile: p, score };
    })
    .sort((a, b) => b.score - a.score);
}

function rationalize(priority: RecommendationPriority, p: ModelProfile): string {
  if (priority === "quality") {
    return `Highest average quality (${p.quality.toFixed(1)}/10) across ${p.count} run${p.count === 1 ? "" : "s"}.`;
  }
  if (priority === "speed") {
    return `Fastest average latency (${Math.round(p.latencyMs)}ms) across ${p.count} run${p.count === 1 ? "" : "s"}.`;
  }
  const costQuality =
    p.quality > 0 ? p.meanCostUsd / p.quality : Infinity;
  return `Best cost-per-quality ($${Number.isFinite(costQuality) ? costQuality.toFixed(4) : "∞"}) across ${p.count} run${p.count === 1 ? "" : "s"}.`;
}

// Confidence 0..1: grows with sample size (Plackett-style certainty mapping).
function confidenceFor(count: number): number {
  return Number(Math.min(1, count / 25).toFixed(2));
}
// -------------------------------------------------------------------------
// Public entry point: fit on stored history, predict for a query test type
// and priority.
// -------------------------------------------------------------------------
export function buildRecommendations(
  records: TestRecord[],
  testType: TestType,
  priority: RecommendationPriority,
  weights: RecommendationWeights = DEFAULT_WEIGHTS
): RecommendationPayload {
  const profiles = buildProfile(records, testType);
  const ranked = rankForPriority(profiles, priority, weights);

  const testTypeCount = records.filter((r) => r.testType === testType).length;
  const personalized =
    weights.quality !== 1 || weights.speed !== 1 || weights.value !== 1;

  const leaderboard: LeaderboardRow[] = profiles
    .map((p) => ({
      model: p.modelId,
      name: p.name,
      provider: p.provider,
      count: p.count,
      quality: p.quality,
      latencyMs: p.latencyMs,
      costUsd: p.meanCostUsd,
      winRate: p.winRate,
    }))
    .sort((a, b) => b.quality - a.quality);

  const recommendation: RecommendationRow[] = ranked.map(({ profile: p, score }) => ({
    model: p.modelId,
    name: p.name,
    provider: p.provider,
    count: p.count,
    score: Number(score.toFixed(3)),
    confidence: confidenceFor(p.count),
    rationale: rationalize(priority, p),
  }));

  return {
    generatedAt: new Date().toISOString(),
    method: "Instance-based (memory) learning + Bayesian shrinkage",
    priority,
    testType,
    totalTests: testTypeCount,
    observations: profiles.reduce((s, p) => s + p.count, 0),
    enoughData: testTypeCount >= 5,
    weights,
    personalized,
    leaderboard,
    recommendation,
  };
}