import Link from "next/link";

export default function ResultsIndexPage() {
  return (
    <>
      <header className="px-gutter py-md border-b border-outline-variant/20 bg-background/80 backdrop-blur-md sticky top-0 z-30">
        <h2 className="font-headline-md text-headline-md text-on-surface">
          Results
        </h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
          Results appear here after you run a test.
        </p>
      </header>
      <div className="p-gutter flex-1 max-w-container-max w-full mx-auto flex flex-col items-center justify-center gap-md text-center">
        <span className="material-symbols-outlined text-outline-variant text-[48px]">
          analytics
        </span>
        <p className="font-body-md text-body-md text-on-surface-variant max-w-sm">
          No test open yet. Run a new test, or pick a past one from your
          history.
        </p>
        <div className="flex gap-sm">
          <Link
            href="/"
            className="bg-surface-bright text-on-surface border border-outline-variant px-4 py-2 rounded font-mono-label text-mono-label hover:bg-surface-container-high transition-colors"
          >
            New Test
          </Link>
          <Link
            href="/history"
            className="bg-surface-container text-on-surface-variant border border-outline-variant px-4 py-2 rounded font-mono-label text-mono-label hover:bg-surface-container-high transition-colors"
          >
            View History
          </Link>
        </div>
      </div>
    </>
  );
}
