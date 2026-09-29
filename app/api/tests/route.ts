import { NextRequest, NextResponse } from "next/server";
import { callModel, isModelError, MODEL_DISPLAY } from "@/lib/server/models";
import { evaluateResponse } from "@/lib/server/evaluator";
import { buildRetriever, buildRagPrompt } from "@/lib/server/rag";
import { saveTest, listTests } from "@/lib/server/db";
import { withBadges } from "@/lib/badges";
import { currentScope } from "@/lib/auth";
import { TestRecord, TestResult, TestType, RetrievalMode } from "@/lib/types";

// Multi-model calls + judge evals run inside this route; give it headroom on
// serverless hosts (Vercel Hobby caps at 60s).
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: {
    prompt?: string;
    testType?: TestType;
    modelIds?: string[];
    contextFileName?: string;
    contextText?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { prompt, testType, modelIds } = body;

  if (!prompt || !prompt.trim()) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }
  if (!testType) {
    return NextResponse.json({ error: "testType is required" }, { status: 400 });
  }
  if (!modelIds || modelIds.length === 0) {
    return NextResponse.json(
      { error: "At least one modelId is required" },
      { status: 400 }
    );
  }

  // RAG: when a context file is supplied for a RAG test, retrieve the most
  // relevant chunks (local TF-IDF — zero extra API calls), build a grounded
  // prompt, and remember what was retrieved so the evaluator can grade
  // groundedness against the *actual* context (not general plausibility).
  const contextFileName: string | undefined =
    typeof body.contextFileName === "string" ? body.contextFileName : undefined;
  const contextText: string | undefined =
    typeof body.contextText === "string" && body.contextText.trim()
      ? body.contextText
      : undefined;

  let ragInfo:
    | { promptToRun: string; retrievedContext: string; mode: RetrievalMode }
    | undefined;

  if (testType === "rag" && contextText) {
    const { retriever, mode } = await buildRetriever(contextText);
    const hits = await retriever.retrieve(prompt, 3);
    const retrievedContext = hits
      .map((h) => h.text.trim())
      .filter(Boolean)
      .join("\n\n---\n\n");
    ragInfo = {
      promptToRun: buildRagPrompt(prompt, hits),
      retrievedContext,
      mode,
    };
  }
  const promptToRun = ragInfo?.promptToRun ?? prompt;

  // Call every selected model in parallel. Promise.allSettled means one
  // provider failing (bad key, rate limit, network) doesn't kill the others.
  const callResults = await Promise.allSettled(
    modelIds.map((id) => callModel(id, promptToRun))
  );

  const results: TestResult[] = [];
  const errors: { modelId: string; error: string }[] = [];

  for (let i = 0; i < callResults.length; i++) {
    const outcome = callResults[i];
    const modelId = modelIds[i];

    if (outcome.status === "fulfilled" && !isModelError(outcome.value)) {
      results.push(outcome.value);
    } else {
      const errMessage =
        outcome.status === "rejected"
          ? String(outcome.reason)
          : (outcome.value as { error: string }).error;
      errors.push({ modelId, error: errMessage });
      const display = MODEL_DISPLAY[modelId] ?? {
        name: modelId,
        provider: "AI Provider",
      };
      results.push({
        modelId,
        modelName: display.name,
        modelVersion: modelId,
        provider: display.provider,
        responseText: `⚠️ Model Call Failed: ${errMessage}\n\nNote: If using Google Gemini, make sure your .env.local file contains a valid GOOGLE_GENERATIVE_AI_API_KEY from https://aistudio.google.com/apikey`,
        qualityScore: 0,
        reason: "No score — the model call failed.",
        tokens: 0,
        latencyMs: 0,
        costUsd: 0,
      });
    }
  }

  if (results.length === 0) {
    return NextResponse.json(
      {
        error: "All model calls failed",
        details: errors,
      },
      { status: 502 }
    );
  }

  // Evaluate each successful response (also in parallel).
  const evaluated = await Promise.all(
    results.map(async (r) => {
      const { qualityScore, reason } = await evaluateResponse(
        testType,
        prompt,
        r.responseText,
        ragInfo?.retrievedContext
      );
      return { ...r, qualityScore, reason };
    })
  );

  const withScores = withBadges(evaluated);

  const testId = `eval-${Date.now().toString(36)}`;
  const scope = await currentScope();
  const record: TestRecord = {
    testId,
    date: new Date().toISOString(),
    prompt,
    testType,
    ownerId: scope !== "local" ? scope : undefined,
    contextFileName: ragInfo ? contextFileName : undefined,
    retrievedContext: ragInfo?.retrievedContext,
    retrievalMode: ragInfo?.mode,
    modelsUsed: withScores.map((r) => r.modelId),
    results: withScores,
    bestModel:
      withScores.find((r) => r.isBestQuality)?.modelId ?? withScores[0].modelId,
    totalCost: withScores.reduce((sum, r) => sum + r.costUsd, 0),
  };

  await saveTest(record, scope);

  return NextResponse.json({
    testId,
    // Return the full record so the client can render results immediately,
    // even if the storage backend can't serve it back yet (serverless hosts
    // with an ephemeral in-memory fallback).
    record,
    // Surface partial failures so the frontend can show which model(s) didn't
    // return, without failing the whole request.
    partialErrors: errors.length > 0 ? errors : undefined,
  });
}

export async function GET() {
  const scope = await currentScope();
  const records = await listTests(scope);
  return NextResponse.json(records);
}
