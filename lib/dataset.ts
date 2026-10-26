import { DatasetItem } from "./types";

// ---------------------------------------------------------------------------
// Dataset parser for batch evaluation. Lives in lib/ (not lib/server) so BOTH
// the client (for instant validation + row count in the upload form) and the
// server (/api/batch) share exactly one implementation — no drift.
//
// Supported formats:
//   - JSON:  an array of objects (or a single object) with any of these keys:
//       question/prompt/input/q        -> the prompt sent to the model
//       reference/ground_truth/answer   -> ground-truth answer (optional)
//       context/context_text/passage    -> RAG context (optional)
//   - CSV:   a header row using the same column names (case-insensitive).
// ---------------------------------------------------------------------------

export const MAX_DATASET_ITEMS = 100;

const QUESTION_KEYS = ["question", "prompt", "input", "q", "query"];
const REFERENCE_KEYS = [
  "reference",
  "ground_truth",
  "groundtruth",
  "answer",
  "expected",
  "output",
  "gt",
];
const CONTEXT_KEYS = ["context", "context_text", "contexttext", "passage", "document", "chunk"];

function pick(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const v = obj[key];
    if (v !== undefined && v !== null) {
      const s = String(v).trim();
      if (s) return s;
    }
  }
  return undefined;
}

function normalizeRow(obj: Record<string, unknown>): DatasetItem | null {
  // Normalize keys (lowercase, trim) so matching is forgiving.
  const norm: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    norm[k.trim().toLowerCase()] = v;
  }
  const question = pick(norm, QUESTION_KEYS);
  if (!question) return null;
  const reference = pick(norm, REFERENCE_KEYS);
  const context = pick(norm, CONTEXT_KEYS);
  return { id: "", question, reference, context };
}

// A small but correct CSV parser: handles quoted fields, escaped quotes (""),
// and CRLF/LF line endings. No dependency.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

export interface ParsedDataset {
  items: DatasetItem[];
  errors: string[];
  truncated: boolean;
}

/**
 * Parse a dataset file (JSON or CSV) into DatasetItems. Malformed rows are
 * skipped and reported in `errors` (the run can still proceed with valid rows).
 * Rows without a question are ignored; the dataset is capped at
 * MAX_DATASET_ITEMS with `truncated: true` when it exceeds the cap.
 */
export function parseDatasetFile(fileName: string, text: string): ParsedDataset {
  const errors: string[] = [];
  const rawRows: Record<string, unknown>[] = [];

  const trimmed = text.trim();
  const looksLikeJson = trimmed.startsWith("[") || trimmed.startsWith("{");
  const isCsv =
    !looksLikeJson && (fileName.toLowerCase().endsWith(".csv") || trimmed.includes(","));

  if (looksLikeJson) {
    try {
      const parsed = JSON.parse(trimmed);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of arr) {
        if (item && typeof item === "object") rawRows.push(item as Record<string, unknown>);
      }
    } catch {
      errors.push(`"${fileName}" is not valid JSON.`);
    }
  } else if (isCsv) {
    const rows = parseCsv(trimmed);
    if (rows.length === 0) {
      errors.push(`"${fileName}" has no rows.`);
    } else {
      const header = rows[0].map((h) => h.trim().toLowerCase());
      for (let r = 1; r < rows.length; r++) {
        const row: Record<string, unknown> = {};
        rows[r].forEach((cell, i) => {
          row[header[i] ?? `col${i}`] = cell;
        });
        rawRows.push(row);
      }
    }
  } else {
    errors.push(
      `Unsupported dataset format. Upload .csv or .json — or a plain-text file with question/reference/context columns.`
    );
  }

  const items: DatasetItem[] = [];
  let skippedNoQuestion = 0;
  for (const row of rawRows) {
    const item = normalizeRow(row);
    if (!item) {
      skippedNoQuestion++;
      continue;
    }
    item.id = `item-${items.length + 1}`;
    items.push(item);
  }

  if (skippedNoQuestion > 0) {
    errors.push(
      `${skippedNoQuestion} row(s) skipped because they had no question/prompt column.`
    );
  }

  let truncated = false;
  if (items.length > MAX_DATASET_ITEMS) {
    truncated = true;
    errors.push(
      `Dataset has ${items.length} rows; only the first ${MAX_DATASET_ITEMS} were kept.`
    );
    items.length = MAX_DATASET_ITEMS;
  }

  return { items, errors, truncated };
}
