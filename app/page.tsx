import TestForm from "@/components/TestForm";

export default function NewTestPage() {
  return (
    <>
      <header className="px-gutter py-md border-b border-outline-variant/20 bg-background/80 backdrop-blur-md sticky top-0 z-30">
        <h2 className="font-headline-md text-headline-md text-on-surface">
          New Test
        </h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
          Run the same prompt across selected models and compare results.
        </p>
      </header>
      <div className="p-gutter flex-1 max-w-container-max w-full mx-auto">
        <TestForm />
      </div>
    </>
  );
}
