import { TestResult } from "@/lib/types";
import { valueScoreOf, isFreeTierValue, FREE_TIER_VALUE_SCORE } from "@/lib/badges";

export default function ComparisonTable({ results }: { results: TestResult[] }) {
  const isError = (r: TestResult) => r.responseText.startsWith("⚠️ Model Call Failed");

  const renderValue = (r: TestResult) => {
    if (isError(r)) return "N/A";
    const vs = valueScoreOf(r);
    if (vs >= FREE_TIER_VALUE_SCORE || isFreeTierValue(r)) return "Free";
    return vs.toFixed(1);
  };

  const rows: { label: string; render: (r: TestResult) => string; highlight: (r: TestResult, all: TestResult[]) => boolean }[] = [
    {
      label: "Quality Score",
      render: (r) => (isError(r) ? "Error" : r.qualityScore.toFixed(1)),
      highlight: (r) => Boolean(r.isBestQuality) && !isError(r),
    },
    {
      label: "Value (Q/$)",
      render: renderValue,
      highlight: (r) => Boolean(r.isBestValue) && !isError(r),
    },
    {
      label: "Judge's Reasoning",
      render: (r) => (isError(r) ? "—" : r.reason?.trim() ? r.reason : "—"),
      highlight: () => false,
    },
    {
      label: "Tokens Used",
      render: (r) => (isError(r) ? "N/A" : String(r.tokens)),
      highlight: () => false,
    },
    {
      label: "Latency (ms)",
      render: (r) => (isError(r) ? "N/A" : String(r.latencyMs)),
      highlight: (r) => Boolean(r.isFastest) && !isError(r),
    },
    {
      label: "Cost (USD)",
      render: (r) => (isError(r) ? "N/A" : `$${r.costUsd.toFixed(3)}`),
      highlight: (r) => Boolean(r.isBestValue) && !isError(r),
    },
  ];

  return (
    <section className="w-full overflow-x-auto bg-surface-container-low border border-outline-variant rounded-lg">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-outline-variant bg-surface-container-lowest">
            <th className="p-4 font-headline-sm text-headline-sm text-on-surface font-normal">
              Metric
            </th>
            {results.map((r) => (
              <th
                key={r.modelId}
                className="p-4 font-headline-sm text-headline-sm text-on-surface font-normal"
              >
                {r.modelName}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="font-mono-metric text-mono-metric text-on-surface">
          {rows.map((row, i) => (
            <tr
              key={row.label}
              className={i < rows.length - 1 ? "border-b border-outline-variant" : ""}
            >
              <td className="p-4 font-body-sm text-body-sm text-on-surface-variant font-medium">
                {row.label}
              </td>
              {results.map((r) => (
                <td
                  key={r.modelId}
                  className={`p-4 ${row.highlight(r, results) ? "text-secondary" : ""}`}
                >
                  {row.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
