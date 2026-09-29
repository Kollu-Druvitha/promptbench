import { getTest } from "@/lib/server/db";
import { currentScope } from "@/lib/auth";
import ResultsView from "@/components/ResultsView";

export default async function TestResultsPage({
  params,
}: {
  params: Promise<{ testId: string }>;
}) {
  const { testId } = await params;
  const scope = await currentScope();

  // Best-effort server lookup. When the record isn't there (e.g. an ephemeral
  // serverless instance that lost the in-memory fallback), don't 404 — let the
  // client recovery in ResultsView bring it back from the session cache.
  const record = await getTest(testId, scope);

  return (
    <>
      <header className="px-gutter py-md border-b border-outline-variant/20 bg-background/80 backdrop-blur-md sticky top-0 z-30">
        <h2 className="font-headline-md text-headline-md text-on-surface">
          Test Results
        </h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
          Side-by-side comparison for this evaluation run.
        </p>
      </header>
      <div className="p-gutter flex-1 max-w-container-max w-full mx-auto">
        <ResultsView testId={testId} record={record} />
      </div>
    </>
  );
}
