"use client";

import { useEffect, useState } from "react";
import { TestRecord } from "@/lib/types";
import { getCachedTestRecord, getTestResults } from "@/lib/api";
import { valueScoreOf, isFreeTierValue, FREE_TIER_VALUE_SCORE } from "@/lib/badges";
import ModelCard from "./ModelCard";
import ComparisonTable from "./ComparisonTable";

/**
 * Results viewer with client-side recovery.
 *
 * The server renderer does a best-effort lookup by testId; if the record isn't
 * found there (e.g. a serverless instance whose in-memory fallback lost the
 * run), this component recovers it from the session cache the submit flow
 * populated — and finally from GET /api/tests/[testId]. Only when all three
 * miss do we show a friendly "run not found" state instead of a hard 404.
 */
export default function ResultsView({
  testId,
  record: serverRecord,
}: {
  testId: string;
  record: TestRecord | null;
}) {
  const [record, setRecord] = useState<TestRecord | null>(serverRecord);
  const [status, setStatus] = useState<"ready" | "loading" | "error">(
    serverRecord ? "ready" : "loading"
  );
  const [view, setView] = useState<"grid" | "table">("grid");

  useEffect(() => {
    if (serverRecord) return;
    let cancelled = false;
    async function recover() {
      const cached = getCachedTestRecord(testId);
      if (cached) {
        if (!cancelled) {
          setRecord(cached);
          setStatus("ready");
        }
        return;
      }
      const fetched = await getTestResults(testId);
      if (cancelled) return;
      if (fetched) {
        setRecord(fetched);
        setStatus("ready");
      } else {
        setStatus("error");
      }
    }
    void recover();
    return () => {
      cancelled = true;
    };
  }, [testId, serverRecord]);

  if (status === "loading" && !record) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <span className="material-symbols-outlined text-outline-variant text-[40px] mb-3">
          hourglass_empty
        </span>
        <p className="font-mono-label text-mono-label text-on-surface-variant">
          Loading results…
        </p>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <span className="material-symbols-outlined text-outline-variant text-[40px] mb-3">
          search_off
        </span>
        <p className="font-body-sm text-body-sm text-on-surface-variant mb-4">
          This run isn&apos;t available — it may have been created on a session
          that stored its data temporarily (no persistent database is configured
          yet).
        </p>
        <a
          href="/"
          className="px-4 py-2 rounded border border-outline-variant text-on-surface hover:bg-surface-bright font-mono-label text-mono-label transition-colors"
        >
          Run a new test
        </a>
      </div>
    );
  }

  // The one-number answer to "which model is the best buy": the highest
  // quality-per-cost metric (free-tier results use the bounded sentinel).
  const scored = record.results.filter((r) => r.qualityScore > 0);
  const bestValue =
    scored.length > 0
      ? scored.reduce((a, b) => (valueScoreOf(b) > valueScoreOf(a) ? b : a))
      : null;
  const bestValueScore = bestValue ? valueScoreOf(bestValue) : 0;
  const bestValueLabel =
    bestValue &&
    (isFreeTierValue(bestValue) || bestValueScore >= FREE_TIER_VALUE_SCORE)
      ? "Free"
      : bestValue
        ? `${bestValueScore.toFixed(1)} Q/$`
        : "";

  return (
    <>
      <div className="flex items-center justify-between mb-lg">
        <div className="font-mono-label text-mono-label text-on-surface-variant">
          {record.testId} &middot; {record.testType.toUpperCase()}
        </div>
        <div className="flex bg-surface-container-low border border-outline-variant rounded overflow-hidden">
          <button
            onClick={() => setView("grid")}
            className={`px-3 py-1.5 font-mono-label text-mono-label transition-colors ${
              view === "grid"
                ? "bg-surface-bright text-on-surface"
                : "text-on-surface-variant"
            }`}
          >
            Cards
          </button>
          <button
            onClick={() => setView("table")}
            className={`px-3 py-1.5 font-mono-label text-mono-label transition-colors ${
              view === "table"
                ? "bg-surface-bright text-on-surface"
                : "text-on-surface-variant"
            }`}
          >
            Table
          </button>
        </div>
      </div>

      {bestValue && (
        <div className="bg-surface-container border border-primary/40 rounded-lg p-md mb-lg flex items-center justify-between gap-md">
          <div className="flex items-center gap-sm">
            <span className="material-symbols-outlined text-primary text-[22px]">
              savings
            </span>
            <div>
              <div className="font-mono-label text-mono-label text-on-surface uppercase tracking-wider">
                Best Value
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {bestValue.modelName} offers the most quality per dollar this run
                {bestValueLabel === "Free" ? " — free tier." : "."}
              </p>
            </div>
          </div>
          <span
            className={`inline-flex items-center px-3 py-1.5 rounded-full border font-mono-metric text-mono-metric whitespace-nowrap ${
              bestValueLabel === "Free"
                ? "text-secondary bg-secondary/10 border-secondary"
                : "text-on-surface bg-surface-container-high border-outline-variant"
            }`}
          >
            {bestValueLabel}
            {bestValueLabel === "Free" ? null : (
              <span className="text-xs text-on-surface-variant"> Q/$</span>
            )}
          </span>
        </div>
      )}

      <div className="bg-surface-container border border-outline-variant rounded-lg p-md mb-lg">
        <div className="font-mono-label text-mono-label text-on-surface-variant uppercase text-xs mb-2">
          Prompt
        </div>
        <p className="font-body-sm text-body-sm text-on-surface whitespace-pre-wrap">
          {record.prompt}
        </p>
      </div>

      {record.retrievedContext && (
        <div className="bg-surface-container border border-outline-variant rounded-lg p-md mb-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="font-mono-label text-mono-label text-on-surface-variant uppercase text-xs">
              Retrieved Context (RAG)
              {record.contextFileName ? ` · ${record.contextFileName}` : ""}
            </div>
            {record.retrievalMode && (
              <span
                className={`px-2 py-0.5 rounded-full font-mono-label text-[10px] uppercase tracking-wider border ${
                  record.retrievalMode === "vector"
                    ? "text-tertiary bg-tertiary-container/40 border-tertiary-fixed-dim/40"
                    : "text-on-surface-variant bg-surface-container-low border-outline-variant"
                }`}
              >
                {record.retrievalMode === "vector"
                  ? "Semantic · embeddings"
                  : "TF-IDF"}
              </span>
            )}
          </div>
          <pre className="font-mono-label text-[12px] leading-relaxed text-on-surface whitespace-pre-wrap max-h-64 overflow-y-auto custom-scrollbar">
            {record.retrievedContext}
          </pre>
        </div>
      )}

      {view === "grid" ? (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
          {record.results.map((r) => (
            <ModelCard key={r.modelId} result={r} testId={record.testId} />
          ))}
        </section>
      ) : (
        <ComparisonTable results={record.results} />
      )}
    </>
  );
}