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

export interface ParseContextFileResult {
  fileName: string;
  text: string;
}

// Upload a binary/text context file to the server-side parser (/api/parse),
// which extracts plain text from .pdf / .docx (and passes text formats
// through). Used by TestForm so binary documents don't need browser-side
// parsing libraries.
export async function parseContextFile(
  file: File
): Promise<ParseContextFileResult> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/parse", {
    method: "POST",
    body: form,
  });
  return parseJsonOrThrow(res);
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

/**
 * Record whether the current user agrees with one model's judge score on a
 * past test. Feedback of null clears a previous vote. Returns the updated
 * TestRecord.
 */
export async function setResultFeedback(
  testId: string,
  modelId: string,
  feedback: "agree" | "disagree" | null
): Promise<TestRecord> {
  const res = await fetch(`/api/tests/${testId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modelId, feedback }),
  });
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

export interface AuthResult {
  user: { id: string; username: string } | null;
}

export async function registerUser(
  username: string,
  password: string
): Promise<{ user: { id: string; username: string } }> {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return parseJsonOrThrow(res);
}

export async function loginUser(
  username: string,
  password: string
): Promise<{ user: { id: string; username: string } }> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return parseJsonOrThrow(res);
}

export async function logoutUser(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
}

export async function getMe(): Promise<AuthResult> {
  const res = await fetch("/api/auth/me");
  return parseJsonOrThrow(res);
}

export interface PreferenceWeights {
  quality: number;
  speed: number;
  value: number;
}

export async function updatePrefs(
  prefs: PreferenceWeights
): Promise<{ prefs: PreferenceWeights }> {
  const res = await fetch("/api/prefs", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(prefs),
  });
  return parseJsonOrThrow(res);
}
