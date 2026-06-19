"use client";

import { useState } from "react";
import type { Customer } from "@/lib/customers-store";
import type { Reward } from "@/lib/loyalty";
import { IconStar, IconCheck, IconArrowRight } from "@/components/Icons";

export default function MeusPontosClient() {
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
      const res = await fetch(`/api/pontos?phone=${encodeURIComponent(phone)}`, { cache: "no-store" });
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
          <p className="text-sm text-[var(--text-muted)]">
            Não achamos pontos nesse telefone ainda. Faça um pedido e comece a juntar!
          </p>
        </div>
      )}

      {customer && (
        <>
          {/* Saldo */}
          <div className="mt-5 overflow-hidden rounded-3xl brand-gradient p-6 text-white shadow-[var(--shadow-brand)]">
            <div className="text-sm font-semibold text-white/80">Olá, {customer.name}</div>
            <div className="mt-1 flex items-end gap-2">
              <span className="text-5xl font-extrabold leading-none">{points}</span>
              <span className="mb-1 text-lg font-bold text-white/90">pontos</span>
            </div>
            {next ? (
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-xs font-semibold text-white/90">
                  <span>Faltam {missing} pra {next.label}</span>
                  <span>{pct}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-white/25">
                  <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
                </div>
              </div>
            ) : (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-sm font-bold">
                <IconCheck width={15} height={15} /> Você já pode resgatar o prêmio máximo!
              </div>
            )}
          </div>

          {/* Tabela de recompensas */}
          <h2 className="mb-2 mt-6 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">
            Troque seus pontos
          </h2>
          <div className="space-y-2.5">
            {rewards.map((r) => {
              const ok = points >= r.points;
              return (
                <div
                  key={r.points}
                  className={`flex items-center gap-3 rounded-2xl border p-3.5 ${
                    ok ? "border-brand-600 bg-bg-surface-2" : "border-line bg-bg-elevated"
                  }`}
                >
                  <span
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
                      ok ? "brand-gradient text-white" : "bg-bg-surface-2 text-[var(--text-faded)]"
                    }`}
                  >
                    <IconStar width={18} height={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-ink">{r.label}</div>
                    <div className="text-xs font-semibold text-[var(--text-muted)]">{r.points} pontos</div>
                  </div>
                  {ok ? (
                    <span className="rounded-full bg-[#E8F6DD] px-2.5 py-1 text-[11px] font-bold text-lime">
                      disponível
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-[var(--text-faded)]">
                      faltam {r.points - points}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-center text-xs text-[var(--text-faded)]">
            O resgate é feito no balcão com o atendente. Pontos viram açaí, nunca dinheiro.
          </p>

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
