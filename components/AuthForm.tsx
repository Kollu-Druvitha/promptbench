"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loginUser, registerUser } from "@/lib/api";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") {
        await loginUser(username, password);
      } else {
        await registerUser(username, password);
      }
      router.push("/recommend");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-sm w-full bg-surface border border-outline-variant rounded-lg p-md shadow-sm">
      <div className="flex items-center gap-2 mb-md">
        <span className="material-symbols-outlined text-primary">workspace_premium</span>
        <h2 className="font-headline-sm text-headline-sm text-on-surface">
          {mode === "login" ? "Sign in to workspace" : "Create workspace"}
        </h2>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-md">
        <label className="flex flex-col gap-1">
          <span className="font-mono-label text-mono-label text-on-surface-variant uppercase text-[11px]">
            Workspace name
          </span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. project_alex"
            autoComplete="username"
            className="bg-surface-container-lowest border border-outline-variant text-on-surface font-mono-label text-mono-label rounded p-2.5 focus:border-tertiary-fixed-dim focus:ring-1 focus:ring-tertiary-fixed-dim focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono-label text-mono-label text-on-surface-variant uppercase text-[11px]">
            Password
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="8+ characters"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className="bg-surface-container-lowest border border-outline-variant text-on-surface font-mono-label text-mono-label rounded p-2.5 focus:border-tertiary-fixed-dim focus:ring-1 focus:ring-tertiary-fixed-dim focus:outline-none"
          />
        </label>

        {error && (
          <p className="font-body-sm text-body-sm text-error bg-error/10 border border-error/30 rounded p-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !username.trim() || !password}
          className="bg-surface-bright text-on-surface border border-outline-variant py-2.5 rounded font-mono-label text-mono-label hover:bg-surface-container-high transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-[18px]">
            {busy ? "hourglass_empty" : mode === "login" ? "login" : "person_add"}
          </span>
          {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create workspace"}
        </button>

        <p className="text-center font-body-sm text-body-sm text-on-surface-variant">
          {mode === "login" ? "No workspace yet?" : "Already have a workspace?"}{" "}
          <Link
            href={mode === "login" ? "/register" : "/login"}
            className="text-primary hover:underline"
          >
            {mode === "login" ? "Create workspace" : "Sign in"}
          </Link>
        </p>
      </form>
    </div>
  );
}