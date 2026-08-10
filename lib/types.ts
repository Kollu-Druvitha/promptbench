// Shared types used across the app. These mirror the shapes the real
// backend API will return, so swapping mock functions for real fetch()
// calls later requires no changes to components.

export type TestType = "rag" | "coding" | "summarization" | "qa";

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
  /** RAG only: name of the uploaded context file, if any. */
  contextFileName?: string;
  /** RAG only: the retrieved passages actually used to ground the answers. */
  retrievedContext?: string;
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
