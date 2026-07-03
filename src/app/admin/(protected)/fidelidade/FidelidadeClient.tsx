"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, StatCard, Badge } from "@/components/admin/ui";
import { IconStar, IconUsers, IconCheck, IconTrash } from "@/components/Icons";
import type { Customer } from "@/lib/customers-store";
import type { Reward, LoyaltyConfig } from "@/lib/loyalty";

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export default function FidelidadeClient() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [menuItems, setMenuItems] = useState<string[]>([]); // itens do cardápio p/ sugerir prêmio
  const [loaded, setLoaded] = useState(false);
  const [openPhone, setOpenPhone] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [cfg, setCfg] = useState<LoyaltyConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/pontos", { cache: "no-store" });
      const data = await res.json();
      setCustomers(data.customers ?? []);
      setRewards(data.rewards ?? []);
      setMenuItems(data.menuItems ?? []);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
    fetch("/api/loyalty", { cache: "no-store" }).then((r) => r.json()).then((d) => setCfg(d.config));
  }, [load]);

  const patch = (p: Partial<LoyaltyConfig>) => setCfg((c) => (c ? { ...c, ...p } : c));
  const setRewardPts = (i: number, points: number) =>
    setCfg((c) => (c ? { ...c, rewards: c.rewards.map((r, idx) => (idx === i ? { ...r, points } : r)) } : c));
  const setRewardLabel = (i: number, label: string) =>
    setCfg((c) => (c ? { ...c, rewards: c.rewards.map((r, idx) => (idx === i ? { ...r, label } : r)) } : c));
  const addReward = () => setCfg((c) => (c ? { ...c, rewards: [...c.rewards, { points: 100, label: "" }] } : c));
  const removeReward = (i: number) => setCfg((c) => (c ? { ...c, rewards: c.rewards.filter((_, idx) => idx !== i) } : c));

  async function saveCfg() {
    if (!cfg) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/loyalty", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cfg) });
      const d = await res.json();
      if (d.config) {
        setCfg(d.config);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
        load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function doRedeem(phone: string, rewardPoints: number) {
    await fetch("/api/pontos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, rewardPoints }),
    });
    setOpenPhone(null);
    load();
  }

  const totalPoints = customers.reduce((s, c) => s + c.points, 0);
  const redemptions = customers.reduce(
    (s, c) => s + c.history.filter((h) => h.type === "redeem").length,
    0,
  );
  const maxReward = rewards.length ? rewards[rewards.length - 1].points : Infinity;
  const close = customers.filter((c) => {
    const next = rewards.find((r) => r.points > c.points);
    return next && next.points - c.points <= 30;
  }).length;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Clientes" value={String(customers.length)} hint="no programa" Icon={IconUsers} tone="brand" />
        <StatCard label="Pontos ativos" value={String(totalPoints)} hint="em circulação" Icon={IconStar} tone="gold" />
        <StatCard label="Perto do prêmio" value={String(close)} hint="faltam ≤ 30 pts" Icon={IconStar} tone="accent" />
        <StatCard label="Resgates" value={String(redemptions)} hint="já trocados" Icon={IconCheck} tone="lime" />
      </div>

      {/* Configurar fidelidade — editável pelo dono */}
      {cfg && (
        <Card className="mt-6 p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Configurar fidelidade</h2>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">Você define as regras — vale para as próximas vendas.</p>
            </div>
            <button onClick={saveCfg} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg brand-gradient px-4 py-2 text-sm font-bold text-white shadow-[var(--shadow-brand)] disabled:opacity-60">
              {saving ? "Salvando..." : saved ? <><IconCheck width={15} height={15} /> Salvo!</> : "Salvar alterações"}
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-bold uppercase text-[var(--text-muted)]">Pontos por R$ 1 gasto</span>
              <input type="number" step="0.1" min="0.1" value={cfg.pointsPerBrl} disabled={cfg.fixedPointsPerSale > 0} onChange={(e) => patch({ pointsPerBrl: Number(e.target.value) })}
                className="mt-1 w-full rounded-xl border border-line bg-bg-elevated px-3.5 py-2.5 text-sm font-semibold text-ink outline-none focus:border-brand-600 disabled:opacity-40" />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase text-[var(--text-muted)]">Pontos fixos por compra</span>
              <input type="number" min="0" value={cfg.fixedPointsPerSale} onChange={(e) => patch({ fixedPointsPerSale: Number(e.target.value) })}
                className="mt-1 w-full rounded-xl border border-line bg-bg-elevated px-3.5 py-2.5 text-sm font-semibold text-ink outline-none focus:border-brand-600" />
              <span className="mt-1 block text-[11px] text-[var(--text-faded)]">Se &gt; 0, toda compra acima do mínimo dá esses pontos, não importa o valor (ignora "pontos por R$1"). 0 = pontua por valor gasto.</span>
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase text-[var(--text-muted)]">Validade dos pontos (dias)</span>
              <input type="number" min="7" value={cfg.validityDays} onChange={(e) => patch({ validityDays: Number(e.target.value) })}
                className="mt-1 w-full rounded-xl border border-line bg-bg-elevated px-3.5 py-2.5 text-sm font-semibold text-ink outline-none focus:border-brand-600" />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase text-[var(--text-muted)]">Dia com pontos turbinados</span>
              <select value={cfg.doubleDay ?? ""} onChange={(e) => patch({ doubleDay: e.target.value === "" ? null : Number(e.target.value) })}
                className="mt-1 w-full rounded-xl border border-line bg-bg-elevated px-3.5 py-2.5 text-sm font-semibold text-ink outline-none focus:border-brand-600">
                <option value="">Nenhum</option>
                {DIAS.map((d, i) => <option key={i} value={i}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase text-[var(--text-muted)]">Multiplicador do dia turbo</span>
              <input type="number" step="0.5" min="1" value={cfg.doubleMultiplier} onChange={(e) => patch({ doubleMultiplier: Number(e.target.value) })}
                className="mt-1 w-full rounded-xl border border-line bg-bg-elevated px-3.5 py-2.5 text-sm font-semibold text-ink outline-none focus:border-brand-600" />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase text-[var(--text-muted)]">Bônus de 1ª compra (pontos de boas-vindas)</span>
              <input type="number" min="0" value={cfg.firstPurchaseBonus} onChange={(e) => patch({ firstPurchaseBonus: Number(e.target.value) })}
                className="mt-1 w-full rounded-xl border border-line bg-bg-elevated px-3.5 py-2.5 text-sm font-semibold text-ink outline-none focus:border-brand-600" />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase text-[var(--text-muted)]">Valor mínimo pra pontuar (R$)</span>
              <div className="mt-1 flex items-center rounded-xl border border-line bg-bg-elevated px-3.5">
                <span className="text-sm font-semibold text-[var(--text-muted)]">R$</span>
                <input type="number" step="0.5" min="0" value={cfg.minEarnCents ? cfg.minEarnCents / 100 : 0}
                  onChange={(e) => patch({ minEarnCents: Math.max(0, Math.round((Number(e.target.value) || 0) * 100)) })}
                  className="w-full bg-transparent px-2 py-2.5 text-sm font-semibold text-ink outline-none" />
              </div>
              <span className="mt-1 block text-[11px] text-[var(--text-faded)]">Abaixo desse valor a venda não pontua. 0 = sem mínimo.</span>
            </label>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-xs font-bold uppercase text-[var(--text-muted)]">Prêmios — o que o cliente troca por pontos</div>
              <button type="button" onClick={addReward} className="shrink-0 rounded-lg border border-brand-600 px-2.5 py-1.5 text-xs font-bold text-brand-600">+ Adicionar prêmio</button>
            </div>
            <div className="space-y-2">
              {cfg.rewards.map((r, i) => (
                <div key={i} className="flex items-center gap-2 rounded-xl bg-bg-surface-2 p-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg brand-gradient text-white"><IconStar width={15} height={15} /></span>
                  <input value={r.label} onChange={(e) => setRewardLabel(i, e.target.value)} list="cardapio-itens" placeholder="Escolha do cardápio ou digite (ex: Copo 500ml)"
                    className="min-w-0 flex-1 rounded-lg border border-line bg-bg-elevated px-3 py-2 text-sm font-bold text-ink outline-none focus:border-brand-600" />
                  <input type="number" min="1" value={r.points} onChange={(e) => setRewardPts(i, Number(e.target.value))}
                    className="w-20 shrink-0 rounded-lg border border-line bg-bg-elevated px-2 py-2 text-right text-sm font-bold text-ink outline-none focus:border-brand-600" />
                  <span className="shrink-0 text-xs font-semibold text-[var(--text-muted)]">pts</span>
                  <button type="button" onClick={() => removeReward(i)} aria-label="Remover prêmio" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[var(--text-faded)] hover:text-[var(--red-no)]"><IconTrash width={15} height={15} /></button>
                </div>
              ))}
              {cfg.rewards.length === 0 && <p className="rounded-xl border border-dashed border-line p-3 text-center text-xs text-[var(--text-muted)]">Nenhum prêmio ainda — adicione o que o cliente pode trocar por pontos.</p>}
            </div>
            {/* sugestões = itens reais do cardápio da loja; o dono ainda pode digitar livre */}
            <datalist id="cardapio-itens">
              {menuItems.map((n) => <option key={n} value={n} />)}
            </datalist>
            {menuItems.length > 0 && <p className="mt-2 text-[11px] text-[var(--text-faded)]">Dica: clique no campo do prêmio pra escolher um item do seu cardápio.</p>}
          </div>

          <p className="mt-4 rounded-xl bg-bg-surface-2 p-3 text-xs text-[var(--text-muted)]">
            Pontos nunca viram dinheiro nem desconto — só troca por item inteiro. As alterações valem para as próximas vendas.
          </p>
        </Card>
      )}

      {/* Clientes — consulta de saldo */}
      <div className="mb-3 mt-6 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Consultar saldo · clientes</h2>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome ou telefone..."
          className="w-full rounded-xl border border-line bg-bg-elevated px-4 py-2.5 text-sm outline-none focus:border-brand-600 sm:w-72"
        />
      </div>
      {loaded && customers.length === 0 && (
        <div className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-[var(--text-muted)]">
          Ainda não há clientes com pontos. Eles entram quando uma venda é feita com o cliente identificado.
        </div>
      )}
      <div className="space-y-2.5">
        {customers
          .filter((c) => {
            const t = q.trim().toLowerCase();
            const dig = q.replace(/\D+/g, "");
            return !t || c.name.toLowerCase().includes(t) || (dig && c.phone.includes(dig));
          })
          .map((c) => {
          const available = rewards.filter((r) => r.points <= c.points);
          const open = openPhone === c.phone;
          return (
            <Card key={c.phone} className="p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-bg-surface-2 text-brand-600">
                  <IconUsers width={18} height={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-ink">{c.name}</div>
                  <div className="text-xs text-[var(--text-muted)]">{c.phone}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-extrabold text-brand-600">{c.points}</div>
                  <div className="text-[11px] font-semibold text-[var(--text-muted)]">pontos</div>
                </div>
                <button
                  onClick={() => setOpenPhone(open ? null : c.phone)}
                  disabled={available.length === 0}
                  className="shrink-0 rounded-lg brand-gradient px-3 py-2 text-xs font-bold text-white disabled:bg-none disabled:bg-bg-surface-2 disabled:text-[var(--text-faded)]"
                >
                  {available.length ? "Resgatar" : "Sem prêmio"}
                </button>
              </div>

              {open && available.length > 0 && (
                <div className="mt-3 animate-pop rounded-xl bg-bg-surface-2 p-3">
                  <div className="mb-2 text-xs font-bold text-ink">Confirmar resgate no balcão:</div>
                  <div className="flex flex-wrap gap-2">
                    {available.map((r) => (
                      <button
                        key={r.points}
                        onClick={() => doRedeem(c.phone, r.points)}
                        className="rounded-lg border border-brand-600 bg-bg-elevated px-3 py-2 text-xs font-bold text-brand-600"
                      >
                        {r.label} <span className="text-[var(--text-muted)]">(-{r.points})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}
