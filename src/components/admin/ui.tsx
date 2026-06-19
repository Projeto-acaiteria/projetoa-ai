import type { ReactNode } from "react";

export function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-extrabold text-ink sm:text-2xl">{title}</h1>
        {sub && <p className="mt-1 text-sm text-[var(--text-muted)]">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  Icon,
  tone = "brand",
}: {
  label: string;
  value: string;
  hint?: string;
  Icon: (p: { width?: number; height?: number; className?: string }) => ReactNode;
  tone?: "brand" | "lime" | "gold" | "accent";
}) {
  const toneBg = {
    brand: "bg-[#EFE6FF] text-brand-600",
    lime: "bg-[#E8F6DD] text-lime",
    gold: "bg-[#FBF1DC] text-gold",
    accent: "bg-[#FBF1DC] text-accent",
  }[tone];
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">{label}</span>
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${toneBg}`}>
          <Icon width={17} height={17} />
        </span>
      </div>
      <div className="mt-2 text-2xl font-extrabold text-ink">{value}</div>
      {hint && <div className="mt-0.5 text-xs font-medium text-[var(--text-muted)]">{hint}</div>}
    </div>
  );
}

export function Badge({ children, tone = "brand" }: { children: ReactNode; tone?: "brand" | "lime" | "gold" | "accent" | "muted" }) {
  const map = {
    brand: "bg-[#EFE6FF] text-brand-600",
    lime: "bg-[#E8F6DD] text-lime",
    gold: "bg-[#FBF1DC] text-gold",
    accent: "bg-[#FBF1DC] text-accent",
    muted: "bg-bg-surface-2 text-[var(--text-muted)]",
  }[tone];
  return <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${map}`}>{children}</span>;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}
