import { TestResult } from "@/lib/types";
import ScoreBadge from "./ScoreBadge";

export default function ModelCard({ result }: { result: TestResult }) {
  return (
    <article className="bg-surface-container-low border border-outline-variant rounded-lg flex flex-col h-full hover:border-outline transition-colors relative overflow-hidden">
      <div className="p-md md:p-lg border-b border-outline-variant flex flex-col gap-sm relative z-10">
        <div className="flex justify-between items-start w-full">
          <div>
            <h3 className="font-headline-sm text-headline-sm text-on-surface">
              {result.modelName}
            </h3>
            <span className="font-mono-label text-mono-label text-on-surface-variant">
              {result.modelVersion}
            </span>
          </div>
          <div className="flex gap-2 flex-wrap justify-end max-w-[55%]">
            {result.isBestQuality && <ScoreBadge kind="quality" />}
            {result.isFastest && <ScoreBadge kind="speed" />}
            {result.isBestValue && <ScoreBadge kind="value" />}
          </div>
        </div>
      </div>

      <div className="flex-1 p-md md:p-lg bg-surface-container-lowest">
        <div className="font-mono-label text-mono-label text-on-surface-variant mb-2 uppercase text-xs">
          Response Output
        </div>
        <div className="font-body-sm text-body-sm text-on-surface bg-surface-container p-sm rounded border border-outline-variant overflow-x-auto">
          <pre className="font-mono-label text-[12px] leading-relaxed text-on-surface whitespace-pre-wrap">
            <code>{result.responseText}</code>
          </pre>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-px bg-outline-variant border-t border-outline-variant mt-auto">
        <Metric label="Score" value={result.qualityScore.toFixed(1)} suffix="/10" />
        <Metric label="Tokens" value={String(result.tokens)} />
        <Metric label="Latency" value={String(result.latencyMs)} suffix="ms" />
        <Metric label="Cost" value={result.costUsd.toFixed(3)} suffix="$" />
      </div>
    </article>
  );
}

function Metric({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <div className="bg-surface-container-low p-sm md:p-md flex flex-col items-center justify-center">
      <span className="font-mono-label text-mono-label text-on-surface-variant text-[11px] uppercase">
        {label}
      </span>
      <span className="font-mono-metric text-mono-metric text-on-surface mt-1">
        {value}
        {suffix && (
          <span className="text-xs text-on-surface-variant">{suffix}</span>
        )}
      </span>
    </div>
  );
}
