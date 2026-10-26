"use client";

import Link from "next/link";
import { BatchTestRecord } from "@/lib/types";

export default function BatchHistoryTable({
  initialBatches,
}: {
  initialBatches: BatchTestRecord[];
}) {
  if (initialBatches.length === 0) {
    return (
      <div className="bg-surface border border-outline-variant rounded-lg p-lg flex flex-col items-center gap-sm text-center py-10">
        <span className="material-symbols-outlined text-[32px] text-on-surface-variant">
          dataset
        </span>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          No dataset evaluations yet. Upload a CSV/JSON above to run your first
          batch test.
        </p>
      </div>
    );
  }

  return (
    <section className="bg-surface border border-outline-variant rounded-lg overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-outline-variant bg-surface-container-lowest">
            <th className="px-md py-sm font-mono-label text-[10px] text-on-surface-variant uppercase tracking-wider">
              Name
            </th>
            <th className="px-md py-sm font-mono-label text-[10px] text-on-surface-variant uppercase tracking-wider">
              Date
            </th>
            <th className="px-md py-sm font-mono-label text-[10px] text-on-surface-variant uppercase tracking-wider">
              Type
            </th>
            <th className="px-md py-sm font-mono-label text-[10px] text-on-surface-variant uppercase tracking-wider">
              Rows
            </th>
            <th className="px-md py-sm font-mono-label text-[10px] text-on-surface-variant uppercase tracking-wider">
              Models
            </th>
            <th className="px-md py-sm font-mono-label text-[10px] text-on-surface-variant uppercase tracking-wider">
              Top model
            </th>
            <th className="px-md py-sm font-mono-label text-[10px] text-on-surface-variant uppercase tracking-wider">
              Overall
            </th>
          </tr>
        </thead>
        <tbody>
          {initialBatches.map((b) => {
            const best = b.summaries[0];
            return (
              <tr
                key={b.batchId}
                className="border-b border-outline-variant/50 last:border-b-0 hover:bg-surface-container-low/50 transition-colors"
              >
                <td className="px-md py-sm">
                  <Link
                    href={`/batch/${b.batchId}`}
                    className="font-mono-label text-mono-label text-on-surface hover:text-primary transition-colors"
                  >
                    {b.name}
                  </Link>
                </td>
                <td className="px-md py-sm font-mono-label text-[11px] text-on-surface-variant">
                  {new Date(b.date).toISOString().slice(0, 16).replace("T", " ")} UTC
                </td>
                <td className="px-md py-sm">
                  <span className="px-1.5 py-0.5 rounded bg-surface-container border border-outline-variant font-mono-label text-[10px] text-on-surface-variant uppercase">
                    {b.testType}
                  </span>
                </td>
                <td className="px-md py-sm font-mono-metric text-mono-metric text-on-surface">
                  {b.items.length}
                </td>
                <td className="px-md py-sm font-mono-metric text-mono-metric text-on-surface">
                  {b.modelIds.length}
                </td>
                <td className="px-md py-sm font-mono-label text-mono-label text-on-surface">
                  {best ? best.modelName : "—"}
                </td>
                <td className="px-md py-sm font-mono-metric text-mono-metric text-on-surface">
                  {best ? `${(best.overallScore * 100).toFixed(1)}%` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
