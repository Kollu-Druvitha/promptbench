import {
  DashboardStats,
  PromptComparisonInput,
  PromptComparisonResult,
  SubmitTestInput,
  TestRecord,
} from "./types";

// -----------------------------------------------------------------------
// Data-fetching layer — now wired to the real backend API routes.
// Every function here has the exact same name/signature it had when it
// returned mock data; only the implementation changed. No component
// needed to be touched to make this switch.
// -----------------------------------------------------------------------

async function parseJsonOrThrow(res: Response) {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const baseMessage = data?.error ?? `Request failed with status ${res.status}`;
    const details = Array.isArray(data?.details)
      ? data.details
          .map((d: { modelId: string; error: string }) => `${d.modelId}: ${d.error}`)
          .join(" | ")
      : null;
    throw new Error(details ? `${baseMessage} — ${details}` : baseMessage);
  }
  return data;
}

export async function submitTest(input: SubmitTestInput): Promise<{ testId: string }> {
  const res = await fetch("/api/tests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: input.prompt,
      testType: input.testType,
      modelIds: input.modelIds,
      contextFileName: input.contextFileName ?? undefined,
      contextText: input.contextText ?? undefined,
    }),
  });
  const data = await parseJsonOrThrow(res);
  return { testId: data.testId };
}

export async function getTestResults(testId: string): Promise<TestRecord | null> {
  const res = await fetch(`/api/tests/${testId}`);
  if (res.status === 404) return null;
  return parseJsonOrThrow(res);
}

export async function getTestHistory(): Promise<TestRecord[]> {
  const res = await fetch("/api/tests");
  return parseJsonOrThrow(res);
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const res = await fetch("/api/dashboard/stats");
  return parseJsonOrThrow(res);
}

export async function submitPromptComparison(
  input: PromptComparisonInput
): Promise<PromptComparisonResult[]> {
  const res = await fetch("/api/compare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await parseJsonOrThrow(res);
  return data.results;
}
