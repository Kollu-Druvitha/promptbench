import { NextRequest, NextResponse } from "next/server";
import { callModel, isModelError, MODEL_DISPLAY } from "@/lib/server/models";
import { buildRagPrompt } from "@/lib/server/rag";
import { referenceMetrics } from "@/lib/server/metrics";
import {
  evaluateFaithfulness,
  evaluateAnswerRelevance,
} from "@/lib/server/evaluator";
import { parseDatasetFile } from "@/lib/dataset";
import { saveBatch, listBatches } from "@/lib/server/db";
import { currentScope } from "@/lib/auth";
import {
  BatchItemScore,
  BatchMetricKey,
  BatchModelSummary,
  BatchTestRecord,
  DatasetItem,
  TestType,
} from "@/lib/types";

// A batch run does many model + judge calls. Local dev has no limit; give
// serverless hosts (Vercel Pro caps at 300s) the headroom they need.
export const maxDuration = 300;

// How many dataset items are processed concurrently. Keeps free-tier rate
// limits happy: within an item, its models are called in parallel; across
// items, we step through this many at a time.
const ITEM_CONCURRENCY = 3;

/** Run `fn` over items with at most `limit` in flight at once. */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function buildSummaries(
  perItem: BatchItemScore[],
  modelIds: string[],
  items: DatasetItem[]
): { summaries: BatchModelSummary[]; partialErrors: { modelId: string; error: string }[] } {
  const summaries: BatchModelSummary[] = [];
  const partialErrors: { modelId: string; error: string }[] = [];

  for (const modelId of modelIds) {
    const rows = perItem.filter((r) => r.modelId === modelId);
    if (rows.length === 0) continue;
    const display = MODEL_DISPLAY[modelId] ?? { name: modelId, provider: "AI Provider" };

    const metricMeans: Partial<Record<BatchMetricKey, number>> = {};
    const metricKeys: BatchMetricKey[] = [
      "exactMatch",
      "rougeL",
      "bleu",
      "faithfulness",
      "answerRelevance",
    ];
    for (const key of metricKeys) {
      const values = rows
        .map((r) => r.metrics[key])
        .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
      if (values.length > 0) metricMeans[key] = avg(values);
    }

    const available = Object.values(metricMeans).filter(
      (v): v is number => typeof v === "number"
    );
    const errorCount = rows.filter((r) => r.error).length;

    summaries.push({
      modelId,
      modelName: display.name,
      provider: display.provider,
      itemCount: rows.length,
      metrics: metricMeans,
      overallScore: available.length > 0 ? avg(available) : 0,
      totalTokens: rows.reduce((s, r) => s + r.tokens, 0),
      totalLatencyMs: rows.reduce((s, r) => s + r.latencyMs, 0),
      totalCostUsd: rows.reduce((s, r) => s + r.costUsd, 0),
      errorCount,
    });

    // A model that failed on every item is a partial failure, not a 0 score.
    if (rows.every((r) => r.error)) {
      partialErrors.push({
        modelId,
        error: rows[0].error ?? "Model call failed on every item",
      });
    }
  }

  summaries.sort((a, b) => b.overallScore - a.overallScore);
  return { summaries, partialErrors };
}

