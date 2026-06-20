"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/admin/ui";

type Acerto = { id: string; name: string; commission_percent: number; active: boolean; comandas: number; vendidoCents: number; comissaoCents: number; gorjetaCents: number; aPagarCents: number };
const brl = (c: number) => "R$ " + (c / 100).toFixed(2).replace(".", ",");
const inputCls = "rounded-xl border border-line bg-bg-elevated px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand-600";

export default function GarconsClient() {
  const [acerto, setAcerto] = useState<Acerto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [pct, setPct] = useState("");

  const reload = useCallback(async () => {
    const r = await fetch("/api/garcons", { cache: "no-store" });
    const d = await r.json();
    setAcerto(d.acerto ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { reload(); }, [reload]);

  async function api(action: string, payload: unknown) {
    setSaving(true);
    try { await fetch("/api/garcons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, payload }) }); await reload(); } finally { setSaving(false); }
  }
  async function add() {
    if (!name.trim()) return;
    await api("create", { name: name.trim(), commission_percent: parseFloat(pct.replace(",", ".")) || 0 });
    setName(""); setPct("");
  }

  if (loading) return <p className="text-sm text-[var(--text-muted)]">Carregando…</p>;

  return (
    <div className="max-w-3xl space-y-4">
      <Card className="p-4 sm:p-5">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Novo garçom</h3>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do garçom" className={`${inputCls} flex-1`} />
          <input value={pct} onChange={(e) => setPct(e.target.value)} inputMode="decimal" placeholder="Comissão %" className={`${inputCls} w-32`} />
          <button onClick={add} disabled={saving || !name.trim()} className="rounded-xl brand-gradient px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Adicionar</button>
        </div>
        <p className="mt-2 text-xs text-[var(--text-faded)]">Comissão = % sobre o consumo que o garçom vende (acordo da casa). A gorjeta (taxa de serviço) é somada à parte por comanda atendida.</p>
      </Card>

      {acerto.length === 0 && <Card className="p-6 text-center text-sm text-[var(--text-muted)]">Nenhum garçom cadastrado.</Card>}
      {acerto.map((g) => (
        <Card key={g.id} className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-ink">{g.name}</span>
              <span className="rounded-full bg-bg-surface-2 px-2 py-0.5 text-xs font-semibold text-[var(--text-muted)]">{g.commission_percent}% comissão</span>
              {!g.active && <span className="rounded-full bg-bg-surface-2 px-2 py-0.5 text-xs text-[var(--text-faded)]">inativo</span>}
            </div>
            <button onClick={() => confirm(`Excluir ${g.name}?`) && api("delete", { id: g.id })} disabled={saving} className="text-xs font-bold text-red-500">excluir</button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3 text-sm sm:grid-cols-5">
            <div><div className="text-xs text-[var(--text-muted)]">Comandas</div><div className="font-bold text-ink">{g.comandas}</div></div>
            <div><div className="text-xs text-[var(--text-muted)]">Vendido</div><div className="font-bold text-ink">{brl(g.vendidoCents)}</div></div>
            <div><div className="text-xs text-[var(--text-muted)]">Comissão</div><div className="font-bold text-ink">{brl(g.comissaoCents)}</div></div>
            <div><div className="text-xs text-[var(--text-muted)]">Gorjeta</div><div className="font-bold text-ink">{brl(g.gorjetaCents)}</div></div>
            <div><div className="text-xs text-[var(--text-muted)]">A pagar</div><div className="font-extrabold text-[var(--green-ok)]">{brl(g.aPagarCents)}</div></div>
          </div>
        </Card>
      ))}

      <p className="rounded-xl bg-bg-surface-2 p-3 text-xs text-[var(--text-muted)]">
        A gorjeta (taxa de serviço) é dos trabalhadores — aqui ela aparece por garçom pra organizar o acerto. Encargos de folha (13º, FGTS) são responsabilidade do contador.
      </p>
    </div>
  );
}
