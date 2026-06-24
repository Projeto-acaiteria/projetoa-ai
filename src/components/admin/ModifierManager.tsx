"use client";

import { useState } from "react";
import type { BarProduct, ModifierGroup } from "@/lib/menu-bar-store";

// Gestão de personalização (grupos de modificador + opções) de UM produto. Modal do editor.
// Sem SQL: a loja cria "Ponto da carne" (obrigatório, escolha 1), "Adicionais" (opcional, +R$), etc.

const brl = (c: number) => "R$ " + (c / 100).toFixed(2).replace(".", ",");
const inputCls = "w-full rounded-lg border border-line bg-bg-elevated px-3 py-2 text-sm text-ink outline-none focus:border-brand-600";

async function call(action: string, payload: unknown) {
  await fetch("/api/cardapio-bar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, payload }) });
}
function groupHint(g: ModifierGroup) {
  const obr = g.min_select >= 1 ? "Obrigatório" : "Opcional";
  const qt = g.max_select === 1 ? "escolha 1" : g.max_select ? `até ${g.max_select}` : "várias";
  const mode = g.price_mode === "highest" ? " · paga a maior" : g.price_mode === "average" ? " · média" : "";
  return `${obr} · ${qt}${g.free_up_to ? ` · ${g.free_up_to} grátis` : ""}${mode}`;
}

export default function ModifierManager({ product, onClose, onChanged }: { product: BarProduct; onClose: () => void; onChanged: () => void }) {
  const [groups, setGroups] = useState<ModifierGroup[]>(product.groups);
  const [busy, setBusy] = useState(false);
  // form novo grupo
  const [gTitle, setGTitle] = useState("");
  const [gReq, setGReq] = useState(false);
  const [gSingle, setGSingle] = useState(true);
  const [gMode, setGMode] = useState<"sum" | "highest" | "average">("sum");
  // form nova opção por grupo
  const [optFor, setOptFor] = useState<string | null>(null);
  const [optName, setOptName] = useState("");
  const [optPrice, setOptPrice] = useState("");

  async function reload() {
    const r = await fetch("/api/cardapio-bar", { cache: "no-store" });
    const d = await r.json();
    const p = (d.categories ?? []).flatMap((c: { products: BarProduct[] }) => c.products).find((x: BarProduct) => x.id === product.id);
    setGroups(p?.groups ?? []);
    onChanged();
  }
  async function run(fn: () => Promise<void>) { setBusy(true); try { await fn(); await reload(); } finally { setBusy(false); } }

  async function addGroup() {
    if (!gTitle.trim()) return;
    await run(async () => {
      await call("group.create", { product_id: product.id, title: gTitle.trim(), min_select: gReq ? 1 : 0, max_select: gSingle ? 1 : 0, free_up_to: 0, price_mode: gMode, sort: groups.length });
      setGTitle(""); setGReq(false); setGSingle(true); setGMode("sum");
    });
  }
  async function addOpt(groupId: string) {
    if (!optName.trim()) return;
    const cents = Math.round((parseFloat(optPrice.replace(",", ".")) || 0) * 100);
    await run(async () => { await call("mod.create", { group_id: groupId, name: optName.trim(), price_cents: cents, sort: 0 }); setOptName(""); setOptPrice(""); setOptFor(null); });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-bg-elevated p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-ink">Personalização</h3>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-lg">✕</button>
        </div>
        <p className="mb-4 text-sm text-[var(--text-muted)]">{product.name} — monte os grupos de escolha (ponto, adicionais, remover…)</p>

        <div className="space-y-3">
          {groups.length === 0 && <p className="rounded-xl bg-bg-surface-2 p-3 text-sm text-[var(--text-faded)]">Sem personalização ainda. Crie o 1º grupo abaixo.</p>}
          {groups.map((g) => (
            <div key={g.id} className="rounded-xl border border-line p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-ink">{g.title}</span>
                  <span className="ml-2 rounded-full bg-bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-[var(--text-muted)]">{groupHint(g)}</span>
                </div>
                <button onClick={() => run(() => call("group.delete", { id: g.id }))} disabled={busy} className="text-xs font-bold text-red-500">excluir</button>
              </div>
              <ul className="space-y-1">
                {g.modifiers.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-ink">{m.name}</span>
                    <span className="flex items-center gap-2">
                      {m.price_cents > 0 && <span className="font-bold text-brand-600">+ {brl(m.price_cents)}</span>}
                      <button onClick={() => run(() => call("mod.delete", { id: m.id }))} disabled={busy} className="text-[var(--text-faded)] hover:text-red-500">×</button>
                    </span>
                  </li>
                ))}
              </ul>
              {optFor === g.id ? (
                <div className="mt-2 flex gap-2">
                  <input autoFocus value={optName} onChange={(e) => setOptName(e.target.value)} placeholder="Opção (ex: Bacon)" className={inputCls} />
                  <input value={optPrice} onChange={(e) => setOptPrice(e.target.value)} inputMode="decimal" placeholder="+R$" className={`${inputCls} w-20`} />
                  <button onClick={() => addOpt(g.id)} disabled={busy} className="rounded-lg brand-gradient px-3 text-sm font-bold text-white disabled:opacity-50">{busy ? "…" : "ok"}</button>
                </div>
              ) : (
                <button onClick={() => { setOptFor(g.id); setOptName(""); setOptPrice(""); }} className="mt-2 text-xs font-bold text-brand-600">+ opção</button>
              )}
            </div>
          ))}
        </div>

        {/* novo grupo */}
        <div className="mt-4 rounded-xl border border-dashed border-line p-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Novo grupo</p>
          <input value={gTitle} onChange={(e) => setGTitle(e.target.value)} placeholder="Título (ex: Ponto da carne, Adicionais)" className={inputCls} />
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-ink">
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={gReq} onChange={(e) => setGReq(e.target.checked)} /> Obrigatório</label>
            <label className="flex items-center gap-1.5"><input type="radio" checked={gSingle} onChange={() => setGSingle(true)} /> Escolha 1</label>
            <label className="flex items-center gap-1.5"><input type="radio" checked={!gSingle} onChange={() => setGSingle(false)} /> Várias</label>
          </div>
          <select value={gMode} onChange={(e) => setGMode(e.target.value as "sum" | "highest" | "average")} className={`${inputCls} mt-2`}>
            <option value="sum">Cálculo: cada opção soma (adicionais)</option>
            <option value="highest">Cálculo: paga a mais cara (pizza meio-a-meio)</option>
            <option value="average">Cálculo: média dos preços</option>
          </select>
          <button onClick={addGroup} disabled={busy || !gTitle.trim()} className="mt-3 w-full rounded-lg brand-gradient py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? "Adicionando…" : "Adicionar grupo"}</button>
        </div>
      </div>
    </div>
  );
}
