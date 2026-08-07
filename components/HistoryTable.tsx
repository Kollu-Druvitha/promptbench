import Link from "next/link";
import { TestRecord } from "@/lib/types";

const DOT_COLORS: Record<string, string> = {
  "gemini-2.5-flash": "bg-secondary-fixed",
  "llama-3.3-70b": "bg-tertiary-fixed-dim",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toISOString().slice(0, 16).replace("T", " ");
}

export default function HistoryTable({ records }: { records: TestRecord[] }) {
  return (
    <section className="bg-surface border border-outline-variant rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-outline-variant bg-surface-container-low/50">
              <th className="p-md font-mono-label text-mono-label text-on-surface-variant font-normal">
                Test ID
              </th>
              <th className="p-md font-mono-label text-mono-label text-on-surface-variant font-normal">
                Date (UTC)
              </th>
              <th className="p-md font-mono-label text-mono-label text-on-surface-variant font-normal w-1/3">
                Prompt Snippet
              </th>
              <th className="p-md font-mono-label text-mono-label text-on-surface-variant font-normal">
                Models Assessed
              </th>
              <th className="p-md font-mono-label text-mono-label text-on-surface-variant font-normal">
                Winning Model
              </th>
              <th className="p-md font-mono-label text-mono-label text-on-surface-variant font-normal text-right">
                Cost
              </th>
            </tr>
          </thead>
          <tbody className="font-body-sm text-body-sm text-on-surface divide-y divide-outline-variant/50">
            {records.map((record) => (
              <tr
                key={record.testId}
                className="hover:bg-surface-bright transition-colors group"
              >
                <td className="p-md align-middle">
                  <Link
                    href={`/results/${record.testId}`}
                    className="font-mono-label text-mono-label text-primary group-hover:underline"
                  >
                    {record.testId}
                  </Link>
                </td>
                <td className="p-md align-middle whitespace-nowrap">
                  <span className="font-mono-label text-mono-label text-on-surface-variant">
                    {formatDate(record.date)}
                  </span>
                </td>
                <td className="p-md align-middle">
                  <p className="truncate max-w-xs text-on-surface-variant">
                    {record.prompt}
                  </p>
                </td>
                <td className="p-md align-middle">
                  <div className="flex gap-1 flex-wrap">
                    {record.modelsUsed.map((m) => (
                      <span
                        key={m}
                        className="px-2 py-0.5 rounded border border-outline-variant bg-surface-container text-on-surface font-mono-label text-[10px]"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="p-md align-middle">
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        DOT_COLORS[record.bestModel] ?? "bg-secondary-fixed"
                      }`}
                    />
                    <span className="font-mono-label text-mono-label text-secondary-fixed">
                      {record.bestModel}
                    </span>
                  </div>
                </td>
                <td className="p-md align-middle text-right">
                  <span className="font-mono-metric text-mono-metric text-on-surface-variant">
                    ${record.totalCost.toFixed(2)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-4 border-t border-outline-variant/50 bg-surface-container-lowest flex items-center justify-between">
        <span className="font-mono-label text-mono-label text-on-surface-variant">
          Showing 1 to {records.length} of {records.length}
        </span>
        <div className="flex gap-2">
          <button
            disabled
            className="px-3 py-1 rounded border border-outline-variant text-on-surface-variant hover:bg-surface-bright font-mono-label text-mono-label disabled:opacity-50"
          >
            Prev
          </button>
          <button className="px-3 py-1 rounded border border-outline-variant text-on-surface hover:bg-surface-bright font-mono-label text-mono-label">
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
