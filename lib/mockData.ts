import { DashboardStats, TestRecord, TestResult } from "./types";
import { withBadges } from "./badges";

// Mock data shaped exactly like real API responses will be.
// Values below mirror what was in the Stitch mockups so the UI looks
// identical until the backend is wired in.

export function buildMockResults(modelIds: string[]): TestResult[] {
  const catalog: Record<string, TestResult> = {
    "gemini-2.5-flash": {
      modelId: "gemini-2.5-flash",
      modelName: "Gemini 2.5 Flash",
      modelVersion: "gemini-2.5-flash",
      provider: "Google",
      responseText: JSON.stringify(
        [
          { name: "Apple", type: "Company", confidence: 1.0 },
          { name: "Vision Pro", type: "Product", confidence: 1.0 },
          { name: "Cupertino", type: "Location", confidence: 1.0 },
        ],
        null,
        2
      ),
      qualityScore: 9.8,
      tokens: 84,
      latencyMs: 1120,
      costUsd: 0, // free tier
    },
    "llama-3.3-70b": {
      modelId: "llama-3.3-70b",
      modelName: "Llama 3.3 70B",
      modelVersion: "llama-3.3-70b-versatile",
      provider: "Groq",
      responseText: JSON.stringify(
        [
          { name: "Apple", type: "Company", confidence: 1.0 },
          { name: "Vision Pro", type: "Product", confidence: 1.0 },
          { name: "Cupertino", type: "Location", confidence: 1.0 },
        ],
        null,
        2
      ),
      qualityScore: 9.5,
      tokens: 112,
      // Groq is known for very fast inference — reflect that in mock data
      latencyMs: 210,
      costUsd: 0, // free tier
    },
  };

  const results = modelIds
    .map((id) => catalog[id])
    .filter((r): r is TestResult => Boolean(r));

  return withBadges(results);
}

export const MOCK_HISTORY: TestRecord[] = [
  {
    testId: "eval-9942",
    date: "2026-08-04T14:32:00Z",
    prompt:
      "Extract the key financial entities and sentiment from the Q3 earnings transcript...",
    testType: "qa",
    modelsUsed: ["gemini-2.5-flash", "llama-3.3-70b"],
    results: buildMockResults(["gemini-2.5-flash", "llama-3.3-70b"]),
    bestModel: "gemini-2.5-flash",
    totalCost: 0,
  },
  {
    testId: "eval-9941",
    date: "2026-08-04T11:15:00Z",
    prompt:
      "Translate the following technical documentation into Spanish, maintaining technical accuracy...",
    testType: "summarization",
    modelsUsed: ["gemini-2.5-flash", "llama-3.3-70b"],
    results: buildMockResults(["gemini-2.5-flash", "llama-3.3-70b"]),
    bestModel: "llama-3.3-70b",
    totalCost: 0,
  },
  {
    testId: "eval-9940",
    date: "2026-08-03T18:45:00Z",
    prompt:
      "Write a python script that connects to the AWS S3 API and uploads a file, handling retries...",
    testType: "coding",
    modelsUsed: ["gemini-2.5-flash", "llama-3.3-70b"],
    results: buildMockResults(["gemini-2.5-flash", "llama-3.3-70b"]),
    bestModel: "gemini-2.5-flash",
    totalCost: 0,
  },
];

export const MOCK_DASHBOARD_STATS: DashboardStats = {
  totalTestsRun: 1842,
  totalSpend: 0,
  mostUsedModel: "gemini-2.5-flash",
};
