"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AuthMenu from "./AuthMenu";

const NAV_ITEMS = [
  { href: "/", label: "New Test", icon: "add_box" },
  { href: "/recommend", label: "Recommend", icon: "smart_toy" },
  { href: "/results", label: "Results", icon: "analytics" },
  { href: "/compare", label: "Compare", icon: "compare_arrows" },
  { href: "/history", label: "History", icon: "history" },
];

export default function SideNav() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col fixed left-0 top-0 h-screen z-40 w-64 bg-surface-container border-r border-outline-variant">
      <div className="flex items-center gap-sm p-lg border-b border-outline-variant">
        <div className="w-8 h-8 rounded bg-primary-container flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-xl">
            terminal
          </span>
        </div>
        <div>
          <h1 className="font-headline-sm text-headline-sm font-bold text-on-surface">
            PromptBench
          </h1>
          <p className="font-mono-label text-mono-label text-on-surface-variant">
            v0.1.0-dev
          </p>
        </div>
      </div>

      <div className="p-4">
        <Link
          href="/"
          className="w-full bg-surface-bright text-on-surface border border-outline-variant py-2 rounded flex items-center justify-center gap-xs font-mono-label text-mono-label hover:bg-surface-container-high transition-colors"
        >
          <span className="material-symbols-outlined text-sm">play_arrow</span>
          Run Evaluation
        </Link>
      </div>

      <nav className="flex-1 flex flex-col mt-2">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                isActive
                  ? "bg-surface-bright text-primary border-l-4 border-primary px-4 py-3 flex items-center gap-md font-mono-label text-mono-label cursor-pointer"
                  : "text-on-surface-variant px-4 py-3 hover:bg-surface-container-high transition-all flex items-center gap-md font-mono-label text-mono-label cursor-pointer"
              }
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-outline-variant py-2">
        <AuthMenu />
        <a
          className="text-on-surface-variant px-4 py-3 hover:bg-surface-container-high transition-all flex items-center gap-md font-mono-label text-mono-label cursor-pointer"
          href="#"
        >
          <span className="material-symbols-outlined">menu_book</span>
          Documentation
        </a>
        <a
          className="text-on-surface-variant px-4 py-3 hover:bg-surface-container-high transition-all flex items-center gap-md font-mono-label text-mono-label cursor-pointer"
          href="#"
        >
          <span className="material-symbols-outlined">help_outline</span>
          Support
        </a>
      </div>
    </aside>
  );
}
