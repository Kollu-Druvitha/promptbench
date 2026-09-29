import { notFound } from "next/navigation";
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
  const record = await getTest(testId, scope);
  if (!record) notFound();

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
        <ResultsView record={record} />
      </div>
    </>
  );
}
