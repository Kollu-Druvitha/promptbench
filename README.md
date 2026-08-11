# PromptBench

A dashboard for testing the same prompt across multiple LLMs and comparing
quality, tokens, latency, and cost. Built with Next.js 14 (App Router),
TypeScript, and Tailwind CSS.

This is now a **fully working full-stack app** — real calls to Groq,
Mistral, and Gemini, a working LLM-as-judge evaluator, RAG retrieval over
uploaded context files, and local persistence. No paid services required.

## Getting started

1. Copy `.env.local.example` to `.env.local`
2. Fill in your free API keys:
   - Groq: https://console.groq.com/keys (no card required)
   - Mistral: https://console.mistral.ai/api-keys (no card required)
   - Gemini: https://aistudio.google.com/apikey (optional — the free
     tier is rate-limited and can throw `limit: 0` errors)
3. Install and run:

```bash
npm install
npm run dev
```

Visit http://localhost:3000

## Project structure

```
app/
  page.tsx                    New Test screen (/)
  results/page.tsx            Results empty state
  results/[testId]/page.tsx   Test results (cards / table toggle)
  compare/page.tsx            Prompt V1 vs V2 comparison
  history/page.tsx            Past test runs + summary stats
  api/tests/route.ts              POST: run a test, GET: list history
  api/tests/[testId]/route.ts     GET: fetch one test's results
  api/dashboard/stats/route.ts    GET: summary stats
  api/compare/route.ts            POST: run Prompt V1 vs V2
  api/parse/route.ts              POST: extract text from uploaded .pdf / .docx / text
components/
  SideNav.tsx                Shared navigation
  TestForm.tsx               New Test form (prompt, context upload, model select)
  ModelCard.tsx               Single-model result card
  ScoreBadge.tsx               "Best Quality" / "Fastest" / "Best Value" pills
  ComparisonTable.tsx         Metrics table view
  HistoryTable.tsx             Past runs table
  ResultsView.tsx             Client wrapper for cards/table toggle
  CompareView.tsx             Client wrapper for the Compare screen
lib/
  types.ts                    Shared TypeScript interfaces
  availableModels.ts          Single source of truth for which models show in the UI
  mockData.ts                  Mock data (used only if you want to preview UI without keys)
  badges.ts                    Shared "best quality/fastest/value" computation
  api.ts                      Client-side fetch wrappers used by TestForm/CompareView
  server/db.ts                  JSON-file storage
  server/models.ts             Routes a model id to the right provider (Groq/Mistral/Gemini)
  server/evaluator.ts          LLM-as-judge scoring logic
  server/rag.ts                RAG chunking + TF-IDF retrieval
```

## Why a JSON file instead of SQLite/Postgres?

SQLite drivers (`better-sqlite3`) need native compilation, which is a
common source of setup pain on Windows specifically. Postgres needs a
hosted DB service — one more account, one more thing to configure, for a
solo student project that doesn't need concurrent multi-user writes yet.
A JSON file (`data/db.json`, auto-created on first run) needs zero setup
and works identically on any OS.

Trade-off: this won't scale past local single-user use and doesn't
handle concurrent writes safely. If you ever deploy this for real users,
swap `lib/server/db.ts` for a real database — the function signatures
(`saveTest`, `getTest`, `listTests`, `getStats`) are written so the API
routes calling them won't need to change.

## How the evaluator works

Each model's response is scored by a second LLM call (the "judge"), using
a rubric tailored to the test type (coding correctness, summarization
completeness, etc.) — modeled on promptfoo's `llm-rubric` grading pattern.
The judge is **Groq's Llama 3.3 70B** (free and reliable) with Gemini as a
fallback. The judge is never a model being evaluated. This is a genuine
quality grader, but it is **not** a strict factuality/hallucination
checker for tests without ground truth — batch evaluation against a
labeled dataset is on the roadmap.

## RAG

A RAG test with an uploaded context file runs a real retrieval pipeline:

1. The file's text is extracted (`.pdf` and `.docx` are parsed server-side
   in `/api/parse`; plain-text formats are read directly) and chunked
   (`lib/server/rag.ts`).
2. The most relevant passages are selected by **dense vector retrieval** —
   Mistral's `mistral-embed` embeddings + cosine similarity — which matches
   *meaning*, not just keywords. If the embeddings provider is unavailable
   (no `MISTRAL_API_KEY`, rate limit, network), it automatically falls back
   to a local TF-IDF retriever. The results page shows which mode was used.
3. The model answers grounded in those passages via an augmented prompt.
4. The judge grades **groundedness against the actual retrieved context**
   (fabricating facts that aren't in the context is penalized).

The retrieved passages are stored with the test and shown on the results
page, along with a badge for the retrieval mode. Both retrievers implement
the same `Retriever` interface, so swapping in another backend (e.g.
pgvector / Qdrant / an HNSW index) is a drop-in change behind
`buildRetriever` in `lib/server/rag.ts`.

## Design system

Colors, typography, spacing, and component styling come directly from the
Stitch-generated `DESIGN.md` ("Technical Precision" system) — translated
into `tailwind.config.ts` so the built app matches the approved mockups
exactly. See that file for the full token reference.

## Models

Four models are wired in, all chosen because they have genuinely free API
tiers (no credit card, no billing setup):

- **Llama 3.3 70B** (Groq) — reliable
- **Llama 3.1 8B** (Groq) — reliable
- **Mistral Small** (Mistral) — reliable
- **Gemini 2.0 Flash** (Google) — enabled but best-effort: the free tier
  frequently throws `limit: 0` quota errors (known provider-side issue)

`gpt-4-turbo` (OpenAI) and `claude-3-opus` (Anthropic) are visible in the
UI but disabled ("Coming soon") — these require paid API credits. To
enable one later: add its provider package, add a case in
`lib/server/models.ts`, flip `enabled: true` in `lib/availableModels.ts`.

## What's deferred (not yet in this build)

- GPT-4 / Claude provider integration (paid — off by default)
- OCR for scanned/image-only PDFs (only embedded text is extracted today;
  legacy `.doc` files aren't supported — re-save as `.docx`/`.pdf`)
- Batch evaluation against a labeled dataset (on the roadmap)
- Authentication / multi-user support (currently single-user, local-only)
- Concurrent-write-safe storage (fine for solo local dev)
