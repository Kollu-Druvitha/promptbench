type BadgeKind = "quality" | "speed" | "value";

const BADGE_CONFIG: Record<
  BadgeKind,
  { label: string; icon: string; colorClass: string }
> = {
  quality: {
    label: "Best Quality",
    icon: "workspace_premium",
    colorClass: "text-secondary bg-secondary/10 border-secondary",
  },
  speed: {
    label: "Fastest",
    icon: "bolt",
    colorClass: "text-tertiary bg-tertiary/10 border-tertiary",
  },
  value: {
    label: "Best Value",
    icon: "savings",
    colorClass: "text-primary bg-primary/10 border-primary",
  },
};

export default function ScoreBadge({ kind }: { kind: BadgeKind }) {
  const config = BADGE_CONFIG[kind];
  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-full border font-mono-label text-[11px] uppercase tracking-wider whitespace-nowrap ${config.colorClass}`}
    >
      <span
        className="material-symbols-outlined text-[14px] mr-1"
        style={{ fontVariationSettings: "'FILL' 1" }}
      >
        {config.icon}
      </span>
      {config.label}
    </span>
  );
}
