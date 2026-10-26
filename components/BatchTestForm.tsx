"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AVAILABLE_MODELS, TEST_TYPE_OPTIONS } from "@/lib/availableModels";
import { runBatchTest } from "@/lib/api";
import { parseDatasetFile, MAX_DATASET_ITEMS } from "@/lib/dataset";
import { ModelOption, TestType } from "@/lib/types";

export default function BatchTestForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [testType, setTestType] = useState<TestType>("qa");
  const [selectedModels, setSelectedModels] = useState<string[]>(
    AVAILABLE_MODELS.filter((m) => m.enabled).map((m) => m.id)
  );
  const [judgeMetrics, setJudgeMetrics] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const runStartedAt = useRef<number | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileText, setFileText] = useState<string | null>(null);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [readError, setReadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isSubmitting) return;
    const updateElapsed = () => {
      if (runStartedAt.current !== null) {
        setElapsedSeconds(Math.floor((Date.now() - runStartedAt.current) / 1000));
      }
    };
    updateElapsed();
    const interval = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(interval);
  }, [isSubmitting]);

  const SUPPORTED_EXT = ["csv", "json", "txt"];

  function clearFile() {
    setFileName(null);
    setFileText(null);
    setParseWarnings([]);
    setRowCount(0);
    setReadError(null);
  }

  async function handleFile(file: File) {
    setReadError(null);
    setParseWarnings([]);
    setRowCount(0);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!SUPPORTED_EXT.includes(ext)) {
      setReadError(`Use a .csv or .json file (or .txt with a CSV header).`);
      setFileName(null);
      setFileText(null);
      return;
    }
    try {
      const text = await file.text();
      if (!text.trim()) {
        setReadError("File is empty.");
        return;
      }
      // Validate + count rows immediately, using the exact same parser the
      // server will use — so the user sees errors before burning API calls.
      const parsed = parseDatasetFile(file.name, text);
      setFileName(file.name);
      setFileText(text);
      setRowCount(parsed.items.length);
      setParseWarnings(parsed.errors);
      if (parsed.items.length === 0) {
        setReadError("No valid rows found in this file — check the columns.");
      }
    } catch (err) {
      setReadError(err instanceof Error ? err.message : "Could not read that file.");
      setFileName(null);
      setFileText(null);
    }
  }

  function toggleModel(id: string) {
    setSelectedModels((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  }

  const freeModels = AVAILABLE_MODELS.filter((m) => m.enabled);
  const comingSoonModels = AVAILABLE_MODELS.filter((m) => !m.enabled);

  function modelRow(model: ModelOption) {
    return (
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
          <span className="font-mono-label text-mono-label text-on-surface">{model.name}</span>
        </div>
        <span className="px-1.5 py-0.5 rounded bg-surface-container border border-outline-variant font-mono-label text-[10px] text-on-surface-variant">
          {model.enabled ? model.provider : "Coming soon"}
        </span>
      </label>
    );
  }

  async function handleSubmit() {
    if (!fileText || !fileName) return;
    if (selectedModels.length === 0) {
      setReadError("Select at least one model.");
      return;
    }
    setIsSubmitting(true);
    runStartedAt.current = Date.now();
    setElapsedSeconds(0);
    setReadError(null);
    try {
      const { batchId } = await runBatchTest({
        name: name || undefined,
        testType,
        modelIds: selectedModels,
        fileName,
        fileText,
        judgeMetrics,
      });
      router.push(`/batch/${batchId}`);
    } catch (err) {
      setReadError(err instanceof Error ? err.message : "Batch test failed.");
      setIsSubmitting(false);
      runStartedAt.current = null;
    }
  }

  return (
    <div className="space-y-xl">
      <section className="bg-surface border border-outline-variant rounded-lg p-lg space-y-md">
        <div className="flex items-center gap-sm">
          <span className="material-symbols-outlined text-primary">dataset</span>
          <h3 className="font-headline-sm text-headline-sm text-on-surface">
            Dataset Evaluation
          </h3>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Upload a CSV or JSON of prompts (with optional ground-truth answers and
          RAG contexts). Every row is run against every selected model, then
          scored with exact-match / ROUGE-L / BLEU and optional LLM-judge
          faithfulness &amp; answer-relevance — a RAGAS-style accuracy report.
        </p>

        {/* Dataset file */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void handleFile(file);
          }}
          className={`relative border-2 border-dashed rounded-lg p-md flex flex-col items-center justify-center gap-sm text-center cursor-pointer transition-colors ${
            isDragging
              ? "border-primary bg-primary-container/20"
              : "border-outline-variant bg-surface-container-lowest hover:border-primary/50"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          {fileName ? (
            <div className="flex items-center gap-sm text-on-surface">
              <span className="material-symbols-outlined text-secondary">description</span>
              <span className="font-mono-label text-mono-label">{fileName}</span>
              <span className="px-2 py-0.5 rounded-full bg-secondary-container/10 border border-secondary-container/30 text-secondary-fixed font-mono-label text-[10px]">
                {rowCount} row{rowCount === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                onClick={clearFile}
                className="text-on-surface-variant hover:text-error transition-colors"
                title="Remove file"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => fileInputRef.current?.click()}>
              <span className="material-symbols-outlined text-[28px] text-on-surface-variant">
                upload_file
              </span>
              <span className="font-mono-label text-mono-label text-on-surface mt-1 block">
                Drop a dataset here or click to browse
              </span>
              <span className="font-mono-label text-[11px] text-on-surface-variant mt-0.5 block">
                .csv or .json — columns: question, reference (optional), context (optional)
              </span>
            </button>
          )}
        </div>

        {readError && (
          <div className="flex items-start gap-2 px-md py-sm rounded border border-error/30 bg-error/10 font-body-sm text-[12px] text-error">
            <span className="material-symbols-outlined text-[16px] mt-0.5">error</span>
            <span>{readError}</span>
          </div>
        )}
        {parseWarnings.length > 0 && (
          <div className="flex items-start gap-2 px-md py-sm rounded border border-outline-variant bg-surface-container-low font-body-sm text-[12px] text-on-surface-variant">
            <span className="material-symbols-outlined text-[16px] mt-0.5">info</span>
            <ul className="space-y-0.5">
              {parseWarnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Config */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-xl">
        <div className="bg-surface border border-outline-variant rounded-lg p-lg space-y-md">
          <h3 className="font-headline-sm text-headline-sm text-on-surface">Run name</h3>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. RAG faithfulness smoke test"
            className="w-full bg-surface-container-lowest border border-outline-variant rounded px-3 py-2 font-body-sm text-body-sm text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:outline-none"
          />

          <h3 className="font-headline-sm text-headline-sm text-on-surface pt-sm">
            Task type
          </h3>
          <div className="flex flex-col gap-2">
            {TEST_TYPE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-center gap-sm px-3 py-2 rounded border cursor-pointer transition-colors ${
                  testType === opt.value
                    ? "border-tertiary-fixed-dim bg-surface-container-low text-on-surface"
                    : "border-outline-variant bg-surface-container-lowest hover:border-primary/40 text-on-surface-variant"
                }`}
              >
                <input
                  type="radio"
                  name="batch-test-type"
                  value={opt.value}
                  checked={testType === opt.value}
                  onChange={() => setTestType(opt.value as TestType)}
                  className="w-4 h-4 text-tertiary-fixed-dim border-outline-variant focus:ring-tertiary-fixed-dim focus:ring-offset-background"
                />
                <span className="font-mono-label text-mono-label">{opt.label}</span>
              </label>
            ))}
          </div>

          <label className="flex items-center justify-between pt-sm cursor-pointer">
            <div>
              <div className="font-mono-label text-mono-label text-on-surface">
                LLM-judge metrics
              </div>
              <div className="font-body-sm text-[12px] text-on-surface-variant mt-0.5">
                Optional. Adds one or two judge calls per successful model response and can substantially increase run time.
              </div>
            </div>
            <input
              type="checkbox"
              checked={judgeMetrics}
              onChange={(e) => setJudgeMetrics(e.target.checked)}
              className="w-4 h-4 rounded-sm text-tertiary-fixed-dim border-outline-variant focus:ring-tertiary-fixed-dim focus:ring-offset-background"
            />
          </label>
        </div>

        <div className="bg-surface border border-outline-variant rounded-lg p-lg space-y-md">
          <h3 className="font-headline-sm text-headline-sm text-on-surface">Models</h3>
          <div className="space-y-2">
            {freeModels.map(modelRow)}
            {comingSoonModels.length > 0 && (
              <div className="pt-sm">
                <div className="font-mono-label text-[10px] text-on-surface-variant uppercase tracking-wider mb-2">
                  Coming soon
                </div>
                <div className="space-y-2">{comingSoonModels.map(modelRow)}</div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="flex items-center justify-end gap-md">
        <span className="font-body-sm text-[12px] text-on-surface-variant">
          Runs <strong className="text-on-surface">{rowCount || 0}</strong> prompt
          {rowCount === 1 ? "" : "s"} ×{" "}
          <strong className="text-on-surface">{selectedModels.length}</strong> model
          {selectedModels.length === 1 ? "" : "s"}
          {judgeMetrics ? " + judge calls" : " (judge metrics off)"}. Datasets over {MAX_DATASET_ITEMS} rows are
          capped.
        </span>
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!fileText || isSubmitting}
          className="inline-flex items-center gap-xs px-md py-2 rounded bg-primary text-on-primary font-mono-label text-mono-label hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
              Running… {Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, "0")}
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[16px]">play_arrow</span>
              Run Batch Evaluation
            </>
          )}
        </button>
      </section>
    </div>
  );
}
