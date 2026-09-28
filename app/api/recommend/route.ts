import { NextRequest, NextResponse } from "next/server";
import { listTests } from "@/lib/server/db";
import {
  buildRecommendations,
  RecommendationPriority,
  DEFAULT_WEIGHTS,
} from "@/lib/server/recommender";
import { currentScope, currentUser } from "@/lib/auth";
import { getPreferences } from "@/lib/server/users";
import { TestType } from "@/lib/types";

const PRIORITIES: RecommendationPriority[] = ["quality", "speed", "value"];
const TEST_TYPES: TestType[] = ["rag", "coding", "summarization", "qa"];

/**
 * GET /api/recommend — full leaderboards for a test type, all priorities,
 * trained on the current user's stored history (or the local scope when
 * anonymous) and weighted by their preference profile.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const testType = (searchParams.get("testType") ?? "rag") as TestType;
  if (!TEST_TYPES.includes(testType)) {
    return NextResponse.json({ error: "Invalid testType" }, { status: 400 });
  }

  const scope = await currentScope();
  const user = await currentUser();
  const weights = user ? getPreferences(user.id) : DEFAULT_WEIGHTS;
  const records = listTests(scope);

  const payloads = PRIORITIES.map((priority) =>
    buildRecommendations(records, testType, priority, weights)
  );

  return NextResponse.json({
    testType,
    generatedAt: new Date().toISOString(),
    user: user ? { id: user.id, username: user.username } : null,
    weights,
    payloads,
    totalTests: records.filter((r) => r.testType === testType).length,
  });
}