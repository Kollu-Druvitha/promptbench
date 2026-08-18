# PromptBench — Interview Cheat Sheet (1 page)

> Read this 5 minutes before any interview. Speak naturally, never read it word-for-word.

---

## 🎯 Your headline (say this in 10 seconds)

> "I built a full-stack **LLM benchmarking platform** that runs the same prompt across multiple AI models (Groq, Google, Mistral), scores each answer automatically using a second AI model as a judge, and supports **RAG** — uploading a document, retrieving the relevant facts, and grading whether the model stayed grounded in those facts."

## 📊 Quick "my project" story (3 bullets)

- **What:** A Next.js + TypeScript dashboard to compare LLMs on **quality, speed, tokens, and cost**.
- **How:** Model router normalizes all providers → LLM-as-judge scores each response → badges pick quality/speed/value winners → results persist to JSON.
- **Notable:** RAG with TF-IDF + cosine retrieval; PDF/DOCX parsing server-side; judge never equals a graded model.

## 🔁 The request flow (one line each)

`TestForm` (client) → `POST /api/tests` → validate → build RAG retriever + augmented prompt → call all models **in parallel** → judge each response → compute badges → save to `db.json` → client shows `/results/[testId]`.

## 🧠 6 concepts — one-liners to say out loud

| Concept | Say this |
|---|---|
| **Model router** (adapter pattern) | "One file knows provider specifics; everything else just sees a normalized `TestResult`. Adding a model = install package + 1 case + flip a flag." |
| **LLM-as-a-judge** | "A second LLM scores the first model's answer against a rubric and returns 0–10 JSON. The judge is never a graded model, so no bias." |
| **Resilience** | "One flaky model or judge call never fails a run — `Promise.allSettled` + JSON-parse fallback + neutral score." |
| **RAG** | "Parse → chunk → retrieve (dense vector + cosine, TF-IDF fallback) → augmented prompt → grade groundedness against the actual context." |
| **Client vs server parsing** | "Text reads in the browser; heavy PDF/DOCX libs stay server-side to keep the bundle small — `/api/parse`." |
| **Storage (repository pattern)** | "JSON file now, but every function has the exact shape a real DB would — swap it later with zero route changes." |

## 🏆 The Model-Recommendation feature (talking points)

**What it is:** aggregate every stored run into a leaderboard and recommend the best model **per task type** (RAG / coding / summarization / QA) **and per priority** (quality / speed / cost).

**Why it's a strong idea (say these):**
- **It's a real product category.** "Model routing / LLM gateway" — OpenRouter, Martian, RouteLLM, LiteLLM do exactly this. I'm building a simplified version of a hot, hireable concept.
- **Demonstrates data & statistics.** Aggregating noisy per-run scores into robust rankings: mean vs win-rate, sample-size weighting, confidence labels. Shows I think about *evidence*, not just "who won once."
- **Demonstrates product thinking.** "Best" isn't one thing — it depends on whether you care about quality, latency, or cost. I present separate views per priority, not a single naive winner.
- **Turns one-off tests into compounding value.** Every run makes the recommendation smarter — the product gets better with use, not just more complete.
- **Shows LLM-awareness.** I understand judge-score variance, and I surface it (deltas vs the leader) instead of overclaiming.

**The mature caveats to volunteer (this wins points):**
- Small samples are noisy → require a minimum number of runs before recommending; show sample size.
- Unbalanced data → a model with 3 runs must not outrank one with 30; weight by evidence.
- A difference of < ~1 point is often judge noise → show the gap to the leader.

**Resume bullets you could use:**
- "Built a model-recommendation layer that aggregates historical eval runs and routes each task type to the best model by quality / speed / cost."
- "Aggregated noisy LLM-judge scores using win-rates, sample-size weighting, and confidence labels to avoid overclaiming."
- "Designed a task × priority recommender (RAG/coding/summarization/QA × quality/speed/cost) over a real stored dataset."

**How to connect it to the rest of your project:** "The same badges that mark the per-run winner (`lib/badges.ts`) feed the cross-run aggregation — so the leaderboard logic is a single source of truth, and RAG now records whether it used semantic vs TF-IDF retrieval so I can also compare which retrieval mode actually improves groundedness."


## ❓ Top questions — 2-second answers

- **What's RAG?** Give the model the right facts before you ask; reduces hallucination; lets a small model answer about your own documents.
- **How do you grade without a human?** LLM-as-judge with per-test-type rubrics.
- **TF-IDF vs embeddings?** Embeddings (Mistral `mistral-embed`) are semantic — they match meaning; does vector search by default. TF-IDF = word-frequency vectors, kept as an automatic fallback when the embeddings API is unavailable.
- **Why JSON file storage?** Zero setup, cross-OS; I chose it over native-compiling SQLite for v1. (Admit it doesn't scale — plan to move.)
- **Tokens & cost?** Cost = tokens/1000 × per-1K price, from a config map.

## 🛠️ "I don't know" trick (win points)

Use: *"I didn't implement that in v1, but here's how I'd approach it…"* then outline (DB → Postgres, retrieval → vector embeddings, scale → auth + batching). Naming the plan sounds senior even if you didn't build it.

## 🔢 Numbers to confidently cite

- **4 models** wired (Llama 70B/8B, Mistral Small, Gemini 2.0 Flash); GPT-4/Claude scaffolded.
- **4 test types** (RAG, coding, summarization, QA).
- **25 MB** max context file; **.pdf / .docx** parsed server-side.
- **0–10** judge score; top-3 RAG chunks; ~200-word chunks w/ overlap.
- RAG retrieval: **vector (semantic) by default**, TF-IDF fallback.
