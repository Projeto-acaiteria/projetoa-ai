"use client";

import { useMemo, useState } from "react";
import type { BarProduct, ModifierGroup } from "@/lib/menu-bar-store";

// Montagem guiada de produto (monta-seu-lanche / adicionais / ponto / remover) com PREÇO AO VIVO.
// Recomendação de UI #1 da pesquisa. Compartilhado por TemplateBar (dark) e TemplateGrid (light).
// Respeita min_select (obrigatório) / max_select (teto) / free_up_to (N primeiros grátis).

const brl = (c: number) => "R$ " + (c / 100).toFixed(2).replace(".", ",");

export type CustomizeResult = { modifierIds: string[]; qty: number; mods: { name: string; price_cents: number }[]; unitPriceCents: number };

function groupHint(g: ModifierGroup): string {
  if (g.min_select >= 1 && g.max_select === 1) return "Escolha 1";
  if (g.min_select >= 1) return `Escolha ${g.min_select}${g.max_select ? `–${g.max_select}` : "+"}`;
  if (g.max_select === 1) return "Opcional · 1";
  return g.max_select ? `Opcional · até ${g.max_select}` : "Opcional";
}

export default function ProductCustomizer({
  product,
  accent,
  dark = false,
  onClose,
  onConfirm,
}: {
  product: BarProduct;
  accent: string;
  dark?: boolean;
  onClose: () => void;
  onConfirm: (r: CustomizeResult) => void;
}) {
  const [sel, setSel] = useState<Record<string, string[]>>({});
  const [qty, setQty] = useState(1);

  function toggle(g: ModifierGroup, mId: string) {
    setSel((prev) => {
      const cur = prev[g.id] ?? [];
      const has = cur.includes(mId);
      let next: string[];
      if (g.max_select === 1) {
        next = has ? (g.min_select >= 1 ? cur : []) : [mId]; // radio; obrigatório não desmarca pra vazio
      } else if (has) {
        next = cur.filter((x) => x !== mId);
      } else {
        if (g.max_select > 0 && cur.length >= g.max_select) return prev; // teto
        next = [...cur, mId];
      }
      return { ...prev, [g.id]: next };
    });
  }

  const { unitPriceCents, mods, modifierIds, faltando } = useMemo(() => {
    let total = product.price_cents;
    const mods: { name: string; price_cents: number }[] = [];
    const modifierIds: string[] = [];
    const faltando: string[] = [];
    for (const g of product.groups) {
      const chosen = sel[g.id] ?? [];
      if (g.min_select > 0 && chosen.length < g.min_select) faltando.push(g.title);
      chosen.forEach((mId, idx) => {
        const m = g.modifiers.find((x) => x.id === mId);
        if (!m) return;
        const charged = idx < g.free_up_to ? 0 : m.price_cents;
        total += charged;
        mods.push({ name: m.name, price_cents: charged });
        modifierIds.push(mId);
      });
    }
    return { unitPriceCents: total, mods, modifierIds, faltando };
  }, [sel, product]);

  const ok = faltando.length === 0;

  // tema
  const sheet = dark ? "#17130E" : "#ffffff";
  const txt = dark ? "text-white" : "text-zinc-900";
  const sub = dark ? "text-white/45" : "text-zinc-400";
  const line = dark ? "border-white/10" : "border-zinc-200";
  const chip = dark ? "bg-white/8 text-white/60" : "bg-zinc-100 text-zinc-500";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className={`relative w-full max-w-md rounded-t-3xl ${txt}`} style={{ background: sheet, maxHeight: "88vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        {product.img && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.img} alt={product.name} className="h-40 w-full rounded-t-3xl object-cover" />
        )}
        <div className="p-5">
          <div className="mb-4 flex items-start justify-between gap-2">
            <div>
              <h3 className="text-xl font-extrabold leading-tight">{product.name}</h3>
              {product.size_label && <p className={`text-sm ${sub}`}>{product.size_label}</p>}
              <p className="mt-1 font-bold" style={{ color: accent }}>{brl(product.price_cents)}</p>
            </div>
            <button onClick={onClose} aria-label="fechar" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${line} text-lg`}>✕</button>
          </div>

          {product.groups.map((g) => {
            const chosen = sel[g.id] ?? [];
            const missing = g.min_select > 0 && chosen.length < g.min_select;
            return (
              <div key={g.id} className="mb-5">
                <div className="mb-2 flex items-center gap-2">
                  <span className="font-bold">{g.title}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${missing ? "bg-red-500/15 text-red-400" : chip}`}>{groupHint(g)}</span>
                  {g.free_up_to > 0 && <span className={`text-[11px] ${sub}`}>· {g.free_up_to} grátis</span>}
                </div>
                <div className="space-y-1.5">
                  {g.modifiers.map((m) => {
                    const on = chosen.includes(m.id);
                    const radio = g.max_select === 1;
                    return (
                      <button
                        key={m.id}
                        onClick={() => toggle(g, m.id)}
                        className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${on ? "" : line}`}
                        style={on ? { borderColor: accent, background: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)" } : undefined}
                      >
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center border ${radio ? "rounded-full" : "rounded-md"} ${on ? "" : line}`} style={on ? { borderColor: accent, background: accent } : undefined}>
                          {on && <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
                        </span>
                        <span className="flex-1 text-sm font-medium">{m.name}</span>
                        {m.price_cents > 0 && <span className="text-sm font-bold" style={{ color: accent }}>+ {brl(m.price_cents)}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* footer: qty + adicionar */}
          <div className="mt-2 flex items-center gap-3">
            <div className={`flex items-center gap-3 rounded-full border ${line} px-3 py-2`}>
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="menos" className="text-lg leading-none">−</button>
              <span className="w-4 text-center font-bold tabular-nums">{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} aria-label="mais" className="text-lg leading-none">+</button>
            </div>
            <button
              onClick={() => ok && onConfirm({ modifierIds, qty, mods, unitPriceCents })}
              disabled={!ok}
              className="flex flex-1 items-center justify-between rounded-2xl px-5 py-3.5 font-extrabold text-white shadow-xl active:scale-[0.99] disabled:opacity-50"
              style={{ background: accent }}
            >
              <span>{ok ? "Adicionar" : `Escolha: ${faltando[0]}`}</span>
              <span className="tabular-nums">{brl(unitPriceCents * qty)}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
