"use client";

import { useMemo, useState } from "react";
import type { BarProduct, ModifierGroup, Modifier } from "@/lib/menu-bar-store";
import type { CustomizeResult } from "@/components/menu/ProductCustomizer";

// MONTADOR VISUAL DE PIZZA (público, cliente) — estilo Dom João / Expresso. Tamanho + nº de sabores
// (stepper) + RODA em fatias: toca a fatia → escolhe o sabor (busca + faixas). Preço ao vivo. A saída
// é o mesmo CustomizeResult (modifierIds) do customizador em lista → carrinho/checkout não mudam.
const brl = (c: number) => "R$ " + (c / 100).toFixed(2).replace(".", ",");
const TAU = Math.PI * 2;

function slicePath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  if (a1 - a0 >= TAU - 1e-6) return `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0`;
  const p = (a: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
}

export default function PizzaWheel({ product, accent = "#F5480C", onConfirm, onClose }: {
  product: BarProduct; accent?: string; onConfirm: (r: CustomizeResult) => void; onClose: () => void;
}) {
  const flavorGroup = product.groups.find((g) => g.price_mode === "highest");
  const sizeGroup = product.groups.find((g) => g !== flavorGroup && /tamanho/i.test(g.title))
    ?? product.groups.find((g) => g !== flavorGroup && g.min_select === 1 && g.max_select === 1);
  const otherGroups = product.groups.filter((g) => g !== flavorGroup && g !== sizeGroup);

  const maxFlavors = Math.max(1, flavorGroup?.max_select || 1);
  const minFlavors = Math.max(1, flavorGroup?.min_select || 1);

  const [sizeId, setSizeId] = useState(sizeGroup?.modifiers[0]?.id ?? "");
  const [count, setCount] = useState(minFlavors);
  const [slots, setSlots] = useState<(string | null)[]>(() => Array(minFlavors).fill(null));
  const [other, setOther] = useState<Record<string, string[]>>(() => {
    const o: Record<string, string[]> = {};
    for (const g of otherGroups) if (g.min_select >= 1 && g.modifiers[0]) o[g.id] = [g.modifiers[0].id];
    return o;
  });
  const [pickFor, setPickFor] = useState<number | null>(null);
  const [q, setQ] = useState("");

  const modById = useMemo(() => {
    const m = new Map<string, Modifier>();
    for (const g of product.groups) for (const mo of g.modifiers) m.set(mo.id, mo);
    return m;
  }, [product]);

  function setCountSafe(n: number) {
    const c = Math.min(maxFlavors, Math.max(minFlavors, n));
    setCount(c);
    setSlots((prev) => Array.from({ length: c }, (_, i) => prev[i] ?? null));
  }

  // preço ao vivo: tamanho (sum) + maior sabor (highest) + outros escolhidos (sum)
  const { total, modifierIds, mods, ready } = useMemo(() => {
    const ids: string[] = [];
    const md: { name: string; price_cents: number }[] = [];
    let sum = 0;
    if (sizeGroup && sizeId) { const s = modById.get(sizeId); if (s) { sum += s.price_cents; ids.push(s.id); md.push({ name: s.name, price_cents: s.price_cents }); } }
    const chosen = slots.filter((x): x is string => !!x).map((id) => modById.get(id)!).filter(Boolean);
    const maxFlavor = chosen.reduce((mx, m) => Math.max(mx, m.price_cents), 0);
    let addedMax = false;
    for (const m of chosen) { ids.push(m.id); md.push({ name: m.name, price_cents: !addedMax && m.price_cents === maxFlavor ? maxFlavor : 0 }); if (m.price_cents === maxFlavor) addedMax = true; }
    sum += maxFlavor;
    for (const g of otherGroups) for (const id of other[g.id] ?? []) { const m = modById.get(id); if (m) { sum += m.price_cents; ids.push(m.id); if (m.price_cents > 0) md.push({ name: m.name, price_cents: m.price_cents }); } }
    const allFlavorsChosen = slots.every((x) => !!x);
    const othersOk = otherGroups.every((g) => g.min_select === 0 || (other[g.id]?.length ?? 0) >= g.min_select);
    return { total: sum, modifierIds: ids, mods: md, ready: allFlavorsChosen && (!sizeGroup || !!sizeId) && othersOk };
  }, [sizeId, slots, other, sizeGroup, otherGroups, modById]);

  // sabores agrupados por FAIXA (tier_label) pro seletor
  const faixas = useMemo(() => {
    const map = new Map<string, Modifier[]>();
    for (const m of flavorGroup?.modifiers ?? []) {
      if (q && !m.name.toLowerCase().includes(q.toLowerCase())) continue;
      const k = m.tier_label || "Sabores";
      (map.get(k) ?? map.set(k, []).get(k)!).push(m);
    }
    return [...map.entries()];
  }, [flavorGroup, q]);

  const R = 120, C = 140;
  const sliceColors = ["#FFE2D1", "#FFD0AE", "#FFC29A", "#FFB585"];

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative flex max-h-[94vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5">
          <h3 className="text-base font-extrabold text-zinc-900">Monte sua pizza</h3>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-zinc-100 text-zinc-500">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {sizeGroup && (
            <div className="mb-4">
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-zinc-400">Tamanho</p>
              <div className="flex flex-wrap gap-2">
                {sizeGroup.modifiers.map((m) => (
                  <button key={m.id} onClick={() => setSizeId(m.id)} className="rounded-xl border px-3 py-2 text-sm font-bold transition" style={sizeId === m.id ? { borderColor: accent, background: accent, color: "#fff" } : { borderColor: "#e4e4e7", color: "#27272a" }}>
                    {m.name}{m.price_cents > 0 && <span className="ml-1 opacity-70">{brl(m.price_cents)}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {flavorGroup && maxFlavors > 1 && (
            <div className="mb-3 flex items-center justify-center gap-4">
              <button onClick={() => setCountSafe(count - 1)} disabled={count <= minFlavors} className="grid h-9 w-9 place-items-center rounded-full text-lg font-extrabold text-white disabled:opacity-30" style={{ background: accent }}>−</button>
              <span className="text-sm font-extrabold text-zinc-900">{count} {count === 1 ? "sabor" : "sabores"}</span>
              <button onClick={() => setCountSafe(count + 1)} disabled={count >= maxFlavors} className="grid h-9 w-9 place-items-center rounded-full text-lg font-extrabold text-white disabled:opacity-30" style={{ background: accent }}>+</button>
            </div>
          )}

          {/* A RODA */}
          <div className="flex justify-center py-2">
            <svg viewBox="0 0 280 280" width="240" height="240">
              <circle cx={C} cy={C} r={R + 6} fill="#7c2d12" />
              {Array.from({ length: count }).map((_, i) => {
                const a0 = -Math.PI / 2 + (i * TAU) / count;
                const a1 = -Math.PI / 2 + ((i + 1) * TAU) / count;
                const mid = (a0 + a1) / 2;
                const filled = slots[i] ? modById.get(slots[i]!) : null;
                const tx = C + R * 0.6 * Math.cos(mid), ty = C + R * 0.6 * Math.sin(mid);
                return (
                  <g key={i} onClick={() => { setQ(""); setPickFor(i); }} style={{ cursor: "pointer" }}>
                    <path d={slicePath(C, C, R, a0, a1)} fill={filled ? accent : sliceColors[i % sliceColors.length]} stroke="#fff" strokeWidth={count > 1 ? 2 : 0} />
                    <text x={tx} y={ty} textAnchor="middle" dominantBaseline="middle" className="pointer-events-none" fill={filled ? "#fff" : "#7c2d12"} fontSize="11" fontWeight="700">
                      {filled ? filled.name.split(" ").slice(0, 2).join(" ") : "+ sabor"}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {otherGroups.map((g) => (
            <div key={g.id} className="mt-3">
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-zinc-400">{g.title}</p>
              <div className="flex flex-wrap gap-2">
                {g.modifiers.map((m) => {
                  const single = g.max_select === 1;
                  const sel = (other[g.id] ?? []).includes(m.id);
                  return (
                    <button key={m.id} onClick={() => setOther((o) => { const cur = o[g.id] ?? []; const next = single ? [m.id] : sel ? cur.filter((x) => x !== m.id) : [...cur, m.id]; return { ...o, [g.id]: next }; })}
                      className="rounded-xl border px-3 py-1.5 text-sm font-semibold transition" style={sel ? { borderColor: accent, background: accent, color: "#fff" } : { borderColor: "#e4e4e7", color: "#27272a" }}>
                      {m.name}{m.price_cents > 0 && <span className="ml-1 opacity-70">+{brl(m.price_cents)}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-zinc-100 p-4">
          <button disabled={!ready} onClick={() => onConfirm({ modifierIds, qty: 1, mods, unitPriceCents: total })}
            className="flex w-full items-center justify-between rounded-2xl px-5 py-4 text-base font-extrabold text-white shadow-lg disabled:opacity-40" style={{ background: accent }}>
            <span>{ready ? "Adicionar" : "Escolha os sabores"}</span>
            <span className="tabular-nums">{brl(total)}</span>
          </button>
        </div>

        {/* SELETOR DE SABOR (toca a fatia) */}
        {pickFor !== null && flavorGroup && (
          <div className="absolute inset-0 flex flex-col bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3">
              <button onClick={() => setPickFor(null)} className="grid h-8 w-8 place-items-center rounded-full bg-zinc-100 text-zinc-500">←</button>
              <span className="font-extrabold text-zinc-900">Escolha o sabor {count > 1 ? `(fatia ${pickFor + 1})` : ""}</span>
            </div>
            <div className="border-b border-zinc-100 px-4 py-2.5">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar sabor…" autoFocus className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm outline-none focus:border-zinc-400" />
            </div>
            <div className="flex-1 overflow-y-auto">
              {faixas.map(([faixa, items]) => (
                <div key={faixa}>
                  <p className="sticky top-0 bg-zinc-50 px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-wide" style={{ color: accent }}>{faixa}</p>
                  {items.map((m) => (
                    <button key={m.id} onClick={() => { setSlots((s) => s.map((x, i) => (i === pickFor ? m.id : x))); setPickFor(null); }} className="flex w-full items-center gap-3 border-b border-zinc-50 px-4 py-2.5 text-left active:bg-zinc-50">
                      <span className="flex-1 text-sm font-bold text-zinc-900">{m.name}</span>
                      <span className="text-sm font-bold" style={{ color: accent }}>{m.price_cents > 0 ? "+" + brl(m.price_cents) : "incluso"}</span>
                    </button>
                  ))}
                </div>
              ))}
              {faixas.length === 0 && <p className="px-4 py-6 text-center text-sm text-zinc-400">Nenhum sabor encontrado.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
