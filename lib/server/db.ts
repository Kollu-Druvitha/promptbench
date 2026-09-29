import path from "path";
import { TestRecord } from "@/lib/types";
import { kvGetJson, kvSetJson } from "@/lib/server/storage";

// ---------------------------------------------------------------------------
// Storage: a single document per scope (tests array) — either a JSON file on
// disk (dev) or an Upstash Redis key (serverless deployment). See
// lib/server/storage.ts for how the backend is chosen.
//
// Why file-based for v1?
// - better-sqlite3 needs native compilation (node-gyp + build tools),
//   which is a common source of setup pain on Windows specifically.
// - Postgres needs a hosted DB service — another account, another thing
//   that can go wrong, for a solo student project that doesn't need
//   concurrent multi-user writes yet.
// - A JSON file needs zero setup and works identically on any OS.
//
// Trade-off: this does NOT handle concurrent writes safely and won't
// scale past a single dev's local use. That's fine for now — and when it
// isn't, the functions below keep the exact shape a real DB layer would
// have, so the API routes that call them won't need to change.
// ---------------------------------------------------------------------------

const DB_PATH = path.join(process.cwd(), "data", "db.json");

// Which key/file holds a scope's tests:
//   - logged-in user   -> prefs-less key "db:<userId>" / data/users/<userId>/db.json
//   - anonymous "local" -> key "db:local" / data/db.json (back-compat)
function redisKeyFor(scope: string): string {
  return `db:${scope}`;
}

function dbPathFor(scope: string): string {
  if (scope && scope !== "local") {
    return path.join(process.cwd(), "data", "users", scope, "db.json");
  }
  return DB_PATH;
}

interface DbShape {
  tests: TestRecord[];
}

async function ensureDb(scope: string): Promise<DbShape> {
  return kvGetJson<DbShape>(redisKeyFor(scope), dbPathFor(scope), () => ({
    tests: [],
  }));
}

async function writeDb(data: DbShape, scope: string): Promise<void> {
  await kvSetJson(redisKeyFor(scope), dbPathFor(scope), data);
}

export async function saveTest(
  record: TestRecord,
  scope = "local"
): Promise<void> {
  const db = await ensureDb(scope);
  db.tests.unshift(record); // newest first
  await writeDb(db, scope);
}

export async function getTest(
  testId: string,
  scope = "local"
): Promise<TestRecord | null> {
  const db = await ensureDb(scope);
  return db.tests.find((t) => t.testId === testId) ?? null;
}

/**
 * Record whether the current user agrees with a judge's score for one model's
 * result inside a test. Returns the updated record, or null if the test or
 * the model's result can't be found.
 */
export async function updateResultFeedback(
  testId: string,
  scope: string,
  modelId: string,
  feedback: "agree" | "disagree" | null
): Promise<TestRecord | null> {
  const db = await ensureDb(scope);
  const test = db.tests.find((t) => t.testId === testId);
  if (!test) return null;
  const result = test.results.find((r) => r.modelId === modelId);
  if (!result) return null;
  if (feedback === null) {
    delete result.userFeedback;
  } else {
    result.userFeedback = feedback;
  }
  await writeDb(db, scope);
  return test;
}

export async function listTests(scope = "local"): Promise<TestRecord[]> {
  const db = await ensureDb(scope);
  return db.tests;
}

export async function getStats(scope = "local") {
  const db = await ensureDb(scope);
  const totalTestsRun = db.tests.length;
  const totalSpend = db.tests.reduce((sum, t) => sum + t.totalCost, 0);

  const modelCounts: Record<string, number> = {};
  for (const t of db.tests) {
    for (const m of t.modelsUsed) {
      modelCounts[m] = (modelCounts[m] ?? 0) + 1;
    }
  }
  const mostUsedModel =
    Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  return { totalTestsRun, totalSpend, mostUsedModel };
}