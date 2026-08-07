"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AVAILABLE_MODELS, TEST_TYPE_OPTIONS } from "@/lib/availableModels";
import { submitTest } from "@/lib/api";
import { TestType } from "@/lib/types";

export default function TestForm() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [testType, setTestType] = useState<TestType>("rag");
  const [selectedModels, setSelectedModels] = useState<string[]>(
    AVAILABLE_MODELS.filter((m) => m.enabled).map((m) => m.id)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  function toggleModel(id: string) {
    setSelectedModels((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  }

  async function handleSubmit() {
    if (!prompt.trim() || selectedModels.length === 0) return;
    setIsSubmitting(true);
    try {
      const { testId } = await submitTest({
        prompt,
        testType,
        modelIds: selectedModels,
      });
      router.push(`/results/${testId}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
      {/* Left column: prompt + context */}
      <div className="lg:col-span-8 flex flex-col gap-gutter">
        <div className="bg-surface-container border border-outline-variant rounded-lg flex flex-col">
          <div className="p-md border-b border-outline-variant flex items-center justify-between">
            <div className="flex items-center gap-sm">
              <span className="material-symbols-outlined text-on-surface-variant text-[18px]">
                terminal
              </span>
              <span className="font-mono-label text-mono-label text-on-surface uppercase tracking-wider">
                Prompt
              </span>
            </div>
          </div>
          <div className="relative flex-1 group">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full bg-surface-container-lowest text-on-surface font-mono-metric text-mono-metric p-md border-0 focus:ring-0 focus:outline-none resize-y min-h-[300px] placeholder:text-outline/50 custom-scrollbar leading-relaxed"
              placeholder="Enter your prompt here... e.g. 'Extract key entities from this text.'"
            />
          </div>
          <div className="bg-surface-container-lowest border-t border-outline-variant px-md py-xs flex justify-between items-center">
            <span className="font-mono-label text-mono-label text-on-surface-variant/70 text-[11px]">
              Tokens: ~{Math.ceil(prompt.length / 4)} | Type: {testType.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="bg-surface-container-low border border-outline-variant rounded-lg p-md">
          <div className="flex items-center gap-sm mb-md">
            <span className="material-symbols-outlined text-secondary-fixed-dim text-[20px]">
              database
            </span>
            <h3 className="font-mono-label text-mono-label text-on-surface uppercase tracking-wider">
              Context Data (RAG)
            </h3>
          </div>
          <div className="border-2 border-dashed border-outline-variant hover:border-primary/50 bg-surface-container-lowest/50 rounded-lg p-xl flex flex-col items-center justify-center text-center transition-colors cursor-pointer group">
            <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center mb-md group-hover:bg-surface-container-high transition-colors">
              <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary text-[24px]">
                cloud_upload
              </span>
            </div>
            <span className="font-body-md text-body-md text-on-surface font-medium mb-xs">
              Drag and drop context files
            </span>
            <span className="font-body-sm text-body-sm text-on-surface-variant mb-md">
              Support .txt, .pdf, .json, .csv (Max 50MB)
            </span>
            <button
              type="button"
              className="bg-surface border border-outline-variant text-on-surface px-4 py-1.5 rounded font-mono-label text-mono-label hover:border-primary transition-colors"
            >
              Browse Files
            </button>
          </div>
        </div>
      </div>

      {/* Right column: config */}
      <div className="lg:col-span-4 flex flex-col gap-gutter">
        <div className="bg-surface-container border border-outline-variant rounded-lg p-md">
          <div className="flex items-center gap-sm mb-lg border-b border-outline-variant pb-sm">
            <span className="material-symbols-outlined text-tertiary text-[20px]">
              tune
            </span>
            <h3 className="font-mono-label text-mono-label text-on-surface uppercase tracking-wider">
              Run Config
            </h3>
          </div>

          <div className="mb-lg">
            <label className="block font-mono-label text-mono-label text-on-surface-variant mb-sm uppercase tracking-wider text-[11px]">
              Evaluation Type
            </label>
            <div className="relative">
              <select
                value={testType}
                onChange={(e) => setTestType(e.target.value as TestType)}
                className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-mono-label text-mono-label rounded p-2.5 appearance-none focus:border-tertiary-fixed-dim focus:ring-1 focus:ring-tertiary-fixed-dim focus:outline-none"
              >
                {TEST_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">
                arrow_drop_down
              </span>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-sm">
              <label className="block font-mono-label text-mono-label text-on-surface-variant uppercase tracking-wider text-[11px]">
                Target Models
              </label>
            </div>
            <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
              {AVAILABLE_MODELS.map((model) => (
                <label
                  key={model.id}
                  className={`flex items-center justify-between p-2.5 rounded border transition-colors group ${
                    model.enabled
                      ? "border-outline-variant bg-surface-container-lowest hover:border-primary/50 cursor-pointer has-[:checked]:border-tertiary-fixed-dim has-[:checked]:bg-surface-container-low"
                      : "border-outline-variant/50 bg-surface-container-lowest/50 cursor-not-allowed opacity-50"
                  }`}
                >
                  <div className="flex items-center gap-sm">
                    <input
                      type="checkbox"
                      disabled={!model.enabled}
                      checked={selectedModels.includes(model.id)}
                      onChange={() => toggleModel(model.id)}
                      className="w-4 h-4 rounded-sm bg-surface-container-lowest border-outline-variant text-tertiary-fixed-dim focus:ring-tertiary-fixed-dim focus:ring-offset-background"
                    />
                    <span className="font-mono-label text-mono-label text-on-surface">
                      {model.id}
                    </span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded bg-surface-container border border-outline-variant font-mono-label text-[10px] text-on-surface-variant">
                    {model.enabled ? model.provider : "Coming soon"}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || !prompt.trim() || selectedModels.length === 0}
          className="w-full bg-surface-bright text-on-surface border border-outline-variant py-3 rounded font-mono-label text-mono-label hover:bg-surface-container-high transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-[18px]">
            {isSubmitting ? "hourglass_empty" : "play_arrow"}
          </span>
          {isSubmitting ? "Running..." : "Run Test"}
        </button>
      </div>
    </div>
  );
}