export async function POST(req: NextRequest) {
  let body: {
    name?: string;
    testType?: TestType;
    modelIds?: string[];
    fileName?: string;
    fileText?: string;
    judgeMetrics?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { testType, modelIds, fileName, fileText } = body;
  const name = (body.name ?? "").trim() || "Untitled batch";
  const judgeMetrics = body.judgeMetrics !== false;

  if (!testType) {
    return NextResponse.json({ error: "testType is required" }, { status: 400 });
  }
  if (!modelIds || modelIds.length === 0) {
    return NextResponse.json(
      { error: "At least one modelId is required" },
      { status: 400 }
    );
  }
  if (!fileName || !fileText || !fileText.trim()) {
    return NextResponse.json(
      { error: "A dataset file (CSV or JSON) is required" },
      { status: 400 }
    );
  }

  const parsed = parseDatasetFile(fileName, fileText);
  if (parsed.items.length === 0) {
    return NextResponse.json(
      { error: `No valid rows found in the dataset.`, details: parsed.errors },
      { status: 400 }
    );
  }

  // Run each item (with its models in parallel) through the same flow as a
  // single test: optional RAG augmentation -> parallel model calls -> metrics.
  const perItem = await mapLimit(parsed.items, ITEM_CONCURRENCY, async (item) => {
    const rowResults: BatchItemScore[] = [];

    // RAG rows get the same grounded prompt builder used by /api/tests, so the
    // model can't see anything outside the provided context.
    const hasContext = Boolean(item.context?.trim());
    const promptToRun =
      testType === "rag" && hasContext
        ? buildRagPrompt(item.question, [{ text: item.context!.trim(), score: 1 }])
        : item.question;

    const outcomes = await Promise.allSettled(
      // Batch datasets multiply provider calls; allow one retry per call so a
      // provider failure doesn't keep the entire synchronous request waiting.
      modelIds.map((id) => callModel(id, promptToRun, { maxRetries: 1 }))
    );

    for (let i = 0; i < modelIds.length; i++) {
      const modelId = modelIds[i];
      const outcome = outcomes[i];
      const display = MODEL_DISPLAY[modelId] ?? { name: modelId, provider: "AI Provider" };

      if (outcome.status === "rejected" || isModelError(outcome.value)) {
        const errMsg =
          outcome.status === "rejected"
            ? String(outcome.reason)
            : (outcome.value as { error: string }).error;
        rowResults.push({
          itemId: item.id,
          modelId,
          modelName: display.name,
          response: `⚠️ Model call failed: ${errMsg}`,
          metrics: {},
          tokens: 0,
          latencyMs: 0,
          costUsd: 0,
          error: errMsg,
        });
        continue;
      }

      const call = outcome.value;
      const metrics: Partial<Record<BatchMetricKey, number>> = {};

      // Deterministic, reference-based metrics (free).
      if (item.reference?.trim()) {
        Object.assign(metrics, referenceMetrics(call.responseText, item.reference));
      }

      // LLM-judge metrics (optional, extra calls).
      let judgeNote: string | undefined;
      if (judgeMetrics) {
        const judgeJobs: Promise<{ key: BatchMetricKey; score: number; note: string }>[] = [];
        if (hasContext) {
          judgeJobs.push(
            evaluateFaithfulness(item.question, item.context!.trim(), call.responseText).then(
              (r) => ({ key: "faithfulness" as const, score: r.score, note: r.note })
            )
          );
        }
        judgeJobs.push(
          evaluateAnswerRelevance(item.question, call.responseText).then((r) => ({
            key: "answerRelevance" as const,
            score: r.score,
            note: r.note,
          }))
        );
        const judged = await Promise.all(judgeJobs);
        for (const j of judged) {
          metrics[j.key] = j.score;
          judgeNote = judgeNote ? `${judgeNote} ${j.note}` : j.note;
        }
      }

      rowResults.push({
        itemId: item.id,
        modelId,
        modelName: call.modelName,
        response: call.responseText,
        metrics,
        judgeNote,
        tokens: call.tokens,
        latencyMs: call.latencyMs,
        costUsd: call.costUsd,
      });
    }

    return rowResults;
  });

  const flat = perItem.flat();
  const { summaries, partialErrors } = buildSummaries(flat, modelIds, parsed.items);

  const batchId = `batch-${Date.now().toString(36)}`;
  const scope = await currentScope();
  const record: BatchTestRecord = {
    batchId,
    date: new Date().toISOString(),
    name,
    testType,
    ownerId: scope !== "local" ? scope : undefined,
    modelIds,
    items: parsed.items,
    perItem: flat,
    summaries,
    datasetErrors: parsed.errors.length > 0 ? parsed.errors : undefined,
    partialErrors: partialErrors.length > 0 ? partialErrors : undefined,
    truncated: parsed.truncated || undefined,
  };

  await saveBatch(record, scope);

  return NextResponse.json({
    batchId,
    record,
    partialErrors: partialErrors.length > 0 ? partialErrors : undefined,
  });
}

export async function GET() {
  const scope = await currentScope();
  const records = await listBatches(scope);
  return NextResponse.json(records);
}
