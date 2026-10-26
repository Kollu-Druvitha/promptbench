// Shared types used across the app. These mirror the shapes the real
// backend API will return, so swapping mock functions for real fetch()
// calls later requires no changes to components.

export type TestType = "rag" | "coding" | "summarization" | "qa";

/**
 * Factuality classification (A–E) comparing an assistant's answer to a
 * reference: A=subset, B=superset, C=equivalent, D=contradicts, E=differs
 * without hurting correctness. Used by lib/server/evaluator.ts.
 */
export type FactualityCategory = "A" | "B" | "C" | "D" | "E";

/** Which RAG retrieval backend produced a test's context. */
export type RetrievalMode = "vector" | "tfidf";

export interface ModelOption {
  id: string; // stable id used by both frontend and backend, e.g. "gpt-4-turbo"
  name: string; // display name, e.g. "GPT-4 Turbo"
  provider: string; // e.g. "OpenAI"
  enabled: boolean; // false = shown in UI but not yet wired to a real backend call
}

export interface TestResult {
  modelId: string;
  modelName: string;
  modelVersion: string;
  provider: string;
  responseText: string;
  qualityScore: number; // 0-10
  /** Short human-readable justification from the judge for the score. */
  reason?: string;
  /**
   * Quality-per-cost: quality points per US dollar (higher = better).
   * FREE_TIER_VALUE_SCORE is used as a bounded sentinel for free/local-tier
   * calls (cost 0 / null) so math never sees Infinity. Might be absent on
   * records saved before this field existed.
   */
  valueScore?: number;
  /**
   * Recorded by the user after the fact: whether they agree with the judge's
   * score for this result. null / absent = not rated yet.
   */
  userFeedback?: "agree" | "disagree";
  tokens: number;
  latencyMs: number;
  costUsd: number;
  isBestQuality?: boolean;
  isFastest?: boolean;
  isBestValue?: boolean;
}

export interface TestRecord {
  testId: string;
  date: string; // ISO string
  prompt: string;
  testType: TestType;
  modelsUsed: string[]; // model ids
  results: TestResult[];
  bestModel: string; // model id
  totalCost: number;
  /** The logged-in owner (userId) this run belongs to; undefined for the "local" scope. */
  ownerId?: string;
  /** RAG only: name of the uploaded context file, if any. */
  contextFileName?: string;
  /** RAG only: the retrieved passages actually used to ground the answers. */
  retrievedContext?: string;
  /** RAG only: which retrieval backend produced the context (vector vs tfidf). */
  retrievalMode?: RetrievalMode;
}

export interface SubmitTestInput {
  prompt: string;
  testType: TestType;
  modelIds: string[];
  /** Optional RAG context: the raw text of an uploaded file + its name. */
  contextFileName?: string;
  contextText?: string;
}

export interface DashboardStats {
  totalTestsRun: number;
  totalSpend: number;
  mostUsedModel: string;
}

export interface PromptComparisonInput {
  promptV1: string;
  promptV2: string;
  testType: TestType;
  modelIds: string[];
}

export interface ComparisonMetric {
  label: string;
  v1Value: string;
  v2Value: string;
  delta: string;
  direction: "up" | "down" | "flat";
  // whether an "up" delta is good for this metric (e.g. accuracy) or bad (e.g. latency)
  upIsGood: boolean;
}

export interface PromptComparisonResult {
  modelId: string;
  modelName: string;
  evalId: string;
  metrics: ComparisonMetric[];
}

// ---------------------------------------------------------------------------
// Batch evaluation (dataset mode)
// ---------------------------------------------------------------------------

/**
 * A single row of a batch dataset. `question` is the prompt sent to each
 * model. `reference` (optional) is the ground-truth answer used by the
 * deterministic metrics (exact-match / ROUGE-L / BLEU). `context` (optional)
 * turns the row into a RAG question — the model is given this context and the
 * LLM-judge scores how faithful the answer stays to it.
 */
export interface DatasetItem {
  id: string;
  question: string;
  reference?: string;
  context?: string;
}

/**
 * The objective/LLM-judge metrics computed per (item × model). All values are
 * 0..1 (higher = better) except judgeNotes, so a model summary can simply
 * average them.
 */
export type BatchMetricKey =
  | "exactMatch"
  | "rougeL"
  | "bleu"
  | "faithfulness"
  | "answerRelevance";

/** Per (item × model) outcome inside a batch run. */
export interface BatchItemScore {
  itemId: string;
  modelId: string;
  modelName: string;
  response: string;
  /** Which metrics were computed for this row (missing = not applicable). */
  metrics: Partial<Record<BatchMetricKey, number>>;
  /** Short justification from the judge for faithfulness / answer-relevance. */
  judgeNote?: string;
  tokens: number;
  latencyMs: number;
  costUsd: number;
  /** Set when the model call failed for this row (response then holds the error). */
  error?: string;
}

/** Aggregated per-model performance across all items of a batch run. */
export interface BatchModelSummary {
  modelId: string;
  modelName: string;
  provider: string;
  itemCount: number;
  /** Mean of each metric across items (only metrics that were applicable). */
  metrics: Partial<Record<BatchMetricKey, number>>;
  /**
   * Overall accuracy: the mean of every available per-metric mean (so a run
   * with only references averages exactMatch/rougeL/bleu; a RAG run with
   * contexts averages faithfulness + answerRelevance on top). 0..1.
   */
  overallScore: number;
  totalTokens: number;
  totalLatencyMs: number;
  totalCostUsd: number;
  errorCount: number;
}

export interface BatchTestRecord {
  batchId: string;
  date: string; // ISO string
  name: string;
  testType: TestType;
  /** The logged-in owner (userId) this run belongs to; undefined for "local". */
  ownerId?: string;
  modelIds: string[];
  /** The parsed dataset (so results pages can render each question). */
  items: DatasetItem[];
  /** Flat list of every (item × model) outcome. */
  perItem: BatchItemScore[];
  /** Per-model aggregates, ranked by overallScore descending. */
  summaries: BatchModelSummary[];
  /** Rows skipped while parsing the uploaded file (warnings, not failures). */
  datasetErrors?: string[];
  /** Models that failed on every item. */
  partialErrors?: { modelId: string; error: string }[];
  /** True when the uploaded dataset was larger than the cap and was trimmed. */
  truncated?: boolean;
}

export interface SubmitBatchTestInput {
  name?: string;
  testType: TestType;
  modelIds: string[];
  fileName: string;
  fileText: string;
  /** Run the LLM-judge metrics (faithfulness / answer-relevance). Default true. */
  judgeMetrics?: boolean;
}
