"use client";

import { useMemo, useState } from "react";
import type { BarCategory, BarProduct } from "@/lib/menu-bar-store";
import ProductCustomizer, { type CustomizeResult } from "@/components/menu/ProductCustomizer";
import { fromPrice } from "@/lib/menu-price";

// TemplateGrid — cardápio público modelo GRID (foto grande, estilo iFood). Tema claro.
// Suporta montagem guiada (modifiers): produto com grupos abre o ProductCustomizer.

const ACCENT = "#EA580C";
const ACCENT_HI = "#F97316";

type Line = { key: string; product: BarProduct; station: string; qty: number; modifierIds: string[]; mods: { name: string; price_cents: number }[]; unitPriceCents: number };
const brl = (cents: number) => "R$ " + (cents / 100).toFixed(2).replace(".", ",");
const lineKey = (productId: string, modifierIds: string[]) => productId + (modifierIds.length ? ":" + [...modifierIds].sort().join(",") : "");

function Thumb({ p }: { p: BarProduct }) {
  if (p.img) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={p.img} alt={p.name} className="aspect-square w-full object-cover" loading="lazy" />;
  }
  return (
    <div className="flex aspect-square w-full items-center justify-center bg-zinc-100 text-zinc-300">
      <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>
    </div>
  );
}

