"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getMe, logoutUser } from "@/lib/api";

export default function AuthMenu() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; username: string } | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getMe()
      .then((r) => setUser(r.user))
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) {
    return <div className="px-4 py-3 text-on-surface-variant font-mono-label text-mono-label">···</div>;
  }

  if (!user) {
    return (
      <div className="px-4 pb-2 flex flex-col gap-1">
        <Link
          href="/login"
          className="text-on-surface-variant px-4 py-2 hover:bg-surface-container-high transition-all flex items-center gap-md font-mono-label text-mono-label"
        >
          <span className="material-symbols-outlined">login</span>
          Sign in to workspace
        </Link>
        <Link
          href="/register"
          className="text-on-surface-variant px-4 py-2 hover:bg-surface-container-high transition-all flex items-center gap-md font-mono-label text-mono-label"
        >
          <span className="material-symbols-outlined">person_add</span>
          Create workspace
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 pb-2">
      <div className="px-4 py-2 rounded bg-surface-container-low border border-outline-variant flex items-center gap-2">
        <span className="material-symbols-outlined text-[18px] text-secondary-fixed">
          workspace_premium
        </span>
        <div className="flex flex-col min-w-0">
          <span className="font-mono-label text-mono-label text-on-surface truncate">
            @{user.username}
          </span>
          <span className="font-mono-label text-mono-label text-on-surface-variant text-[10px]">
            workspace · separate history
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={async () => {
          await logoutUser();
          router.push("/");
          router.refresh();
        }}
        className="w-full mt-1 text-on-surface-variant px-4 py-2 hover:bg-surface-container-high transition-all flex items-center gap-md font-mono-label text-mono-label"
      >
        <span className="material-symbols-outlined">logout</span>
        Sign out
      </button>
    </div>
  );
}