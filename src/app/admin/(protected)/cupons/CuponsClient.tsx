"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/admin/ui";

type Coupon = {
  id: string;
  code: string;
  description: string;
  kind: "percentual" | "valor";
  percent: number | null;
  value_cents: number | null;
  min_subtotal_cents: number | null;
  max_discount_cents: number | null;
  valid_from: string | null;
  valid_until: string | null;
  usage_limit: number | null;
  used_count: number;
  active: boolean;
};

const brl = (c: number) => "R$ " + (c / 100).toFixed(2).replace(".", ",");
const centsFrom = (s: string) => Math.round((parseFloat(s.replace(",", ".")) || 0) * 100);
const intFrom = (s: string) => Math.max(0, Math.round(parseFloat(s.replace(",", ".")) || 0));
const inputCls = "rounded-xl border border-line bg-bg-elevated px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand-600";

function status(c: Coupon): { label: string; cls: string } {
  const now = Date.now();
  if (!c.active) return { label: "inativo", cls: "text-[var(--text-faded)] bg-bg-surface-2" };
  if (c.valid_until && new Date(c.valid_until).getTime() < now) return { label: "expirado", cls: "text-red-500 bg-bg-surface-2" };
  if (c.valid_from && new Date(c.valid_from).getTime() > now) return { label: "agendado", cls: "text-amber-500 bg-bg-surface-2" };
  if (c.usage_limit != null && c.used_count >= c.usage_limit) return { label: "esgotado", cls: "text-[var(--text-faded)] bg-bg-surface-2" };
  return { label: "ativo", cls: "text-[var(--green-ok)] bg-bg-surface-2" };
}

const empty = { code: "", description: "", kind: "percentual" as "percentual" | "valor", value: "", min: "", max: "", limit: "", until: "" };

export default function CuponsClient() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(empty);

  const reload = useCallback(async () => {
    const r = await fetch("/api/cupons", { cache: "no-store" });
    const d = await r.json();
    setCoupons(d.coupons ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { reload(); }, [reload]);

  async function api(action: string, payload: unknown) {
    setSaving(true);
    try {
      await fetch("/api/cupons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, payload }) });
      await reload();
    } finally { setSaving(false); }
  }

  async function add() {
    const code = form.code.trim();
    const val = parseFloat(form.value.replace(",", ".")) || 0;
    if (!code || val <= 0) return;
    await api("create", {
      code,
      description: form.description.trim(),
      kind: form.kind,
      percent: form.kind === "percentual" ? val : null,
      value_cents: form.kind === "valor" ? centsFrom(form.value) : null,
      min_subtotal_cents: form.min ? centsFrom(form.min) : null,
      max_discount_cents: form.kind === "percentual" && form.max ? centsFrom(form.max) : null,
      usage_limit: form.limit ? intFrom(form.limit) : null,
      valid_until: form.until ? new Date(form.until).toISOString() : null,
    });
    setForm(empty);
  }

  const set = (k: keyof typeof empty, v: string) => setForm((f) => ({ ...f, [k]: v }));

  if (loading) return <p className="text-sm text-[var(--text-muted)]">Carregando…</p>;

  return (
    <div className="max-w-3xl space-y-4">
      <Card className="p-4 sm:p-5">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Novo cupom</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <input value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder="CÓDIGO" className={`${inputCls} col-span-2 font-mono`} />
          <select value={form.kind} onChange={(e) => set("kind", e.target.value)} className={inputCls}>
            <option value="percentual">Percentual (%)</option>
            <option value="valor">Valor fixo (R$)</option>
          </select>
          <input value={form.value} onChange={(e) => set("value", e.target.value)} inputMode="decimal" placeholder={form.kind === "percentual" ? "10 (%)" : "5,00 (R$)"} className={inputCls} />
          <input value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Descrição (ex: cliente que volta)" className={`${inputCls} col-span-2 sm:col-span-4`} />
          <input value={form.min} onChange={(e) => set("min", e.target.value)} inputMode="decimal" placeholder="Mínimo R$" className={inputCls} />
          {form.kind === "percentual" && <input value={form.max} onChange={(e) => set("max", e.target.value)} inputMode="decimal" placeholder="Teto R$" className={inputCls} />}
          <input value={form.limit} onChange={(e) => set("limit", e.target.value)} inputMode="numeric" placeholder="Limite usos" className={inputCls} />
          <input value={form.until} onChange={(e) => set("until", e.target.value)} type="date" className={inputCls} />
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-xs text-[var(--text-faded)]">O desconto sai do total da venda (alimenta o desconto do PDV). Sem afetar comissão do garçom.</p>
          <button onClick={add} disabled={saving || !form.code.trim()} className="rounded-xl brand-gradient px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Criar cupom</button>
        </div>
      </Card>

      {coupons.length === 0 && <Card className="p-6 text-center text-sm text-[var(--text-muted)]">Nenhum cupom criado ainda.</Card>}
      {coupons.map((c) => {
        const st = status(c);
        return (
          <Card key={c.id} className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-extrabold text-ink">{c.code}</span>
                <span className="rounded-full bg-bg-surface-2 px-2 py-0.5 text-xs font-semibold text-[var(--text-muted)]">
                  {c.kind === "percentual" ? `${c.percent}%` : brl(c.value_cents ?? 0)}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => api("toggle", { id: c.id, active: !c.active })} disabled={saving} className="text-xs font-bold text-[var(--text-muted)]">
                  {c.active ? "desativar" : "ativar"}
                </button>
                <button onClick={() => confirm(`Excluir ${c.code}?`) && api("delete", { id: c.id })} disabled={saving} className="text-xs font-bold text-red-500">excluir</button>
              </div>
            </div>
            {c.description && <div className="mt-1 text-sm text-[var(--text-muted)]">{c.description}</div>}
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-line pt-3 text-xs text-[var(--text-muted)]">
              {c.min_subtotal_cents != null && <span>mínimo {brl(c.min_subtotal_cents)}</span>}
              {c.max_discount_cents != null && <span>teto {brl(c.max_discount_cents)}</span>}
              <span>usos {c.used_count}{c.usage_limit != null ? ` / ${c.usage_limit}` : " · ilimitado"}</span>
              {c.valid_until && <span>até {new Date(c.valid_until).toLocaleDateString("pt-BR")}</span>}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
