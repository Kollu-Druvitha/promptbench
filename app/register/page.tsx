import AuthForm from "@/components/AuthForm";

export default function RegisterPage() {
  return (
    <>
      <header className="px-gutter py-md border-b border-outline-variant/20 bg-background/80 backdrop-blur-md sticky top-0 z-30">
        <h2 className="font-headline-md text-headline-md text-on-surface">
          Create a workspace
        </h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
          Create a workspace to keep this project's test history separate from
          anything else you run.
        </p>
      </header>
      <div className="p-gutter flex-1 flex items-start justify-center pt-lg">
        <AuthForm mode="register" />
      </div>
    </>
  );
}