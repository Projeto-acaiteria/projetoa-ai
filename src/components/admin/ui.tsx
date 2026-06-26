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
    brand: "bg-[#EEF2FF] text-brand-600",
    lime: "bg-[#E8F6DD] text-lime",
    gold: "bg-[#FBF1DC] text-gold",
    accent: "bg-[#FBF1DC] text-accent",
  }[tone];
  // cor do tom pra gradiente/orb/acento (padrão palace adaptado ao light)
  const toneVar = { brand: "var(--brand-600)", lime: "var(--green-ok)", gold: "var(--gold)", accent: "var(--accent)" }[tone];
  return (
    <div className="card relative overflow-hidden p-4" style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${toneVar} 8%, var(--bg-elevated)) 0%, var(--bg-elevated) 62%)` }}>
      <span className="pointer-events-none absolute inset-x-0 top-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${toneVar}, transparent)` }} aria-hidden />
      <span className="pointer-events-none absolute -right-7 -top-9 h-24 w-24 rounded-full blur-2xl" style={{ background: `color-mix(in srgb, ${toneVar} 20%, transparent)` }} aria-hidden />
      <div className="relative flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{label}</span>
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${toneBg}`}>
          <Icon width={17} height={17} />
        </span>
      </div>
      <div className="relative mt-2 text-2xl font-extrabold tabular-nums text-ink">{value}</div>
      {hint && <div className="relative mt-0.5 text-xs font-medium text-[var(--text-muted)]">{hint}</div>}
    </div>
  );
}

export function Badge({ children, tone = "brand" }: { children: ReactNode; tone?: "brand" | "lime" | "gold" | "accent" | "muted" }) {
  const map = {
    brand: "bg-[#EEF2FF] text-brand-600",
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
