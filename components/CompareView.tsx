"use client";

import { useState } from "react";
import { AVAILABLE_MODELS, TEST_TYPE_OPTIONS } from "@/lib/availableModels";
import { submitPromptComparison } from "@/lib/api";
import { PromptComparisonResult, TestType } from "@/lib/types";

const DIRECTION_ICON: Record<string, string> = {
  up: "arrow_upward",
  down: "arrow_downward",
  flat: "horizontal_rule",
};

function deltaColor(direction: string, upIsGood: boolean) {
  if (direction === "flat") return "text-outline-variant";
  const isGoodChange = (direction === "up") === upIsGood;
  return isGoodChange ? "text-secondary-fixed" : "text-error";
}

export default function CompareView() {
  const [promptV1, setPromptV1] = useState("");
  const [promptV2, setPromptV2] = useState("");
  const [testType, setTestType] = useState<TestType>("qa");
  const [selectedModels, setSelectedModels] = useState<string[]>(
    AVAILABLE_MODELS.filter((m) => m.enabled).map((m) => m.id)
  );
  const [results, setResults] = useState<PromptComparisonResult[] | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  function toggleModel(id: string) {
    setSelectedModels((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  }

  async function handleRun() {
    if (!promptV1.trim() || !promptV2.trim() || selectedModels.length === 0)
      return;
    setIsRunning(true);
    try {
      const res = await submitPromptComparison({
        promptV1,
        promptV2,
        testType,
        modelIds: selectedModels,
      });
      setResults(res);
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter mb-xl">
      {/* Controls */}
      <div className="lg:col-span-3 space-y-6">
        <div className="bg-surface-container-low border border-outline-variant rounded-lg p-md">
          <label className="block font-mono-label text-[12px] text-on-surface-variant uppercase tracking-wider mb-3">
            Models to Evaluate
          </label>
          <div className="space-y-2">
            {AVAILABLE_MODELS.map((model) => (
              <label
                key={model.id}
                className={`flex items-center gap-3 p-2 rounded transition-colors border border-transparent ${
                  model.enabled
                    ? "hover:bg-surface-container-high hover:border-outline-variant cursor-pointer"
                    : "opacity-40 cursor-not-allowed"
                }`}
              >
                <input
                  type="checkbox"
                  disabled={!model.enabled}
                  checked={selectedModels.includes(model.id)}
                  onChange={() => toggleModel(model.id)}
                  className="bg-primary-container border-outline-variant text-secondary-fixed rounded-sm focus:ring-secondary-fixed focus:ring-offset-background focus:ring-offset-1"
                />
                <span className="font-body-sm text-body-sm text-on-surface">
                  {model.name}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="bg-surface-container-low border border-outline-variant rounded-lg p-md">
          <label className="block font-mono-label text-[12px] text-on-surface-variant uppercase tracking-wider mb-3">
            Test Type
          </label>
          <select
            value={testType}
            onChange={(e) => setTestType(e.target.value as TestType)}
            className="w-full bg-surface-container-lowest border border-outline-variant rounded font-body-sm text-body-sm text-on-surface p-2.5 focus:ring-2 focus:ring-tertiary focus:border-tertiary outline-none transition-all"
          >
            {TEST_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleRun}
          disabled={
            isRunning || !promptV1.trim() || !promptV2.trim() || selectedModels.length === 0
          }
          className="w-full bg-surface-bright text-on-surface border border-outline-variant font-mono-label text-mono-label font-bold py-3 rounded hover:bg-surface-container-high transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-[18px]">
            {isRunning ? "hourglass_empty" : "play_circle"}
          </span>
          {isRunning ? "Running..." : "Run Comparison"}
        </button>
      </div>

      {/* Prompts + results */}
      <div className="lg:col-span-9 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
          <PromptBox
            label="Prompt V1"
            dotClass="bg-outline-variant"
            value={promptV1}
            onChange={setPromptV1}
            placeholder="Enter baseline prompt..."
          />
          <PromptBox
            label="Prompt V2"
            sublabel="(Challenger)"
            dotClass="bg-secondary-fixed"
            value={promptV2}
            onChange={setPromptV2}
            placeholder="Enter challenger prompt..."
          />
        </div>

        {results && (
          <div className="mt-xl space-y-6">
            <h3 className="font-headline-sm text-headline-sm text-on-surface border-b border-outline-variant pb-2">
              Latest Comparison Results
            </h3>
            {results.map((r) => (
              <div
                key={r.modelId}
                className="bg-surface-container-low border border-outline-variant rounded-lg overflow-hidden"
              >
                <div className="p-4 border-b border-outline-variant bg-surface-container-lowest flex justify-between items-center">
                  <h4 className="font-body-md text-body-md font-semibold text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-tertiary-fixed-dim">
                      memory
                    </span>
                    {r.modelName}
                  </h4>
                  <span className="font-mono-label text-[11px] text-on-surface-variant bg-surface-container px-2 py-1 rounded">
                    ID: {r.evalId}
                  </span>
                </div>
                <div className="overflow-x-auto no-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-outline-variant">
                        <th className="py-3 px-4 font-body-sm text-body-sm text-on-surface-variant font-medium w-1/4">
                          Metric
                        </th>
                        <th className="py-3 px-4 font-mono-label text-mono-label text-on-surface-variant w-1/4">
                          Prompt V1
                        </th>
                        <th className="py-3 px-4 font-mono-label text-mono-label text-on-surface-variant w-1/4">
                          Prompt V2
                        </th>
                        <th className="py-3 px-4 font-mono-label text-mono-label text-on-surface-variant w-1/4">
                          Delta
                        </th>
                      </tr>
                    </thead>
                    <tbody className="font-mono-metric text-mono-metric text-[14px]">
                      {r.metrics.map((m, i) => (
                        <tr
                          key={m.label}
                          className={
                            i < r.metrics.length - 1
                              ? "border-b border-outline-variant hover:bg-surface-container-high transition-colors"
                              : "hover:bg-surface-container-high transition-colors"
                          }
                        >
                          <td className="py-3 px-4 font-body-sm text-body-sm text-on-surface">
                            {m.label}
                          </td>
                          <td className="py-3 px-4 text-on-surface">{m.v1Value}</td>
                          <td className="py-3 px-4 text-on-surface">{m.v2Value}</td>
                          <td
                            className={`py-3 px-4 flex items-center gap-1 ${deltaColor(
                              m.direction,
                              m.upIsGood
                            )}`}
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              {DIRECTION_ICON[m.direction]}
                            </span>
                            {m.delta}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PromptBox({
  label,
  sublabel,
  dotClass,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  sublabel?: string;
  dotClass: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="flex flex-col h-[400px]">
      <div className="bg-surface-container-low border border-outline-variant rounded-t-lg p-3 flex justify-between items-center border-b-0">
        <h3 className="font-mono-label text-[12px] text-on-surface uppercase tracking-wider flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${dotClass}`} /> {label}
          {sublabel && (
            <span className="text-on-surface-variant normal-case tracking-normal">
              {sublabel}
            </span>
          )}
        </h3>
        <button
          type="button"
          className="text-on-surface-variant hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">content_copy</span>
        </button>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 w-full bg-surface-container-lowest border border-outline-variant rounded-b-lg p-4 font-mono-label text-[13px] text-on-surface leading-relaxed resize-none focus:ring-2 focus:ring-tertiary focus:border-tertiary outline-none no-scrollbar"
        placeholder={placeholder}
      />
    </div>
  );
}
