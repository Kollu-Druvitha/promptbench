import { NextRequest, NextResponse } from "next/server";
import { getTest, updateResultFeedback } from "@/lib/server/db";
import { currentScope } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  const { testId } = await params;
  const scope = await currentScope();
  const record = await getTest(testId, scope);
  if (!record) {
    return NextResponse.json({ error: "Test not found" }, { status: 404 });
  }
  return NextResponse.json(record);
}

/**
 * PATCH /api/tests/[testId] — record the user's agreement with one model's
 * judge score. Body: { modelId, feedback: "agree" | "disagree" | null }.
 * Setting feedback to null clears a previously recorded vote.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  const { testId } = await params;
  let body: { modelId?: string; feedback?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const modelId = body.modelId;
  if (!modelId || typeof modelId !== "string") {
    return NextResponse.json({ error: "modelId is required" }, { status: 400 });
  }
  const feedback = body.feedback ?? null;
  if (feedback !== null && feedback !== "agree" && feedback !== "disagree") {
    return NextResponse.json(
      { error: "feedback must be \"agree\", \"disagree\", or null" },
      { status: 400 }
    );
  }

  const scope = await currentScope();
  const updated = await updateResultFeedback(testId, scope, modelId, feedback);
  if (!updated) {
    return NextResponse.json(
      { error: "Test or model result not found" },
      { status: 404 }
    );
  }
  return NextResponse.json(updated);
}
