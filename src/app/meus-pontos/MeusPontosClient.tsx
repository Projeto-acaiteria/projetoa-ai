"use client";

import { useState } from "react";
import type { Customer } from "@/lib/customers-store";
import type { Reward } from "@/lib/loyalty";
import { IconStar, IconCheck, IconArrowRight } from "@/components/Icons";

const IconLock = (p: { width?: number; height?: number; className?: string }) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
);
const IconGift = (p: { width?: number; height?: number; className?: string }) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M20 12v9H4v-9M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" /></svg>
);

export default function MeusPontosClient({ storeId }: { storeId?: string }) {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);

  async function consultar() {
    if (!phone.trim()) return;
    setLoading(true);
    setSearched(false);
    try {
      const res = await fetch(`/api/pontos?phone=${encodeURIComponent(phone)}${storeId ? `&store=${storeId}` : ""}`, { cache: "no-store" });
      const data = await res.json();
      setCustomer(data.customer);
      setRewards(data.rewards ?? []);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }

  const points = customer?.points ?? 0;
  const next = rewards.find((r) => r.points > points);
  const missing = next ? next.points - points : 0;
  const pct = next ? Math.min(100, Math.round((points / next.points) * 100)) : 100;

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      {/* Busca */}
      <div className="card p-4">
        <label className="text-sm font-bold text-ink">Consulte seus pontos</label>
        <p className="mb-3 text-xs text-[var(--text-muted)]">Digite o telefone que você usa nos pedidos.</p>
        <div className="flex gap-2">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && consultar()}
            inputMode="tel"
            placeholder="(99) 90000-0000"
            className="min-w-0 flex-1 rounded-xl border border-line bg-bg-base px-4 py-3 text-ink outline-none focus:border-brand-600"
          />
          <button
            onClick={consultar}
            disabled={loading}
            className="shrink-0 rounded-xl brand-gradient px-5 font-bold text-white shadow-[var(--shadow-brand)] disabled:opacity-60"
          >
            {loading ? "..." : "Ver"}
          </button>
        </div>
      </div>

      {/* Resultado */}
      {searched && !customer && (
        <div className="mt-5 card p-6 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-bg-surface-2 text-brand-600"><IconStar width={24} height={24} /></div>
          <p className="text-sm font-bold text-ink">Ainda não achamos pontos nesse telefone</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Faça seu primeiro pedido e já comece a juntar — cada compra te aproxima de um prêmio.</p>
        </div>
      )}

      {customer && (
        <>
          {/* Hero — saldo + progresso pro próximo prêmio (goal-gradient) */}
          <div className="relative mt-5 overflow-hidden rounded-3xl brand-gradient p-6 text-white shadow-[var(--shadow-brand)]">
            <div className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
            <div className="relative">
              <div className="text-sm font-semibold text-white/80">Olá, {customer.name.split(" ")[0]}</div>
              <div className="mt-1 flex items-end gap-2">
                <span className="text-6xl font-extrabold leading-none tabular-nums">{points}</span>
                <span className="mb-1.5 text-base font-bold text-white/85">pontos</span>
              </div>
              {next ? (
                <div className="mt-5">
                  <div className="mb-1.5 flex items-baseline justify-between text-sm font-bold">
                    <span>Faltam {missing} pra {next.label}</span>
                    <span className="text-white/70">{pct}%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-white/20">
                    <div className="h-full rounded-full bg-white transition-[width] duration-700 ease-out" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              ) : (
                <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3.5 py-1.5 text-sm font-bold">
                  <IconCheck width={16} height={16} /> Você já pode resgatar o prêmio máximo!
                </div>
              )}
            </div>
          </div>

          {rewards.some((r) => points >= r.points) && (
            <div className="mt-3 flex items-center gap-3 rounded-2xl border border-brand-400 bg-[#EEF2FF] p-3.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full brand-gradient text-white"><IconGift width={18} height={18} /></span>
              <p className="text-sm font-bold text-ink">Você já pode resgatar um prêmio! <span className="font-semibold text-[var(--text-muted)]">Mostre este telefone no balcão.</span></p>
            </div>
          )}

          {/* Trilha de prêmios — alcançados coloridos, bloqueados com cadeado */}
          <h2 className="mb-2.5 mt-7 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Sua trilha de prêmios</h2>
          <div className="space-y-2.5">
            {rewards.map((r) => {
              const ok = points >= r.points;
              return (
                <div key={r.points} className={`flex items-center gap-3 rounded-2xl border p-3.5 transition ${ok ? "border-brand-600 bg-[#EEF2FF] shadow-[var(--shadow-card)]" : "border-line bg-bg-elevated"}`}>
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${ok ? "brand-gradient text-white" : "bg-bg-surface-2 text-[var(--text-faded)]"}`}>
                    {ok ? <IconStar width={19} height={19} /> : <IconLock width={17} height={17} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-extrabold text-ink">{r.label}</div>
                    <div className="text-xs font-semibold text-[var(--text-muted)]">{r.points} pontos</div>
                  </div>
                  {ok ? (
                    <span className="shrink-0 rounded-full bg-[#E8F6DD] px-2.5 py-1 text-[11px] font-bold text-lime">disponível</span>
                  ) : (
                    <span className="shrink-0 text-right text-[11px] font-bold leading-tight text-brand-600">faltam<br />{r.points - points}</span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-center text-xs text-[var(--text-faded)]">O resgate é no balcão com o atendente. <b className="text-[var(--text-muted)]">Pontos viram açaí, nunca dinheiro.</b></p>

          {/* Histórico */}
          {customer.history.length > 0 && (
            <>
              <h2 className="mb-2 mt-6 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">
                Histórico
              </h2>
              <div className="card divide-y divide-[var(--line)]">
                {customer.history.slice(0, 8).map((h, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="flex items-center gap-2 text-ink-2">
                      <IconArrowRight width={14} height={14} className="text-brand-600" />
                      {h.type === "earn" ? `Pedido ${h.ref}` : h.ref}
                    </span>
                    <span className={`font-bold ${h.points >= 0 ? "text-lime" : "text-[var(--red-no)]"}`}>
                      {h.points >= 0 ? "+" : ""}
                      {h.points}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
