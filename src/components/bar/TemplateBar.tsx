"use client";

import { useMemo, useState } from "react";
import type { BarCategory, BarProduct } from "@/lib/menu-bar-store";
import ProductCustomizer, { type CustomizeResult } from "@/components/menu/ProductCustomizer";
import { fromPrice } from "@/lib/menu-price";

// TemplateBar — cardápio público modelo BAR (categoria → produto), espelha o Medellín.
// Tema escuro premium. Suporta montagem guiada (modifiers): produto com grupos abre o ProductCustomizer.
// O "Enviar pedido" grava na comanda da mesa (roteado por estação). Sem mesa = só confirma o preview.

const ACCENT = "#FF3B4E";
const ACCENT_HI = "#FF6178";

type Line = { key: string; product: BarProduct; station: string; qty: number; modifierIds: string[]; mods: { name: string; price_cents: number }[]; unitPriceCents: number };
const brl = (cents: number) => "R$ " + (cents / 100).toFixed(2).replace(".", ",");
const lineKey = (productId: string, modifierIds: string[]) => productId + (modifierIds.length ? ":" + [...modifierIds].sort().join(",") : "");

function StationIcon({ station, size = 18 }: { station: string; size?: number }) {
  if (station === "bar") {
    return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 3h14l-7 9z" /><path d="M12 12v7" /><path d="M8 21h8" /></svg>);
  }
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 11h16a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" /><path d="M6 15l1 5h10l1-5" /><path d="M9 7c0-1 .5-2 1.5-2M14 7c0-1 .5-2 1.5-2" /></svg>);
}

function ProductThumb({ p, station }: { p: BarProduct; station: string }) {
  if (p.img) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={p.img} alt={p.name} className="h-14 w-14 shrink-0 rounded-xl object-cover" />;
  }
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-white/30" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)" }}>
      <StationIcon station={station} size={22} />
    </div>
  );
}

