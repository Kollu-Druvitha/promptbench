# PromptBench

A dashboard for testing the same prompt across multiple LLMs and comparing
quality, tokens, latency, and cost. Built with Next.js 14 (App Router),
TypeScript, and Tailwind CSS.

This is now a **fully working full-stack app** — real calls to Gemini and
Groq, a working LLM-as-judge evaluator, and local persistence. No paid
services required.

## Getting started

1. Copy `.env.local.example` to `.env.local`
2. Fill in your two free API keys:
   - Gemini: https://aistudio.google.com/apikey (no card required)
   - Groq: https://console.groq.com/keys (no card required)
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
  server/models.ts             Routes a model id to the right provider (Gemini/Groq)
  server/evaluator.ts          LLM-as-judge scoring logic
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

Each model's response is scored by a second call to Gemini (the
"judge"), using a rubric tailored to the test type (coding correctness,
summarization completeness, etc.) — modeled on promptfoo's `llm-rubric`
grading pattern. This is a genuine quality grader, but it is **not** a
strict factuality/hallucination checker — that requires a ground-truth
reference answer to compare against, which this MVP doesn't collect yet
(see "What's deferred" below).

## Design system

Colors, typography, spacing, and component styling come directly from the
Stitch-generated `DESIGN.md` ("Technical Precision" system) — translated
into `tailwind.config.ts` so the built app matches the approved mockups
exactly. See that file for the full token reference.

## Models

Two models are wired for v1, both chosen because they have genuinely free
API tiers (no credit card, no billing setup):

- **Gemini 2.5 Flash** (Google)
- **Llama 3.3 70B** (Groq)

`gpt-4-turbo` (OpenAI) and `claude-3-opus` (Anthropic) are visible in the
UI but disabled ("Coming soon") — these require paid API credits. To
enable one later: add its provider package, add a case in
`lib/server/models.ts`, flip `enabled: true` in `lib/availableModels.ts`.

## What's deferred (not yet in this build)

- GPT-4 / Claude provider integration (paid — off by default)
- Actual parsing/use of uploaded context files for real RAG grounding
  (the evaluator currently grades RAG responses for plausibility, not
  against real retrieved context)
- Authentication / multi-user support (currently single-user, local-only)
- Concurrent-write-safe storage (fine for solo local dev)
