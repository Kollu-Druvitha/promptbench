"use client";

import { useState } from "react";
import { TestRecord } from "@/lib/types";
import ModelCard from "./ModelCard";
import ComparisonTable from "./ComparisonTable";

export default function ResultsView({ record }: { record: TestRecord }) {
  const [view, setView] = useState<"grid" | "table">("grid");

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
            <ModelCard key={r.modelId} result={r} />
          ))}
        </section>
      ) : (
        <ComparisonTable results={record.results} />
      )}
    </>
  );
}
