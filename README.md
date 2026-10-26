# PromptBench

A dashboard for testing the same prompt across multiple LLMs and comparing
quality, tokens, latency, and cost. Built with Next.js 14 (App Router),
TypeScript, and Tailwind CSS.

This is now a **fully working full-stack app** — real calls to Groq, Gemini,
and Mistral Small through OpenRouter, a working LLM-as-a-judge evaluator, RAG
retrieval over uploaded context files, and local persistence.

## Getting started

1. Copy `.env.local.example` to `.env.local`
2. Fill in your API keys:
   - Groq: https://console.groq.com/keys (no card required)
   - OpenRouter: https://openrouter.ai/settings/keys (used for Mistral Small;
     access and charges depend on your OpenRouter account)
   - Mistral: https://console.mistral.ai/api-keys (optional; enables dense
     RAG embeddings; TF-IDF is used without it)
   - Gemini: https://aistudio.google.com/apikey (optional — the free
     tier is rate-limited and can throw `limit: 0` errors)
   - `PROMPTBENCH_SESSION_SECRET`: at least 32 random characters (dev-only
     session encryption for accounts)
   - `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`: only needed if
     you deploy to serverless (Vercel/Netlify) — see "Deploying" below
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
  recommend/page.tsx          ML leaderboard: best model per task × priority
  login/page.tsx              Sign in page
  register/page.tsx           Create account page
  api/tests/route.ts              POST: run a test, GET: list history
  api/tests/[testId]/route.ts     GET: fetch one test's results
  api/dashboard/stats/route.ts    GET: summary stats
  api/compare/route.ts            POST: run Prompt V1 vs V2
  api/recommend/route.ts          GET: trained leaderboard per test type
  api/prefs/route.ts              GET/PUT user recommendation weights
  api/auth/login|register|logout|me  session auth
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
  server/storage.ts              Storage adapter: Upstash Redis OR local JSON files
  server/db.ts                  Scope-aware test storage (user or "local")
  server/models.ts             Routes a model id to the right provider (Groq/Mistral/Gemini)
  server/evaluator.ts          LLM-as-judge scoring logic
  server/rag.ts                RAG chunking + TF-IDF retrieval
  server/recommender.ts         Lightweight supervised recommender (fit + predict)
  server/users.ts               User registry + per-user shards/weights
  server/db.ts                  Scope-aware JSON storage (user or "local")
  auth.ts                      iron-session helpers (currentScope / currentUser)
```

## Why a JSON file instead of SQLite/Postgres?

SQLite drivers (`better-sqlite3`) need native compilation, which is a
common source of setup pain on Windows specifically. Postgres needs a
hosted DB service — one more account, one more thing to configure, for a
solo student project that doesn't need concurrent multi-user writes yet.
A JSON file (auto-created on first run) needs zero setup and works
identically on any OS.

Trade-off: this won't scale past local single-user use and doesn't
handle concurrent writes safely. To keep local dev simple *and* make
serverless deploys work, all persistence now goes through a small
adapter (`lib/server/storage.ts`):

- **Local / persistent Node hosts (Railway, Render, Fly, VPS):** leave
  `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` empty — data is
  stored in `data/` as JSON files, exactly as before.
- **Serverless (Vercel, Netlify):** their filesystem is read-only, so
  set both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (a
  free Upstash Redis database at https://console.upstash.com). Every
  document (test history per scope, the user registry, per-user prefs)
  is stored as a JSON value in Redis instead.

The `saveTest`, `getTest`, `listTests`, `getStats`, and user functions
keep their signatures — the API routes calling them don't care which
backend is active.

## Deploying

1. Push to GitHub. If Vercel is connected to the repo it auto-deploys
   on every push to `main`.
2. In Vercel → Project → Settings → Environment Variables, set:
   - `GOOGLE_GENERATIVE_AI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`
   - `MISTRAL_API_KEY` (optional; enables dense RAG embeddings)
   - `PROMPTBENCH_SESSION_SECRET` (generate a fresh one ≥32 chars)
   - `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (required —
     Vercel's filesystem is read-only, so without these registrations,
     history, and every test save will 500)
3. Redeploy. The model + judge routes declare `maxDuration = 60`, so
   multi-model runs fit within Vercel Hobby's function time limit.

## How the evaluator works

Each model's response is scored by a second LLM call (the "judge"), using
a rubric tailored to the test type (coding correctness, summarization
completeness, etc.) — modeled on promptfoo's `llm-rubric` grading pattern.
The judge is **Groq's `openai/gpt-oss-20b`** (fast, free, reliable) with
Gemini 3.6 Flash as a fallback. The judge is never a model being evaluated.
This is a genuine quality grader, but it is **not** a strict
factuality/hallucination checker for tests without ground truth. Batch runs
can compare model outputs against reference answers and optionally add
LLM-judge faithfulness and answer-relevance scores.

## Batch evaluation

