import { listTests, getStats } from "@/lib/server/db";
import { currentUser, currentScope } from "@/lib/auth";
import HistoryTable from "@/components/HistoryTable";

export default async function HistoryPage() {
  const scope = await currentScope();
  const user = await currentUser();
  const records = listTests(scope);
  const stats = getStats(scope);

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

      <div className="p-gutter flex-1 space-y-xl overflow-y-auto max-w-container-max w-full mx-auto">
        <section className="grid grid-cols-1 md:grid-cols-3 gap-md">
          <StatCard
            label="Total Tests Run"
            value={stats.totalTestsRun.toLocaleString()}
            icon="stacked_line_chart"
          />
          <StatCard
            label="Total Spend"
            value={`$${stats.totalSpend.toFixed(2)}`}
            icon="payments"
          />
          <StatCard
            label="Most Used Model"
            value={stats.mostUsedModel}
            icon="smart_toy"
            valueIsPill
          />
        </section>

        <HistoryTable records={records} />
      </div>
    </>
  );
}

function StatCard({
  label,
  value,
  icon,
  valueIsPill,
}: {
  label: string;
  value: string;
  icon: string;
  valueIsPill?: boolean;
}) {
  return (
    <div className="bg-surface border border-outline-variant rounded-lg p-md flex flex-col justify-between h-32 relative overflow-hidden group">
      <div className="flex justify-between items-start relative z-10">
        <span className="font-mono-label text-mono-label text-on-surface-variant uppercase tracking-wider">
          {label}
        </span>
        <span className="material-symbols-outlined text-outline-variant">
          {icon}
        </span>
      </div>
      {valueIsPill ? (
        <span className="inline-flex w-fit items-center px-3 py-1 rounded bg-secondary-container/10 border border-secondary-container/30 text-secondary-fixed font-mono-metric text-mono-metric relative z-10">
          {value}
        </span>
      ) : (
        <div className="font-mono-metric text-display-lg text-on-surface relative z-10">
          {value}
        </div>
      )}
    </div>
  );
}
