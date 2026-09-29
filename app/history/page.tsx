import { listTests, getStats } from "@/lib/server/db";
import { currentUser, currentScope } from "@/lib/auth";
import HistoryView from "@/components/HistoryView";

export default async function HistoryPage() {
  const scope = await currentScope();
  const user = await currentUser();
  const records = await listTests(scope);
  const stats = await getStats(scope);

  return (
    <>
      <header className="px-gutter py-md border-b border-outline-variant/20 bg-background/80 backdrop-blur-md sticky top-0 z-30 flex justify-between items-center">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface">
            Test History
          </h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 flex items-center gap-2">
            Review past evaluation runs and performance metrics.
            <span className="px-2 py-0.5 rounded-full bg-surface-container border border-outline-variant font-mono-label text-[10px] text-on-surface-variant uppercase tracking-wider">
              {user ? `as @${user.username}` : "local workspace"}
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <button className="p-2 rounded border border-outline-variant text-on-surface-variant hover:bg-surface-bright hover:text-on-surface transition-colors flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">
              filter_list
            </span>
          </button>
          <button className="p-2 rounded border border-outline-variant text-on-surface-variant hover:bg-surface-bright hover:text-on-surface transition-colors flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">
              download
            </span>
          </button>
        </div>
      </header>

      <HistoryView initialRecords={records} initialStats={stats} />
    </>
  );
}
