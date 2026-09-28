"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  RecommendationPayload,
  RecommendationPriority,
  RecommendationWeights,
} from "@/lib/server/recommender";
import { TestType } from "@/lib/types";
import { updatePrefs } from "@/lib/api";

const PRIORITIES: { id: RecommendationPriority; label: string; icon: string }[] = [
  { id: "quality", label: "Quality", icon: "workspace_premium" },
  { id: "speed", label: "Speed", icon: "bolt" },
  { id: "value", label: "Value", icon: "savings" },
];

const TYPE_OPTIONS: { id: TestType; label: string }[] = [
  { id: "rag", label: "RAG" },
  { id: "coding", label: "Coding" },
  { id: "summarization", label: "Summarization" },
  { id: "qa", label: "QA" },
];
// Test-type chips live in the server page; TYPE_OPTIONS kept for reference.

export default function LeaderboardView({
  testType,
  payloads,
  totalTests,
  weights,
  isLoggedIn,
}: {
  testType: TestType;
  payloads: RecommendationPayload[];
  totalTests: number;
  weights: RecommendationWeights;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const [priority, setPriority] = useState<RecommendationPriority>("quality");
  const payload = payloads.find((p) => p.priority === priority) ?? payloads[0];
  const [top] = payload?.recommendation ?? [];

  function bumpWeight(
    axis: "quality" | "speed" | "value",
    delta: number
  ) {
    const next = {
      ...weights,
      [axis]: Math.max(0.5, Math.min(3, weights[axis] + delta)),
    };
    void updatePrefs(next).then(() => router.refresh());
  }

  return (
    <div className="flex flex-col gap-gutter">
      {/* Priority pills */}
      <div className="flex gap-2 flex-wrap">
        {PRIORITIES.map((p) => (
          <button
            key={p.id}
            onClick={() => setPriority(p.id)}
            className={`px-3 py-1 rounded-full font-mono-label text-mono-label transition-colors ${
              p.id === priority
                ? "bg-surface-bright text-on-primary border-primary/40"
                : "text-on-surface-variant bg-surface-container-lowest border-outline-variant hover:bg-surface-container-high"
            }`}
          >
            <span className="material-symbols-outlined text-[14px] mr-1">
              {p.icon}
            </span>
            {p.label}
          </button>
        ))}
      </div>

      {/* Personalization editor */}
      <div className="bg-surface-container border border-outline-variant rounded-lg p-md">
        <div className="flex items-center justify-between mb-sm">
          <div className="font-mono text-mono text-on-surface uppercase tracking-wider flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">tune</span>
            Your workspace · recommendation weights
          </div>
          {!isLoggedIn && (
            <span className="font-mono text-[10px] text-on-surface-variant">
              sign in to save workspace weighting
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {PRIORITIES.map((p) => (
            <div
              key={p.id}
              className="bg-surface-container-low rounded border border-outline-variant p-2 flex flex-col items-center gap-1"
            >
              <span className="font-mono text-[10px] text-on-surface-variant uppercase">
                {p.label}
              </span>
              <span className="font-mono-metric text-mono-metric text-on-surface">
                {weights[p.id]}×
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => bumpWeight(p.id, -0.5)}
                  className="px-2 py-0.5 rounded border border-outline-variant text-on-surface-variant hover:bg-surface-bright disabled:opacity-40"
                  disabled={!isLoggedIn || weights[p.id] <= 0.5}
                >
                  −
                </button>
                <button
                  onClick={() => bumpWeight(p.id, 0.5)}
                  className="px-2 py-0.5 rounded border border-outline-variant text-on-surface-variant hover:bg-surface-bright disabled:opacity-40"
                  disabled={!isLoggedIn || weights[p.id] >= 3}
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
{/* ML explainer banner */}
      <div className="bg-surface-container border border-outline-variant rounded-lg p-md flex items-start gap-sm">
        <span className="material-symbols-outlined text-tertiary-fixed-dim">
          psychology
        </span>
        <div className="flex flex-col gap-xs">
          <div className="font-mono-label text-mono-label text-on-surface uppercase tracking-wider">
            Trained on {payload?.observations ?? 0} responses · {payload?.method}
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            This recommender does not hand-pick a winner — it <em>fits</em> a
            distribution over every stored result for a task type, shrinks each
            estimate toward the prior (so a lucky one-run model cannot
            dominate), then <em>predicts</em> the highest-utility model for the
            priority you choose. Same idea as RouteLLM / Martian / LiteLLM.
          </p>
        </div>
      </div>

      {top ? (
        <div className="bg-surface-container border border-outline-variant rounded-lg overflow-hidden">
          <div className="p-md border-b border-outline-variant flex items-center justify-between">
            <h3 className="font-mono-label text-mono-label text-on-surface uppercase tracking-wider">
              Leaderboard · {testType}
            </h3>
            <span className="font-mono-label text-mono-label text-on-surface-variant">
              {totalTests} tests
            </span>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant bg-surface-container-lowest font-mono-label text-mono-label text-on-surface-variant">
                <th className="p-3">Model</th>
                <th className="p-3 text-right">Runs</th>
                <th className="p-3 text-right">Quality</th>
                <th className="p-3 text-right">Latency</th>
                <th className="p-3 text-right">Cost / 1k</th>
                <th className="p-3 text-right">Win%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/50 font-mono-metric text-mono-metric text-on-surface">
              {payload?.leaderboard.map((row) => (
                <tr
                  key={row.model}
                  className={row.model === top.model ? "bg-surface-bright/40" : ""}
                >
                  <td className="p-3">
                    <div className="flex flex-col items-start gap-0.5">
                      <span className="font-mono-label text-mono-label">
                        {row.name}{" "}
                        {row.model === top.model && (
                          <span className="text-tertiary">★</span>
                        )}
                      </span>
                      <span className="font-mono-label text-[10px] text-on-surface-variant">
                        based on {row.count} run{row.count === 1 ? "" : "s"}
                        {row.count < 3 && (
                          <span className="px-1.5 py-0.5 ml-1 rounded bg-surface-container-low border border-outline-variant text-[10px] text-error">
                            Low confidence — try more tests
                          </span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="p-3 text-right">{row.count}</td>
                  <td className="p-3 text-right">{row.quality.toFixed(1)}</td>
                  <td className="p-3 text-right">{row.latencyMs.toFixed(0)} ms</td>
                  <td className="p-3 text-right">${row.costUsd.toFixed(4)}</td>
                  <td className="p-3 text-right">{Math.round(row.winRate * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-surface border border-outline-variant rounded-lg p-lg flex flex-col items-center justify-center gap-sm text-center">
          <span className="material-symbols-outlined text-outline-variant text-[40px]">
            psychology
          </span>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-sm">
            No {testType.toUpperCase()} results yet. Run a few tests so the
            recommender has data to train on. (Minimum ~5 tests for a confident
            prediction.)
          </p>
        </div>
      )}
    </div>
  );
}