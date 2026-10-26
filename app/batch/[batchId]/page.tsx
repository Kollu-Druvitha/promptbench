import { getBatch } from "@/lib/server/db";
import { currentScope } from "@/lib/auth";
import BatchResultsView from "@/components/BatchResultsView";

export default async function BatchResultsPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  const scope = await currentScope();

  // Best-effort server lookup. When the record isn't there (e.g. an ephemeral
  // serverless instance that lost the in-memory fallback), don't 404 — let the
  // client recovery in BatchResultsView bring it back from the session cache.
  const record = await getBatch(batchId, scope);

  return (
    <>
      <header className="px-gutter py-md border-b border-outline-variant/20 bg-background/80 backdrop-blur-md sticky top-0 z-30">
        <h2 className="font-headline-md text-headline-md text-on-surface">
          Batch Results
        </h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
          Dataset accuracy report across models.
        </p>
      </header>
      <div className="flex-1 w-full">
        <BatchResultsView batchId={batchId} initialRecord={record} />
      </div>
    </>
  );
}
