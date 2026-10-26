import BatchTestForm from "@/components/BatchTestForm";
import BatchHistoryTable from "@/components/BatchHistoryTable";
import { listBatches } from "@/lib/server/db";
import { currentScope } from "@/lib/auth";

export default async function BatchPage() {
  const scope = await currentScope();
  const batches = await listBatches(scope);

  return (
    <>
      <header className="px-gutter py-md border-b border-outline-variant/20 bg-background/80 backdrop-blur-md sticky top-0 z-30">
        <h2 className="font-headline-md text-headline-md text-on-surface">
          Batch Evaluation
        </h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
          Run a full dataset of prompts against every model and get a
          RAGAS-style accuracy report (exact-match / ROUGE-L / BLEU / faithfulness).
        </p>
      </header>
      <div className="p-gutter flex-1 max-w-container-max w-full mx-auto">
        <BatchTestForm />
        <div className="mt-xl">
          <BatchHistoryTable initialBatches={batches} />
        </div>
      </div>
    </>
  );
}