Open `/batch` to evaluate a dataset against one or more enabled models. Upload
a CSV or JSON file with a prompt column (`question`, `prompt`, `input`, `q`, or
`query`); optional reference columns (`reference`, `ground_truth`, `answer`,
and related aliases) enable exact match, ROUGE-L, and BLEU scores. Optional
`context` values make rows grounded RAG questions. Datasets are capped at 100
valid rows, and invalid rows are reported before and after a run.

LLM-judge metrics are optional and off by default to reduce run time and extra
model calls. When enabled, faithfulness is evaluated for rows with context,
while answer relevance is evaluated for every successful model response.
Batch requests wait for the selected model calls to finish before showing
results, so start with a small dataset when testing providers. Batch model
calls allow one retry; regular single-prompt runs use the SDK's default retry
behavior. Batch runs and per-row results are stored in the same scope-aware
storage as regular tests and are available from the batch history and results
pages.

## RAG

A RAG test with an uploaded context file runs a real retrieval pipeline:

1. The file's text is extracted (`.pdf` and `.docx` are parsed server-side
   in `/api/parse`; plain-text formats are read directly) and chunked
   (`lib/server/rag.ts`).
2. The most relevant passages are selected by **dense vector retrieval** —
   Mistral's `mistral-embed` embeddings + cosine similarity — which matches
   *meaning*, not just keywords. This requires `MISTRAL_API_KEY`. If the
   embeddings provider is unavailable (key missing, rate limit, network), it automatically falls back
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

Four model options are wired in. Provider quotas, access requirements, and
pricing can change; check your provider accounts before running evaluations:

> **Heads-up (Aug 2026):** Groq no longer hosts Llama *chat* models and
> older Gemini Flash models (2.0 / 2.5) are shut down. The app keeps its
> stable internal ids so stored history keeps working, but those rows now
> hit **currently-live** models. See `lib/server/models.ts` for the mapping.

- **GPT-OSS 120B** (Groq, id `llama-3.3-70b`) — flagship; best-quality
  candidate; 500 tok/s; $0.60 / 1M out
- **GPT-OSS 20B** (Groq, id `llama-3.1-8b`) — fast/cheap workhorse;
  1000 tok/s; $0.30 / 1M out
- **Mistral Small 3.2 24B** (OpenRouter) — API-reported usage cost is recorded
  when provided by OpenRouter
- **Gemini 3.6 Flash** (Google, id `gemini-2.0-flash`) — enabled but
  best-effort: the free tier frequently throws `limit: 0`/access errors
  (known provider-side issue)

`gpt-4-turbo` (OpenAI) and `claude-3-opus` (Anthropic) are visible in the
UI but disabled ("Coming soon") — these require paid API credits. To
enable one later: add its provider package, add a case in
`lib/server/models.ts`, flip `enabled: true` in `lib/availableModels.ts`.

## Model Recommendation (lightweight ML)

`/recommend` turns every stored run into a **trained leaderboard**: given a
task type (RAG / coding / summarization / QA) and a priority (quality /
speed / value), it predicts which model to use next.

- **Training data** is every stored `TestRecord` — each `(testType, modelId)`
  is a labeled sample whose labels are the observed quality score, latency,
  and cost. So the model genuinely trains on responses the app generated.
- **Instance-based / memory-based learning**: observations are kept and scored
  at query time (k-NN / Thompson-sampling family), which is the right call
  when the dataset fits in memory and re-fit cost is ~0. No framework, no
  native deps.
- **Bayesian shrinkage**: each estimate is shrunk toward the group prior with
  a pseudo-count, so a lucky 1-run model can't outrank a well-tested one.
- The winner is the **highest shrunk utility** for that priority; confidence
  grows with sample size.

This is a simplified **model router** — the same category as RouteLLM,
Martian, and LiteLLM's routing. `lib/server/recommender.ts` is pure and
unit-testable; the `/api/recommend` route and `LeaderboardView` are thin
wrappers around it.

## Accounts & personalization

- **Auth:** `iron-session` (stateless encrypted cookie — no session DB) +
  `bcryptjs` (pure-JS hashing, no native compile). Register / login /
  logout at `/login` and `/register`.
- **Per-user data:** signed-in users get a private shard
  (`data/users/<userId>/db.json`); anonymous visitors use `data/db.json`.
  `lib/server/db.ts` is scope-aware, so history/results/stats/recommend all
  respect the current user automatically.
- **Personalization:** each user has preference weights
  (`data/users/<userId>/prefs.json`) — an audience "this user cares about
  speed/quality/value" profile. Bump the weights on the `/recommend` page and
  the recommender's utilities are weighted accordingly (`personalized: true`).
  Run the same prompt logged-out vs signed-in and see different winners — that
  is the per-user model routing story.

## What's deferred (not yet in this build)

- GPT-4 / Claude provider integration (paid — off by default)
- OCR for scanned/image-only PDFs (only embedded text is extracted today;
  legacy `.doc` files aren't supported — re-save as `.docx`/`.pdf`)
- Concurrent-write-safe storage (fine for solo local dev)
