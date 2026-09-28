"use client";

import { useState } from "react";
import { TestResult } from "@/lib/types";
import { valueScoreOf, isFreeTierValue, FREE_TIER_VALUE_SCORE } from "@/lib/badges";
import { setResultFeedback } from "@/lib/api";
import ScoreBadge from "./ScoreBadge";

export default function ModelCard({
  result,
  testId,
}: {
  result: TestResult;
  testId: string;
}) {
  // valueScore may be missing on records saved before the field existed —
  // fall back to the shared guarded computation so the UI is always right.
  const valueScore = result.valueScore ?? valueScoreOf(result);
  const isFreeValue =
    isFreeTierValue(result) || valueScore >= FREE_TIER_VALUE_SCORE;
  const valueLabel = isFreeValue
    ? "Free"
    : valueScore >= 100 ? valueScore.toFixed(0) : valueScore.toFixed(1);

  // User's recorded agreement with the judge's score (optimistic local state).
  const [feedback, setFeedback] = useState<"agree" | "disagree" | null>(
    result.userFeedback ?? null
  );

  async function toggleFeedback(next: "agree" | "disagree") {
    const nextValue = feedback === next ? null : next; // clicking again clears
    const prev = feedback;
    setFeedback(nextValue); // optimistic
    try {
      await setResultFeedback(testId, result.modelId, nextValue);
    } catch {
      setFeedback(prev); // revert on failure
    }
  }

  // Static class strings so Tailwind's scanner picks them up.
  const THUMB_CLASSES: Record<"agree" | "disagree", { idle: string; active: string }> = {
    agree: {
      idle: "border-outline-variant text-on-surface-variant hover:border-secondary hover:text-secondary",
      active: "bg-secondary/15 border-secondary text-secondary",
    },
    disagree: {
      idle: "border-outline-variant text-on-surface-variant hover:border-error hover:text-error",
      active: "bg-error/15 border-error text-error",
    },
  };
  const thumbButtonClass = (kind: "agree" | "disagree") => {
    const cfg = THUMB_CLASSES[kind];
    return `w-7 h-7 inline-flex items-center justify-center rounded-full border transition-colors ${
      feedback === kind ? cfg.active : cfg.idle
    }`;
  };

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

      <div className="grid grid-cols-5 gap-px bg-outline-variant border-t border-outline-variant mt-auto">
        <Metric label="Score" value={result.qualityScore.toFixed(1)} suffix="/10" />
        <Metric
          label="Value"
          value={valueLabel}
          suffix={isFreeValue ? undefined : "Q/$"}
          emphasized={Boolean(result.isBestValue)}
        />
        <Metric label="Tokens" value={String(result.tokens)} />
        <Metric label="Latency" value={String(result.latencyMs)} suffix="ms" />
        <Metric label="Cost" value={result.costUsd.toFixed(3)} suffix="$" />
      </div>

      {result.reason && (
        <div className="px-sm py-sm border-t border-outline-variant/50 bg-surface-container-lowest flex items-start gap-1">
          <span className="material-symbols-outlined text-[14px] text-on-surface-variant">
            rate_review
          </span>
          <span className="font-body-sm text-body-sm text-on-surface-variant text-[12px] leading-snug line-clamp-2">
            {result.reason}
          </span>
        </div>
      )}

      <div className="px-sm py-sm border-t border-outline-variant/50 bg-surface-container-lowest flex items-center justify-between">
        <span className="font-body-sm text-body-sm text-on-surface-variant text-[11px] uppercase tracking-wider">
          Judge score
        </span>
        <div className="flex gap-1.5 items-center">
          {feedback && (
            <span className="font-mono-label text-[10px] text-on-surface-variant">
              {feedback === "agree" ? "agreed" : "disagreed"}
            </span>
          )}
          <button
            type="button"
            title="I agree with this score"
            aria-pressed={feedback === "agree"}
            onClick={() => void toggleFeedback("agree")}
            className={thumbButtonClass("agree")}
          >
            <span className="material-symbols-outlined text-[16px]">thumb_up</span>
          </button>
          <button
            type="button"
            title="I disagree with this score"
            aria-pressed={feedback === "disagree"}
            onClick={() => void toggleFeedback("disagree")}
            className={thumbButtonClass("disagree")}
          >
            <span className="material-symbols-outlined text-[16px]">thumb_down</span>
          </button>
        </div>
      </div>
    </article>
  );
}

function Metric({
  label,
  value,
  suffix,
  emphasized = false,
}: {
  label: string;
  value: string;
  suffix?: string;
  emphasized?: boolean;
}) {
  return (
    <div className="bg-surface-container-low p-sm md:p-md flex flex-col items-center justify-center">
      <span className="font-mono-label text-mono-label text-on-surface-variant text-[11px] uppercase">
        {label}
      </span>
      <span
        className={`font-mono-metric text-mono-metric mt-1 ${
          emphasized ? "text-secondary" : "text-on-surface"
        }`}
      >
        {value}
        {suffix && (
          <span className="text-xs text-on-surface-variant">{suffix}</span>
        )}
      </span>
    </div>
  );
}
