import { listTests } from "@/lib/server/db";
import {
  buildRecommendations,
  RecommendationPriority,
  RecommendationWeights,
  DEFAULT_WEIGHTS,
} from "@/lib/server/recommender";
import { currentScope, currentUser } from "@/lib/auth";
import { getPreferences } from "@/lib/server/users";
import { TestType } from "@/lib/types";
import LeaderboardView from "@/components/LeaderboardView";

const TEST_TYPES: TestType[] = ["rag", "coding", "summarization", "qa"];
const PRIORITIES: RecommendationPriority[] = ["quality", "speed", "value"];

export default async function RecommendPage({
  searchParams,
}: {
  searchParams: Promise<{ testType?: string }>;
}) {
  const { testType: raw } = await searchParams;
  const testType = (TEST_TYPES as string[]).includes(raw ?? "")
    ? (raw as TestType)
    : "rag";

  const scope = await currentScope();
  const user = await currentUser();
  const weights: RecommendationWeights = user
    ? await getPreferences(user.id)
    : DEFAULT_WEIGHTS;

  const records = await listTests(scope);
  const payloads = PRIORITIES.map((priority) =>
    buildRecommendations(records, testType, priority, weights)
  );
  const totalTests = records.filter((r) => r.testType === testType).length;

  return (
    <>
      <header className="px-gutter py-md border-b border-outline-variant/20 bg-background/80 backdrop-blur-md sticky top-0 z-30 flex justify-between items-center">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface">
            Model Recommendation
          </h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 flex items-center gap-2">
            ML-learned leaderboard, personalized from your runs and usage.
            <span className="px-2 py-0.5 rounded-full bg-surface-container border border-outline-variant font-mono-label text-[10px] text-on-surface-variant uppercase tracking-wider">
              {user ? `as @${user.username}` : "local workspace"}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/recommend?testType=${testType}`}
            className="px-3 py-1.5 rounded border border-outline-variant text-on-surface-variant hover:bg-surface-bright hover:text-on-surface transition-colors flex items-center gap-1 font-mono-label text-mono-label"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            Recompute
          </a>
        </div>
      </header>

      <div className="p-gutter flex-1 space-y-xl overflow-y-auto max-w-container-max w-full mx-auto">
        <div className="flex flex-wrap gap-2">
          {TEST_TYPES.map((opt) => (
            <a
              key={opt}
              href={`/recommend?testType=${opt}`}
              className={`px-3 py-1.5 rounded border font-mono-label text-mono-label transition-colors ${
                opt === testType
                  ? "bg-surface-bright text-on-surface border-outline"
                  : "text-on-surface-variant border-outline-variant hover:bg-surface-container-high"
              }`}
            >
              {opt.toUpperCase()}
            </a>
          ))}
        </div>

        <LeaderboardView
          testType={testType}
          payloads={payloads}
          totalTests={totalTests}
          weights={weights}
          isLoggedIn={Boolean(user)}
        />
      </div>
    </>
  );
}