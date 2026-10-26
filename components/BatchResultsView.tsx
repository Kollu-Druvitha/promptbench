"use client";

import { useEffect, useState } from "react";
import { BatchTestRecord, BatchMetricKey } from "@/lib/types";
import { getCachedBatchRecord } from "@/lib/api";

const METRIC_LABELS: Record<BatchMetricKey, string> = {
  exactMatch: "EM",
  rougeL: "ROUGE-L",
  bleu: "BLEU",
  faithfulness: "Faithfulness",
  answerRelevance: "Relevance",
};

function pct(v: number | undefined, places = 0): string {
  if (v === undefined || !Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(places)}%`;
}

function scoreColor(v: number | undefined): string {
  if (v === undefined || !Number.isFinite(v)) return "text-on-surface-variant";
  if (v >= 0.8) return "text-secondary";
  if (v >= 0.6) return "text-on-surface";
  return "text-error";
}

export default function BatchResultsView({
  batchId,
  initialRecord,
}: {
  batchId: string;
  initialRecord: BatchTestRecord | null;
}) {
  const [record, setRecord] = useState<BatchTestRecord | null>(initialRecord);

  // Client-side recovery: the server may have lost an ephemeral run (serverless
  // in-memory fallback), so fall back to the sessionStorage copy we saved on
  // submit — same trick as single-test results.
  useEffect(() => {
    if (record) return;
    const cached = getCachedBatchRecord(batchId);
    if (cached) setRecord(cached);
  }, [record, batchId]);

  if (!record) {
    return (
      <div className="p-gutter flex flex-col items-center justify-center gap-md text-center py-20">
        <span className="material-symbols-outlined text-[40px] text-on-surface-variant">
          folder_off
        </span>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          This batch run isn&apos;t available (it may have been created on a
          different device or the server restarted).
        </p>
      </div>
    );
  }

  const { items, summaries, perItem } = record;
  const hasReference = items.some((i) => i.reference?.trim());
  const hasContext = items.some((i) => i.context?.trim());
  const overallAvg =
    summaries.length > 0
      ? summaries.reduce((s, m) => s + m.overallScore, 0) / summaries.length
      : 0;
  const totalCost = summaries.reduce((s, m) => s + m.totalCostUsd, 0);
  const best = summaries[0]; // sorted by overallScore desc

  const applicableMetrics: BatchMetricKey[] = [];
  if (hasReference) applicableMetrics.push("exactMatch", "rougeL", "bleu");
  if (hasContext) applicableMetrics.push("faithfulness");
  applicableMetrics.push("answerRelevance");

  return (
    <div className="p-gutter flex-1 space-y-xl overflow-y-auto max-w-container-max w-full mx-auto">
      {/* Header meta */}
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-headline-sm text-headline-sm text-on-surface">{record.name}</h3>
        <span className="px-2 py-0.5 rounded-full bg-surface-container border border-outline-variant font-mono-label text-[10px] text-on-surface-variant uppercase tracking-wider">
          {record.testType}
        </span>
        <span className="px-2 py-0.5 rounded-full bg-secondary-container/10 border border-secondary-container/30 text-secondary-fixed font-mono-label text-[10px] uppercase tracking-wider">
          {new Date(record.date).toISOString().slice(0, 16).replace("T", " ")} UTC
        </span>
      </div>

      {record.datasetErrors && record.datasetErrors.length > 0 && (
        <div className="flex items-start gap-2 px-md py-sm rounded border border-outline-variant bg-surface-container-low font-body-sm text-[12px] text-on-surface-variant">
          <span className="material-symbols-outlined text-[16px] mt-0.5">info</span>
          <ul className="space-y-0.5">
            {record.datasetErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {record.partialErrors && record.partialErrors.length > 0 && (
        <div className="flex items-start gap-2 px-md py-sm rounded border border-error/30 bg-error/10 font-body-sm text-[12px] text-error">
          <span className="material-symbols-outlined text-[16px] mt-0.5">error</span>
          <ul className="space-y-0.5">
            {record.partialErrors.map((e) => (
              <li key={e.modelId}>
                <strong>{e.modelId}</strong> failed on every row — {e.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Summary stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-md">
        <StatCard label="Dataset rows" value={String(items.length)} icon="dataset" />
        <StatCard label="Models tested" value={String(summaries.length)} icon="smart_toy" />
        <StatCard
          label="Avg overall score"
          value={pct(overallAvg, 1)}
          icon="speed"
          accent={overallAvg >= 0.6 ? "text-secondary" : "text-error"}
        />
        <StatCard label="Total cost" value={`$${totalCost.toFixed(3)}`} icon="payments" />
      </section>

      {/* Winner callout */}
      {best && (
        <div className="flex items-center gap-md px-md py-sm rounded-lg border border-secondary/30 bg-secondary/10">
          <span className="material-symbols-outlined text-secondary">emoji_events</span>
          <p className="font-body-sm text-body-sm text-on-surface">
            <strong className="text-secondary">{best.modelName}</strong> is the top
            performer on this dataset with an overall score of{" "}
            <strong>{pct(best.overallScore, 1)}</strong> across {best.itemCount} rows
            {best.errorCount > 0 ? ` (${best.errorCount} failed rows)` : ""}.
          </p>
        </div>
      )}

      {/* Per-model metrics table */}
      <section className="bg-surface border border-outline-variant rounded-lg overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-outline-variant bg-surface-container-lowest">
              <th className="px-md py-sm font-mono-label text-[10px] text-on-surface-variant uppercase tracking-wider">
                Model
              </th>
              <th className="px-md py-sm font-mono-label text-[10px] text-on-surface-variant uppercase tracking-wider">
                Overall
              </th>
              {applicableMetrics.map((key) => (
                <th
                  key={key}
                  className="px-md py-sm font-mono-label text-[10px] text-on-surface-variant uppercase tracking-wider"
                >
                  {METRIC_LABELS[key]}
                </th>
              ))}
              <th className="px-md py-sm font-mono-label text-[10px] text-on-surface-variant uppercase tracking-wider">
                Tokens
              </th>
              <th className="px-md py-sm font-mono-label text-[10px] text-on-surface-variant uppercase tracking-wider">
                Latency
              </th>
              <th className="px-md py-sm font-mono-label text-[10px] text-on-surface-variant uppercase tracking-wider">
                Cost
              </th>
              <th className="px-md py-sm font-mono-label text-[10px] text-on-surface-variant uppercase tracking-wider">
                Errors
              </th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((m) => (
              <tr
                key={m.modelId}
                className="border-b border-outline-variant/50 last:border-b-0 hover:bg-surface-container-low/50 transition-colors"
              >
                <td className="px-md py-sm">
                  <div className="font-mono-label text-mono-label text-on-surface">
                    {m.modelName}
                  </div>
                  <div className="font-mono-label text-[10px] text-on-surface-variant">
                    {m.provider}
                  </div>
                </td>
                <td className={`px-md py-sm font-mono-metric text-mono-metric ${scoreColor(m.overallScore)}`}>
                  {pct(m.overallScore, 1)}
                </td>
                {applicableMetrics.map((key) => (
                  <td key={key} className={`px-md py-sm font-mono-metric text-mono-metric ${scoreColor(m.metrics[key])}`}>
                    {pct(m.metrics[key], 1)}
                  </td>
                ))}
                <td className="px-md py-sm font-mono-metric text-mono-metric text-on-surface">
                  {m.totalTokens.toLocaleString()}
                </td>
                <td className="px-md py-sm font-mono-metric text-mono-metric text-on-surface">
                  {Math.round(m.totalLatencyMs).toLocaleString()} ms
                </td>
                <td className="px-md py-sm font-mono-metric text-mono-metric text-on-surface">
                  ${m.totalCostUsd.toFixed(3)}
                </td>
                <td className="px-md py-sm font-mono-metric text-mono-metric text-on-surface">
                  {m.errorCount > 0 ? (
                    <span className="text-error">{m.errorCount}</span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Per-item breakdown */}
      <section className="space-y-md">
        <h3 className="font-headline-sm text-headline-sm text-on-surface">Per-item breakdown</h3>
        {items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            rows={perItem.filter((r) => r.itemId === item.id)}
          />
        ))}
      </section>
    </div>
  );
}

function ItemCard({
  item,
  rows,
}: {
  item: BatchTestRecord["items"][number];
  rows: BatchTestRecord["perItem"];
}) {
  return (
    <article className="bg-surface-container-low border border-outline-variant rounded-lg overflow-hidden">
      <div className="p-md border-b border-outline-variant bg-surface-container-lowest">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono-label text-[10px] text-on-surface-variant uppercase tracking-wider">
            {item.id}
          </span>
          {item.reference?.trim() && (
            <span className="px-1.5 py-0.5 rounded bg-surface-container border border-outline-variant font-mono-label text-[10px] text-on-surface-variant">
              has reference
            </span>
          )}
          {item.context?.trim() && (
            <span className="px-1.5 py-0.5 rounded bg-secondary-container/10 border border-secondary-container/30 text-secondary-fixed font-mono-label text-[10px]">
              RAG context
            </span>
          )}
        </div>
        <p className="font-body-sm text-body-sm text-on-surface whitespace-pre-wrap">
          {item.question}
        </p>
        {item.reference?.trim() && (
          <p className="font-mono-label text-[11px] text-on-surface-variant mt-2">
            <span className="uppercase tracking-wider">Reference: </span>
            <span className="whitespace-pre-wrap">{item.reference}</span>
          </p>
        )}
        {item.context?.trim() && (
          <p className="font-mono-label text-[11px] text-on-surface-variant mt-2 line-clamp-3">
            <span className="uppercase tracking-wider">Context: </span>
            {item.context}
          </p>
        )}
      </div>

      <div className="divide-y divide-outline-variant/50">
        {rows.map((row) => (
          <div key={`${row.itemId}-${row.modelId}`} className="p-md space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono-label text-mono-label text-on-surface">
                {row.modelName}
              </span>
              {row.error ? (
                <span className="px-1.5 py-0.5 rounded bg-error/10 border border-error/30 text-error font-mono-label text-[10px]">
                  failed
                </span>
              ) : (
                Object.entries(row.metrics).map(([key, v]) => (
                  <span
                    key={key}
                    className={`px-1.5 py-0.5 rounded border font-mono-label text-[10px] ${
                      (v ?? 0) >= 0.8
                        ? "bg-secondary/10 border-secondary/30 text-secondary"
                        : (v ?? 0) >= 0.6
                          ? "bg-surface-container border-outline-variant text-on-surface"
                          : "bg-error/10 border-error/30 text-error"
                    }`}
                  >
                    {METRIC_LABELS[key as BatchMetricKey]}: {pct(v, 0)}
                  </span>
                ))
              )}
              <span className="ml-auto font-mono-label text-[10px] text-on-surface-variant">
                {row.latencyMs} ms · {row.tokens} tok · ${row.costUsd.toFixed(4)}
              </span>
            </div>
            {row.judgeNote && (
              <p className="font-body-sm text-[12px] text-on-surface-variant italic">
                {row.judgeNote}
              </p>
            )}
            <pre className="font-mono-label text-[12px] leading-relaxed text-on-surface bg-surface-container rounded p-sm border border-outline-variant overflow-x-auto whitespace-pre-wrap">
              {row.response}
            </pre>
          </div>
        ))}
      </div>
    </article>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent = "text-on-surface",
}: {
  label: string;
  value: string;
  icon: string;
  accent?: string;
}) {
  return (
    <div className="bg-surface border border-outline-variant rounded-lg p-md flex flex-col justify-between h-28 relative overflow-hidden">
      <div className="flex justify-between items-start relative z-10">
        <span className="font-mono-label text-mono-label text-on-surface-variant uppercase tracking-wider">
          {label}
        </span>
        <span className="material-symbols-outlined text-outline-variant">{icon}</span>
      </div>
      <div className={`font-mono-metric text-display-md relative z-10 ${accent}`}>
        {value}
      </div>
    </div>
  );
}
