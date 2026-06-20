"use client";

import { useEffect, useState } from "react";
import type { BarProduct, RecipeLine } from "@/lib/menu-bar-store";
import type { StockItem } from "@/lib/stock-store";

// Ficha técnica de UM produto: quais insumos do estoque ele consome por unidade vendida.
// É o que liga a venda à BAIXA AUTOMÁTICA + ao CMV. Ex: "Dose de Cachaça" → 1 dose de Cachaça.
// Salva via prod.update {patch:{recipe}} (server-authoritative na venda, nunca confia no client).

const inputCls = "w-full rounded-lg border border-line bg-bg-elevated px-3 py-2 text-sm text-ink outline-none focus:border-brand-600";

async function call(action: string, payload: unknown) {
  await fetch("/api/cardapio-bar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, payload }) });
}

export default function RecipeManager({ product, onClose, onChanged }: { product: BarProduct; onClose: () => void; onChanged: () => void }) {
  const [recipe, setRecipe] = useState<RecipeLine[]>(product.recipe ?? []);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState("");
  const [qty, setQty] = useState("1");

  useEffect(() => {
    fetch("/api/estoque", { cache: "no-store" }).then((r) => r.json()).then((d) => setStock(d.items ?? []));
  }, []);

  const byId = new Map(stock.map((s) => [s.id, s]));

  async function save(next: RecipeLine[]) {
    setBusy(true);
    try {
      await call("prod.update", { id: product.id, patch: { recipe: next } });
      setRecipe(next);
      onChanged();
    } finally { setBusy(false); }
  }
  function add() {
    const q = parseFloat(qty.replace(",", ".")) || 0;
    if (!pick || q <= 0) return;
    const next = [...recipe.filter((r) => r.stockId !== pick), { stockId: pick, qty: q }];
    setPick(""); setQty("1");
    save(next);
  }
  function remove(stockId: string) { save(recipe.filter((r) => r.stockId !== stockId)); }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-bg-elevated p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-ink">Ficha técnica</h3>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-lg">✕</button>
        </div>
        <p className="mb-4 text-sm text-[var(--text-muted)]">{product.name} — quais insumos saem do estoque a cada unidade vendida (baixa automática + CMV).</p>

        <div className="space-y-2">
          {recipe.length === 0 && <p className="rounded-xl bg-bg-surface-2 p-3 text-sm text-[var(--text-faded)]">Sem ficha técnica. Sem ela a venda não baixa estoque nem entra no CMV.</p>}
          {recipe.map((r) => {
            const s = byId.get(r.stockId);
            return (
              <div key={r.stockId} className="flex items-center justify-between gap-2 rounded-xl border border-line p-3">
                <div>
                  <span className="font-bold text-ink">{s?.name ?? r.stockId}</span>
                  <span className="ml-2 text-sm text-[var(--text-muted)]">{r.qty} {s?.unit ?? ""}/un</span>
                  {!s && <span className="ml-2 rounded bg-red-50 px-1.5 text-xs text-red-500">insumo removido</span>}
                </div>
                <button onClick={() => remove(r.stockId)} disabled={busy} className="text-xs font-bold text-red-500">remover</button>
              </div>
            );
          })}
        </div>

        <div className="mt-4 rounded-xl border border-dashed border-line p-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Adicionar insumo</p>
          <div className="flex gap-2">
            <select value={pick} onChange={(e) => setPick(e.target.value)} className={inputCls}>
              <option value="">Escolha o insumo…</option>
              {stock.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>)}
            </select>
            <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" placeholder="qtd" className={`${inputCls} w-20`} />
            <button onClick={add} disabled={busy || !pick} className="rounded-lg brand-gradient px-3 text-sm font-bold text-white disabled:opacity-50">ok</button>
          </div>
          <p className="mt-2 text-xs text-[var(--text-faded)]">A quantidade é por unidade vendida, na mesma medida do estoque (dose, kg, un…).</p>
        </div>
      </div>
    </div>
  );
}