export default function TemplateGrid({
  storeName,
  tagline,
  aberto,
  categories,
  slug,
  tableNumber = null,
  coverNotice = null,
  branding = null,
}: {
  storeName: string;
  tagline?: string | null;
  aberto: boolean;
  categories: BarCategory[];
  slug: string;
  tableNumber?: number | null;
  coverNotice?: { artist: string; coverCents: number } | null;
  branding?: { logoUrl?: string; bannerUrl?: string; primaryColor?: string } | null;
}) {
  const [cart, setCart] = useState<Record<string, Line>>({});
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [customizing, setCustomizing] = useState<{ product: BarProduct; station: string } | null>(null);

  const lines = Object.values(cart).filter((l) => l.qty > 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const total = lines.reduce((s, l) => s + l.qty * l.unitPriceCents, 0);

  function addLine(product: BarProduct, station: string, modifierIds: string[], mods: { name: string; price_cents: number }[], unitPriceCents: number, qty = 1) {
    const key = lineKey(product.id, modifierIds);
    setCart((c) => ({ ...c, [key]: { key, product, station, modifierIds, mods, unitPriceCents, qty: (c[key]?.qty ?? 0) + qty } }));
  }
  function onPlus(product: BarProduct, station: string) {
    if (product.groups && product.groups.length) setCustomizing({ product, station });
    else addLine(product, station, [], [], product.price_cents);
  }
  const incKey = (key: string) => setCart((c) => (c[key] ? { ...c, [key]: { ...c[key], qty: c[key].qty + 1 } } : c));
  const decKey = (key: string) =>
    setCart((c) => {
      const q = (c[key]?.qty ?? 0) - 1;
      if (q <= 0) { const { [key]: _omit, ...rest } = c; return rest; }
      return { ...c, [key]: { ...c[key], qty: q } };
    });

  const byStation = useMemo(() => {
    const m: Record<string, number> = {};
    for (const l of lines) m[l.station] = (m[l.station] ?? 0) + l.qty;
    return m;
  }, [lines]);

  async function send() {
    if (sending || count === 0) return;
    setErrorMsg("");
    if (!tableNumber) { setSent(true); return; }
    setSending(true);
    try {
      const r = await fetch("/api/mesa-pedido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, tableNumber, items: lines.map((l) => ({ productId: l.product.id, qty: l.qty, modifierIds: l.modifierIds })), note }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Não consegui enviar o pedido.");
      setSent(true);
      setCart({});
      setNote("");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Não consegui enviar o pedido.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#FAFAF9] text-zinc-900">
      <header className={`relative overflow-hidden px-6 pb-7 pt-12 text-center ${branding?.bannerUrl ? "text-white" : ""}`}>
        {branding?.bannerUrl && (
          <div className="absolute inset-0 z-0" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={branding.bannerUrl} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/45 to-black/70" />
          </div>
        )}
        <span className="absolute right-5 top-5 z-10 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-white" style={{ background: aberto ? "#16A34A" : "#9CA3AF" }}>
          <span className="h-1.5 w-1.5 rounded-full bg-white" /> {aberto ? "Aberto agora" : "Fechado"}
        </span>
        {branding?.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={branding.logoUrl} alt={storeName} className="relative z-10 mx-auto mb-3 h-20 w-20 rounded-2xl object-cover shadow-lg" />
        )}
        <h1 className="relative z-10 text-3xl font-extrabold tracking-tight sm:text-4xl">{storeName}</h1>
        {tagline && <p className={`relative z-10 mx-auto mt-2 max-w-sm text-sm ${branding?.bannerUrl ? "text-white/80" : "text-zinc-500"}`}>{tagline}</p>}
        {tableNumber != null && (
          <span className="relative z-10 mt-4 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-sm font-bold text-zinc-900 shadow-sm">
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9h18M5 9l1 11M19 9l-1 11M4 5h16v4H4z" /></svg>
            Mesa {tableNumber}
          </span>
        )}
        {coverNotice && (
          <div className="relative z-10 mt-4 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold" style={{ borderColor: "#FED7AA", background: "#FFF7ED", color: "#C2410C" }}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
            Couvert {brl(coverNotice.coverCents)}/pessoa · ao vivo: {coverNotice.artist}
          </div>
        )}
      </header>

      <div className="mx-auto max-w-3xl space-y-8 px-4 pb-40">
        {categories.map((cat) => (
          <section key={cat.id}>
            <div className="mb-3">
              <h2 className="text-xl font-extrabold">{cat.name}</h2>
              {cat.description && <p className="text-sm text-zinc-400">{cat.description}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {cat.products.map((p) => {
                const hasGroups = p.groups && p.groups.length > 0;
                const q = hasGroups ? 0 : cart[p.id]?.qty ?? 0;
                return (
                  <div key={p.id} className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition hover:shadow-md">
                    <div className="relative">
                      <Thumb p={p} />
                      {q > 0 ? (
                        <div className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-full bg-white/95 p-1 shadow-md backdrop-blur">
                          <button onClick={() => decKey(p.id)} aria-label="menos" className="flex h-7 w-7 items-center justify-center rounded-full text-lg leading-none text-zinc-600 active:scale-95">−</button>
                          <span className="w-4 text-center text-sm font-bold tabular-nums">{q}</span>
                          <button onClick={() => incKey(p.id)} aria-label="mais" className="flex h-7 w-7 items-center justify-center rounded-full text-lg leading-none text-white active:scale-95" style={{ background: ACCENT }}>+</button>
                        </div>
                      ) : (
                        <button onClick={() => onPlus(p, cat.station)} aria-label={`adicionar ${p.name}`} className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full text-xl leading-none text-white shadow-md active:scale-95" style={{ background: ACCENT }}>+</button>
                      )}
                    </div>
                    <div className="p-2.5">
                      <p className="text-sm font-bold leading-tight">{p.name}</p>
                      {p.size_label && <p className="text-xs text-zinc-400">{p.size_label}</p>}
                      <div className="mt-1 flex items-center gap-1.5">
                        <p className="font-extrabold" style={{ color: ACCENT }}>
                          {(() => { const fp = fromPrice(p); return <>{fp.from && <span className="text-[10px] font-medium text-zinc-400">a partir de </span>}{brl(fp.cents)}</>; })()}
                        </p>
                        {hasGroups && <span className="rounded-full bg-orange-50 px-1.5 py-0.5 text-[10px] font-bold text-orange-600">monta</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {count > 0 && !open && (
        <button onClick={() => setOpen(true)} className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-center justify-between rounded-2xl px-5 py-4 font-bold text-white shadow-2xl active:scale-[0.99]" style={{ background: branding?.primaryColor || ACCENT, boxShadow: "0 16px 40px -12px rgba(0,0,0,0.4)" }}>
          <span className="flex items-center gap-2"><span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-black/20 px-1.5 text-sm tabular-nums">{count}</span> Ver pedido</span>
          <span className="tabular-nums">{brl(total)}</span>
        </button>
      )}

      {customizing && (
        <ProductCustomizer
          product={customizing.product}
          accent={ACCENT_HI}
          onClose={() => setCustomizing(null)}
          onConfirm={(r: CustomizeResult) => { addLine(customizing.product, customizing.station, r.modifierIds, r.mods, r.unitPriceCents, r.qty); setCustomizing(null); }}
        />
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-md rounded-t-3xl bg-white p-5 pb-7" style={{ maxHeight: "82vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-2xl font-extrabold">Seu pedido</h3>
              <button onClick={() => setOpen(false)} aria-label="fechar" className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-lg">✕</button>
            </div>
            {sent ? (
              <div className="py-10 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600">
                  <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                </div>
                <p className="text-lg font-bold">Pedido enviado!</p>
                <p className="mt-1 text-sm text-zinc-500">Já está sendo preparado.</p>
              </div>
            ) : (
              <>
                <ul className="divide-y divide-zinc-100">
                  {lines.map((l) => (
                    <li key={l.key} className="flex items-start gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold leading-tight">{l.product.name}{l.product.size_label && <span className="text-sm font-normal text-zinc-400"> · {l.product.size_label}</span>}</p>
                        {l.mods.length > 0 && <p className="text-xs text-zinc-400">{l.mods.map((m) => m.name).join(" · ")}</p>}
                        <p className="text-sm text-zinc-400">{brl(l.unitPriceCents)}</p>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <button onClick={() => decKey(l.key)} className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 text-lg leading-none active:scale-95">−</button>
                        <span className="w-4 text-center font-bold tabular-nums">{l.qty}</span>
                        <button onClick={() => incKey(l.key)} className="flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none text-white active:scale-95" style={{ background: ACCENT }}>+</button>
                      </div>
                    </li>
                  ))}
                </ul>
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Observação (ex: caprichar no molho)" className="mt-4 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400" />
                {Object.keys(byStation).length > 1 && (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-400">
                    {Object.entries(byStation).map(([st, n]) => (<span key={st} className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 capitalize">{n} → {st}</span>))}
                  </div>
                )}
                <div className="mt-5 flex items-center justify-between">
                  <span className="text-zinc-500">Total</span>
                  <span className="text-2xl font-extrabold" style={{ color: ACCENT }}>{brl(total)}</span>
                </div>
                {errorMsg && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-center text-sm font-semibold text-red-600">{errorMsg}</p>}
                <button onClick={send} disabled={count === 0 || sending} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-extrabold text-white shadow-xl active:scale-[0.99] disabled:opacity-50" style={{ background: branding?.primaryColor || ACCENT, boxShadow: "0 14px 36px -12px rgba(0,0,0,0.4)" }}>
                  {sending ? "Enviando…" : tableNumber ? "Enviar pedido" : "Confirmar pedido"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