export default function TemplateBar({
  storeName,
  tagline,
  aberto,
  categories,
  slug,
  tableNumber = null,
  coverNotice = null,
}: {
  storeName: string;
  tagline?: string | null;
  aberto: boolean;
  categories: BarCategory[];
  slug: string;
  tableNumber?: number | null;
  coverNotice?: { artist: string; coverCents: number } | null;
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
    <main className="min-h-screen text-white" style={{ background: "radial-gradient(1100px 520px at 50% -8%, rgba(255,59,78,0.16), transparent 60%), #0B0A09" }}>
      <header className="relative flex min-h-[42vh] flex-col items-center justify-center px-6 py-16 text-center">
        <span className="absolute right-5 top-6 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold backdrop-blur" style={{ background: aberto ? "rgba(255,255,255,0.12)" : "rgba(239,68,68,0.9)" }}>
          <span className="h-2 w-2 rounded-full" style={{ background: aberto ? "#34D399" : "#fff" }} />
          {aberto ? "Aberto agora" : "Fechado"}
        </span>
        <h1 className="font-display text-5xl font-extrabold tracking-tight drop-shadow-[0_6px_24px_rgba(0,0,0,0.6)]" style={{ fontFamily: "Georgia, serif" }}>{storeName}</h1>
        {tagline && <p className="mt-4 max-w-sm text-base font-medium text-white/70">{tagline}</p>}
        {tableNumber != null && (
          <span className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm font-bold backdrop-blur">
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={ACCENT_HI} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9h18M5 9l1 11M19 9l-1 11M4 5h16v4H4z" /></svg>
            Mesa {tableNumber}
          </span>
        )}
        {coverNotice && (
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold backdrop-blur" style={{ borderColor: "rgba(255,59,78,0.35)", background: "rgba(255,59,78,0.1)", color: ACCENT_HI }}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
            Couvert {brl(coverNotice.coverCents)}/pessoa · ao vivo: {coverNotice.artist}
          </div>
        )}
        <div className="mt-7 h-px w-24" style={{ background: `linear-gradient(90deg, transparent, ${ACCENT}, transparent)` }} />
      </header>

      <div className="mx-auto max-w-2xl space-y-10 px-4 pb-40">
        {categories.map((cat) => (
          <section key={cat.id}>
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ color: ACCENT_HI, background: "rgba(255,59,78,0.12)" }}>
                <StationIcon station={cat.station} />
              </span>
              <div>
                <h2 className="text-xl font-bold leading-tight">{cat.name}</h2>
                {cat.description && <p className="text-sm text-white/45">{cat.description}</p>}
              </div>
            </div>

            <ul className="space-y-2">
              {cat.products.map((p) => {
                const hasGroups = p.groups && p.groups.length > 0;
                const q = hasGroups ? 0 : cart[p.id]?.qty ?? 0;
                return (
                  <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-white/10 p-3 backdrop-blur transition" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))" }}>
                    <ProductThumb p={p} station={cat.station} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold leading-tight">
                        {p.name}
                        {p.size_label && <span className="ml-1.5 text-sm font-normal text-white/40">· {p.size_label}</span>}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <p className="font-bold" style={{ color: ACCENT_HI }}>
                          {(() => { const fp = fromPrice(p); return <>{fp.from && <span className="text-[10px] font-medium text-white/40">a partir de </span>}{brl(fp.cents)}</>; })()}
                        </p>
                        {hasGroups && <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: "rgba(255,59,78,0.15)", color: ACCENT_HI }}>monta</span>}
                      </div>
                    </div>
                    {q > 0 ? (
                      <div className="flex items-center gap-2.5">
                        <button onClick={() => decKey(p.id)} aria-label="menos" className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-lg leading-none active:scale-95">−</button>
                        <span className="w-4 text-center font-bold tabular-nums">{q}</span>
                        <button onClick={() => incKey(p.id)} aria-label="mais" className="flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none text-white active:scale-95" style={{ background: `linear-gradient(180deg, ${ACCENT_HI}, ${ACCENT})` }}>+</button>
                      </div>
                    ) : (
                      <button onClick={() => onPlus(p, cat.station)} aria-label={`adicionar ${p.name}`} className="flex h-9 w-9 items-center justify-center rounded-full text-xl leading-none text-white shadow-lg active:scale-95" style={{ background: `linear-gradient(180deg, ${ACCENT_HI}, ${ACCENT})`, boxShadow: "0 8px 22px -10px rgba(255,59,78,0.6)" }}>+</button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {count > 0 && !open && (
        <button onClick={() => setOpen(true)} className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-center justify-between rounded-2xl px-5 py-4 font-bold text-white shadow-2xl active:scale-[0.99]" style={{ background: `linear-gradient(180deg, ${ACCENT_HI}, ${ACCENT})`, boxShadow: "0 16px 40px -12px rgba(255,59,78,0.6)" }}>
          <span className="flex items-center gap-2"><span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-black/25 px-1.5 text-sm tabular-nums">{count}</span> Ver pedido</span>
          <span className="tabular-nums">{brl(total)}</span>
        </button>
      )}

      {customizing && (
        <ProductCustomizer
          product={customizing.product}
          accent={ACCENT}
          dark
          onClose={() => setCustomizing(null)}
          onConfirm={(r: CustomizeResult) => { addLine(customizing.product, customizing.station, r.modifierIds, r.mods, r.unitPriceCents, r.qty); setCustomizing(null); }}
        />
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-md rounded-t-3xl border-t border-white/10 p-5 pb-7" style={{ background: "#17130E", maxHeight: "82vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-2xl font-extrabold" style={{ fontFamily: "Georgia, serif" }}>Seu pedido</h3>
              <button onClick={() => setOpen(false)} aria-label="fechar" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-lg">✕</button>
            </div>

            {sent ? (
              <div className="py-10 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "rgba(52,211,153,0.15)", color: "#34D399" }}>
                  <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                </div>
                <p className="text-lg font-bold">Pedido enviado!</p>
                <p className="mt-1 text-sm text-white/50">Já está sendo preparado.</p>
              </div>
            ) : (
              <>
                <ul className="divide-y divide-white/8">
                  {lines.map((l) => (
                    <li key={l.key} className="flex items-start gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold leading-tight">{l.product.name}{l.product.size_label && <span className="text-sm font-normal text-white/40"> · {l.product.size_label}</span>}</p>
                        {l.mods.length > 0 && <p className="text-xs text-white/45">{l.mods.map((m) => m.name).join(" · ")}</p>}
                        <p className="text-sm text-white/45">{brl(l.unitPriceCents)}</p>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <button onClick={() => decKey(l.key)} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-lg leading-none active:scale-95">−</button>
                        <span className="w-4 text-center font-bold tabular-nums">{l.qty}</span>
                        <button onClick={() => incKey(l.key)} className="flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none text-white active:scale-95" style={{ background: `linear-gradient(180deg, ${ACCENT_HI}, ${ACCENT})` }}>+</button>
                      </div>
                    </li>
                  ))}
                </ul>

                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Observação (ex: sem cebola, ponto da carne)" className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none placeholder:text-white/35 focus:border-white/25" />

                {Object.keys(byStation).length > 1 && (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/45">
                    {Object.entries(byStation).map(([st, n]) => (
                      <span key={st} className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 capitalize">
                        <span style={{ color: ACCENT_HI }}><StationIcon station={st} size={13} /></span> {n} → {st}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-5 flex items-center justify-between">
                  <span className="text-white/55">Total</span>
                  <span className="text-2xl font-extrabold" style={{ color: ACCENT_HI }}>{brl(total)}</span>
                </div>

                {errorMsg && <p className="mt-3 rounded-xl bg-red-500/15 px-3 py-2 text-center text-sm font-semibold text-red-300">{errorMsg}</p>}

                <button onClick={send} disabled={count === 0 || sending} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-extrabold text-white shadow-xl active:scale-[0.99] disabled:opacity-50" style={{ background: `linear-gradient(180deg, ${ACCENT_HI}, ${ACCENT})`, boxShadow: "0 14px 36px -12px rgba(255,59,78,0.6)" }}>
                  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /><path d="M21 19H3l1.8-3a8 8 0 0 0 .9-3.6V9a6.3 6.3 0 0 1 12.6 0v3.4a8 8 0 0 0 .9 3.6Z" /></svg>
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
