import { ModelOption } from "./types";

// Single source of truth for which models appear in the UI.
// `enabled: false` models are shown (grayed out, "Coming soon") but can't
// be selected yet. To wire up a new provider later:
//   1. Flip `enabled` to true here
//   2. Add the provider call in the backend's model-router
// That's it — no component changes needed.
export const AVAILABLE_MODELS: ModelOption[] = [
  // First 2 models: both have genuinely free API tiers (no credit card,
  // no billing setup) — good for building/testing without spending money.
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    provider: "Google",
    enabled: true,
  },
  {
    id: "llama-3.3-70b",
    name: "Llama 3.3 70B",
    provider: "Groq",
    enabled: true,
  },
  {
    id: "llama-3.1-8b",
    name: "Llama 3.1 8B",
    provider: "Groq",
    enabled: true,
  },
  {
    id: "mistral-small",
    name: "Mistral Small",
    provider: "Mistral",
    enabled: true,
  },
  // Paid models — shown for the full comparison story, wire up later
  // once you're ready to spend a little (or once you have credits).
  {
    id: "gpt-4-turbo",
    name: "GPT-4 Turbo",
    provider: "OpenAI",
    enabled: false,
  },
  {
    id: "claude-3-opus",
    name: "Claude 3 Opus",
    provider: "Anthropic",
    enabled: false,
  },
];

export const TEST_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "rag", label: "Retrieval-Augmented Generation (RAG)" },
  { value: "coding", label: "Code Generation" },
  { value: "summarization", label: "Summarization" },
  { value: "qa", label: "Question Answering" },
];
