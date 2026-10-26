import { BatchMetricKey } from "@/lib/types";

// ---------------------------------------------------------------------------
// Batch evaluation metrics — deterministic, reference-based, pure functions
// (no LLM calls, no network, fully unit-testable). Every value is normalized
// to 0..1 so a model summary can average them.
//
//   exactMatch  normalized string equality
//   rougeL      F-measure over the longest common subsequence of tokens
//   bleu        clipped n-gram precision (n=1..4) with brevity penalty
//
// The LLM-as-judge metrics (faithfulness, answer relevance) live in
// lib/server/evaluator.ts with the rest of the judge logic, so this module
// stays free of AI-SDK imports.
// ---------------------------------------------------------------------------

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 1 when the (normalized) strings are identical, else 0. */
export function exactMatch(prediction: string, reference: string): number {
  const p = normalizeForMatch(prediction);
  const r = normalizeForMatch(reference);
  if (!r) return 0;
  return p === r ? 1 : 0;
}

function lcsLength(a: string[], b: string[]): number {
  // Cap token counts so the DP stays cheap on long answers (the tail rarely
  // changes the score meaningfully).
  const A = a.slice(0, 400);
  const B = b.slice(0, 400);
  const m = A.length;
  const n = B.length;
  if (m === 0 || n === 0) return 0;
  let prev = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    const cur = new Array<number>(n + 1).fill(0);
    for (let j = 1; j <= n; j++) {
      cur[j] = A[i - 1] === B[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    }
    prev = cur;
  }
  return prev[n];
}

/** ROUGE-L F1 — measures the longest matching token sequence (order matters). */
export function rougeL(prediction: string, reference: string): number {
  const pred = tokenize(prediction);
  const ref = tokenize(reference);
  if (pred.length === 0 || ref.length === 0) return 0;
  const lcs = lcsLength(pred, ref);
  const precision = lcs / pred.length;
  const recall = lcs / ref.length;
  if (precision + recall === 0) return 0;
  return (2 * precision * recall) / (precision + recall);
}

function ngramCounts(tokens: string[], n: number): Map<string, number> {
  const counts = new Map<string, number>();
  for (let i = 0; i <= tokens.length - n; i++) {
    const gram = tokens.slice(i, i + n).join(" ");
    counts.set(gram, (counts.get(gram) ?? 0) + 1);
  }
  return counts;
}

/**
 * BLEU (n=1..4) with the standard brevity penalty. Matches the widely-used
 * formulation; a perfect verbatim match scores 1.0.
 */
export function bleu(prediction: string, reference: string, maxN = 4): number {
  const pred = tokenize(prediction);
  const ref = tokenize(reference);
  if (pred.length === 0 || ref.length === 0) return 0;

  const precisions: number[] = [];
  for (let n = 1; n <= maxN; n++) {
    if (pred.length < n || ref.length < n) break;
    const predCounts = ngramCounts(pred, n);
    const refCounts = ngramCounts(ref, n);
    let clipped = 0;
    let total = 0;
    for (const [gram, c] of predCounts) {
      const refC = refCounts.get(gram) ?? 0;
      clipped += Math.min(c, refC);
      total += c;
    }
    if (total === 0) break;
    precisions.push(clipped / total);
  }
  if (precisions.length === 0) return 0;

  const geoMean = Math.exp(
    precisions.reduce((s, p) => s + Math.log(p), 0) / precisions.length
  );
  const brevityPenalty = Math.min(1, Math.exp(1 - ref.length / pred.length));
  return brevityPenalty * geoMean;
}

/** Deterministic metrics that need a reference answer. */
export function referenceMetrics(
  prediction: string,
  reference: string
): Partial<Record<BatchMetricKey, number>> {
  return {
    exactMatch: exactMatch(prediction, reference),
    rougeL: rougeL(prediction, reference),
    bleu: bleu(prediction, reference),
  };
}
