"use client";

import { useEffect, useState } from "react";
import { TestRecord } from "@/lib/types";
import { listCachedTestRecords } from "@/lib/api";
import HistoryTable from "./HistoryTable";

interface HistoryStats {
  totalTestsRun: number;
  totalSpend: number;
  mostUsedModel: string;
}

function computeStats(records: TestRecord[]): HistoryStats {
  const totalTestsRun = records.length;
  const totalSpend = records.reduce((sum, t) => sum + (t.totalCost ?? 0), 0);
  const modelCounts: Record<string, number> = {};
  for (const t of records) {
    for (const m of t.modelsUsed ?? []) {
      modelCounts[m] = (modelCounts[m] ?? 0) + 1;
    }
  }
  const mostUsedModel =
    Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
  return { totalTestsRun, totalSpend, mostUsedModel };
}

/**
 * History with client-side recovery.
 *
 * The server renders whatever runs are in its (possibly ephemeral) storage,
 * then this component merges in the runs this browser cached after submitting
 * them (see lib/api.ts cacheTestRecord). That way a test you just ran shows up
 * in History immediately — even while the host runs the temporary in-memory
 * storage backend. Durable persistence (Upstash Redis) still makes History
 * global and permanent; this just guarantees the current session is coherent.
 */
export default function HistoryView({
  initialRecords,
  initialStats,
}: {
  initialRecords: TestRecord[];
  initialStats: HistoryStats;
}) {
  const [records, setRecords] = useState<TestRecord[]>(initialRecords);
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    const cached = listCachedTestRecords();
    if (cached.length === 0) return;
    // Merge, preferring the server copy for shared ids, then sort newest first.
    const merged = new Map<string, TestRecord>();
    for (const r of initialRecords) merged.set(r.testId, r);
    for (const r of cached) merged.set(r.testId, r);
    const list = [...merged.values()].sort((a, b) =>
      a.date < b.date ? 1 : a.date > b.date ? -1 : 0
    );
    setRecords(list);
    setFromCache(true);
  }, [initialRecords]);

  const stats = computeStats(records);

  return (
    <div className="p-gutter flex-1 space-y-xl overflow-y-auto max-w-container-max w-full mx-auto">
      {fromCache && (
        <div className="flex items-center gap-2 px-md py-sm rounded border border-outline-variant bg-surface-container-low font-mono-label text-[11px] text-on-surface-variant">
          <span className="material-symbols-outlined text-[14px]">info</span>
          Including recent runs cached in this browser. Add persistent storage
          (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN) to keep history
          permanently across devices.
        </div>
      )}

      <section className="grid grid-cols-1 md:grid-cols-3 gap-md">
        <StatCard
          label="Total Tests Run"
          value={stats.totalTestsRun.toLocaleString()}
          icon="stacked_line_chart"
        />
        <StatCard
          label="Total Spend"
          value={`$${stats.totalSpend.toFixed(2)}`}
          icon="payments"
        />
        <StatCard
          label="Most Used Model"
          value={stats.mostUsedModel}
          icon="smart_toy"
          valueIsPill
        />
      </section>

      <HistoryTable records={records} />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  valueIsPill,
}: {
  label: string;
  value: string;
  icon: string;
  valueIsPill?: boolean;
}) {
  return (
    <div className="bg-surface border border-outline-variant rounded-lg p-md flex flex-col justify-between h-32 relative overflow-hidden group">
      <div className="flex justify-between items-start relative z-10">
        <span className="font-mono-label text-mono-label text-on-surface-variant uppercase tracking-wider">
          {label}
        </span>
        <span className="material-symbols-outlined text-outline-variant">
          {icon}
        </span>
      </div>
      {valueIsPill ? (
        <span className="inline-flex w-fit items-center px-3 py-1 rounded bg-secondary-container/10 border border-secondary-container/30 text-secondary-fixed font-mono-metric text-mono-metric relative z-10">
          {value}
        </span>
      ) : (
        <div className="font-mono-metric text-display-lg text-on-surface relative z-10">
          {value}
        </div>
      )}
    </div>
  );
}