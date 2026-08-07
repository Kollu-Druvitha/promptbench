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

interface DbShape {
  tests: TestRecord[];
}

function ensureDb(): DbShape {
  if (!fs.existsSync(DB_PATH)) {
    const initial: DbShape = { tests: [] };
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  const raw = fs.readFileSync(DB_PATH, "utf-8");
  try {
    return JSON.parse(raw) as DbShape;
  } catch {
    // Corrupt or empty file — reset rather than crash the app.
    const initial: DbShape = { tests: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
}

function writeDb(data: DbShape) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

export function saveTest(record: TestRecord): void {
  const db = ensureDb();
  db.tests.unshift(record); // newest first
  writeDb(db);
}

export function getTest(testId: string): TestRecord | null {
  const db = ensureDb();
  return db.tests.find((t) => t.testId === testId) ?? null;
}

export function listTests(): TestRecord[] {
  const db = ensureDb();
  return db.tests;
}

export function getStats() {
  const db = ensureDb();
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
