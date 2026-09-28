import fs from "fs";
import path from "path";
import { TestRecord } from "@/lib/types";

// -----------------------------------------------------------------------
// Storage: a single JSON file on disk (data/db.json).
//
// Why not SQLite or Postgres for v1?
// - better-sqlite3 needs native compilation (node-gyp + build tools),
//   which is a common source of setup pain on Windows specifically.
// - Postgres needs a hosted DB service — another account, another thing
//   that can go wrong, for a solo student project that doesn't need
//   concurrent multi-user writes yet.
// - A JSON file needs zero setup and works identically on any OS.
//
// Trade-off: this does NOT handle concurrent writes safely and won't
// scale past a single dev's local use. That's fine for now. If you ever
// deploy this somewhere with real users, swap this file for a real DB —
// every function below has the exact shape a real DB layer would have,
// so the API routes that call these won't need to change.
// -----------------------------------------------------------------------

const DB_PATH = path.join(process.cwd(), "data", "db.json");

// Which file holds a scope's tests:
//   - logged-in user   -> data/users/<userId>/db.json
//   - anonymous "local" -> data/db.json (back-compat with earlier builds)
function dbPathFor(scope: string): string {
  if (scope && scope !== "local") {
    return path.join(process.cwd(), "data", "users", scope, "db.json");
  }
  return DB_PATH;
}

interface DbShape {
  tests: TestRecord[];
}

function ensureDb(scope: string): DbShape {
  const file = dbPathFor(scope);
  if (!fs.existsSync(file)) {
    const initial: DbShape = { tests: [] };
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(initial, null, 2));
    return initial;
  }
  const raw = fs.readFileSync(file, "utf-8");
  try {
    return JSON.parse(raw) as DbShape;
  } catch {
    // Corrupt or empty file — reset rather than crash the app.
    const initial: DbShape = { tests: [] };
    fs.writeFileSync(file, JSON.stringify(initial, null, 2));
    return initial;
  }
}

function writeDb(data: DbShape, scope: string) {
  fs.writeFileSync(dbPathFor(scope), JSON.stringify(data, null, 2));
}

export function saveTest(record: TestRecord, scope = "local"): void {
  const db = ensureDb(scope);
  db.tests.unshift(record); // newest first
  writeDb(db, scope);
}

export function getTest(testId: string, scope = "local"): TestRecord | null {
  const db = ensureDb(scope);
  return db.tests.find((t) => t.testId === testId) ?? null;
}

/**
 * Record whether the current user agrees with a judge's score for one model's
 * result inside a test. Returns the updated record, or null if the test or
 * the model's result can't be found.
 */
export function updateResultFeedback(
  testId: string,
  scope: string,
  modelId: string,
  feedback: "agree" | "disagree" | null
): TestRecord | null {
  const db = ensureDb(scope);
  const test = db.tests.find((t) => t.testId === testId);
  if (!test) return null;
  const result = test.results.find((r) => r.modelId === modelId);
  if (!result) return null;
  if (feedback === null) {
    delete result.userFeedback;
  } else {
    result.userFeedback = feedback;
  }
  writeDb(db, scope);
  return test;
}

export function listTests(scope = "local"): TestRecord[] {
  const db = ensureDb(scope);
  return db.tests;
}

export function getStats(scope = "local") {
  const db = ensureDb(scope);
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
