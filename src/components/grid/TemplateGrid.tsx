"use client";

import { useMemo, useState } from "react";
import type { BarCategory, BarProduct } from "@/lib/menu-bar-store";
import ProductCustomizer, { type CustomizeResult } from "@/components/menu/ProductCustomizer";
import PizzaWheel from "@/components/grid/PizzaWheel";
import { fromPrice } from "@/lib/menu-price";
import { brandVars } from "@/lib/brand-theme";

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
  hasDelivery = false,
  whatsapp = "",
  deliveryFeeCents = 0,
  minOrderCents = 0,
  deliveryZones = [],
  deliveryMode = "fixed",
}: {
  storeName: string;
  tagline?: string | null;
  aberto: boolean;
  categories: BarCategory[];
  slug: string;
  tableNumber?: number | null;
  coverNotice?: { artist: string; coverCents: number } | null;
  branding?: { logoUrl?: string; bannerUrl?: string; primaryColor?: string } | null;
  hasDelivery?: boolean;
  whatsapp?: string;
  deliveryFeeCents?: number;
  minOrderCents?: number;
  deliveryZones?: { bairro: string; feeCents: number }[];
  deliveryMode?: "fixed" | "zones";
}) {
  const [cart, setCart] = useState<Record<string, Line>>({});
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [customizing, setCustomizing] = useState<{ product: BarProduct; station: string } | null>(null);
  // delivery (cardápio público sem mesa): dados do cliente + entrega/retirada
  const [dMode, setDMode] = useState<"retirada" | "entrega">("retirada");
  const [dName, setDName] = useState("");
  const [dPhone, setDPhone] = useState("");
  const [dAddress, setDAddress] = useState("");
  const [dCep, setDCep] = useState("");
  const [dBairro, setDBairro] = useState("");
  const [dPay, setDPay] = useState<"dinheiro" | "pix" | "credito">("pix");
  const [placed, setPlaced] = useState<string | null>(null);
  const [placedCode, setPlacedCode] = useState<string | null>(null);

  // checkout de delivery aparece no cardápio público (sem mesa) quando a loja tem entrega ligada
  const isDeliveryFlow = !tableNumber && hasDelivery;
  const usaZonas = deliveryMode === "zones";
  const deliFee = dMode === "entrega" ? (usaZonas ? (deliveryZones.find((z) => z.bairro === dBairro)?.feeCents ?? 0) : deliveryFeeCents) : 0;

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

  // ViaCEP: preenche endereço a partir do CEP (grátis, sem chave)
  async function lookupCep(raw: string) {
    const cep = raw.replace(/\D/g, "");
    if (cep.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const d = await r.json();
      if (d.erro) return;
      const linha = [d.logradouro, d.bairro, d.localidade && `${d.localidade}-${d.uf}`].filter(Boolean).join(", ");
      if (linha) setDAddress((a) => (a ? a : linha + ", "));
      if (!usaZonas && d.bairro) setDBairro(d.bairro);
    } catch { /* CEP é conveniência; falha não bloqueia */ }
  }

  async function send() {
    if (sending || count === 0) return;
    setErrorMsg("");

    // cardápio com mesa → comanda (fluxo existente)
    if (tableNumber) {
      setSending(true);
      try {
        const r = await fetch("/api/mesa-pedido", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, tableNumber, items: lines.map((l) => ({ productId: l.product.id, qty: l.qty, modifierIds: l.modifierIds })), note }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Não consegui enviar o pedido.");
        setSent(true); setCart({}); setNote("");
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Não consegui enviar o pedido.");
      } finally { setSending(false); }
      return;
    }

    // cardápio público com entrega ligada → pedido de delivery/retirada (orders-store)
    if (isDeliveryFlow) {
      if (!dName.trim() || !dPhone.trim()) { setErrorMsg("Informe nome e telefone."); return; }
      if (dMode === "entrega" && !dAddress.trim()) { setErrorMsg("Informe o endereço para entrega."); return; }
      if (dMode === "entrega" && usaZonas && !dBairro) { setErrorMsg("Escolha o bairro de entrega."); return; }
      if (dMode === "entrega" && total + deliFee < minOrderCents) { setErrorMsg(`Pedido mínimo de ${brl(minOrderCents)}.`); return; } // mínimo só na entrega
      setSending(true);
      try {
        const r = await fetch("/api/delivery-pedido", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug, customerName: dName, phone: dPhone, mode: dMode,
            address: dMode === "entrega" ? dAddress : undefined,
            bairro: dMode === "entrega" ? dBairro : undefined,
            paymentMethod: dPay, note,
            items: lines.map((l) => ({ productId: l.product.id, qty: l.qty, modifierIds: l.modifierIds })),
          }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Não consegui enviar o pedido.");
        setPlaced(d.order?.display ?? null); setPlacedCode(d.order?.code ?? null); setSent(true); setCart({}); setNote("");
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Não consegui enviar o pedido.");
      } finally { setSending(false); }
      return;
    }

    // cardápio só de vitrine (sem mesa, sem entrega) → confirma preview
    setSent(true);
  }

  // mensagem pré-preenchida pro WhatsApp da loja (confirmação humana — diferencial da pesquisa)
  function waText() {
    const L = [`*Pedido ${placed ?? ""}— ${storeName}*`.replace("  ", " ")];
    L.push(`*Cliente:* ${dName}${dPhone ? " · " + dPhone : ""}`);
    L.push(`*Tipo:* ${dMode === "entrega" ? `Entrega (+${brl(deliFee)})` : "Retirada no balcão"}`);
    if (dMode === "entrega" && dAddress) L.push(`*Endereço:* ${dAddress}${dBairro ? " — " + dBairro : ""}`);
    L.push(`*Pagamento:* ${dPay === "pix" ? "PIX" : dPay === "dinheiro" ? "Dinheiro" : "Cartão"} (na entrega)`);
    L.push(`*Total:* ${brl(total + deliFee)}`);
    return encodeURIComponent(L.join("\n"));
  }

  return (
    <main className="min-h-screen bg-[#FAFAF9] text-zinc-900" style={brandVars(branding?.primaryColor)}>
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
        {categories.map((cat) => {
          const banner = cat.img || cat.products.find((p) => p.img)?.img || null;
          return (
          <section key={cat.id}>
            {banner ? (
              <div className="relative mb-4 h-32 overflow-hidden rounded-2xl sm:h-36">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={banner} alt="" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10" />
                <div className="absolute bottom-3 left-4 right-4">
                  <h2 className="text-2xl font-extrabold tracking-tight text-white drop-shadow">{cat.name}</h2>
                  {cat.description && <p className="mt-0.5 text-sm text-white/85 drop-shadow">{cat.description}</p>}
                </div>
              </div>
            ) : (
              <div className="mb-3">
                <h2 className="text-xl font-extrabold">{cat.name}</h2>
                {cat.description && <p className="text-sm text-zinc-400">{cat.description}</p>}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {cat.products.map((p) => {
                const hasGroups = p.groups && p.groups.length > 0;
                const q = hasGroups ? 0 : cart[p.id]?.qty ?? 0;
                return (
                  <div key={p.id} className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition hover:shadow-md">
                    <div className="relative">
                      <Thumb p={p} />
                      {p.by_weight ? (
                        // vendido por peso = pesado no balcão; não é pedível online (evita o beco-sem-saída no checkout)
                        <span className="absolute bottom-2 right-2 rounded-full bg-zinc-900/75 px-2 py-1 text-[10px] font-bold text-white backdrop-blur">pesado no balcão</span>
                      ) : q > 0 ? (
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
                          {(() => { const fp = fromPrice(p); return <>{fp.from && <span className="text-[10px] font-medium text-zinc-400">a partir de </span>}{brl(fp.cents)}{fp.perKg && <span className="text-[11px] font-medium text-zinc-400">/kg</span>}</>; })()}
                        </p>
                        {hasGroups && <span className="rounded-full bg-orange-50 px-1.5 py-0.5 text-[10px] font-bold text-orange-600">monta</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
          );
        })}
      </div>

      {count > 0 && !open && (
        <button onClick={() => setOpen(true)} className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-center justify-between rounded-2xl px-5 py-4 font-bold text-white shadow-2xl active:scale-[0.99]" style={{ background: branding?.primaryColor || ACCENT, boxShadow: "0 16px 40px -12px rgba(0,0,0,0.4)" }}>
          <span className="flex items-center gap-2"><span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-black/20 px-1.5 text-sm tabular-nums">{count}</span> Ver pedido</span>
          <span className="tabular-nums">{brl(total)}</span>
        </button>
      )}

      {customizing && (
        customizing.product.groups.some((g) => g.price_mode === "highest") ? (
          // pizza (grupo meio-a-meio) → montador visual em roda, estilo Dom João
          <PizzaWheel
            product={customizing.product}
            accent={branding?.primaryColor || ACCENT}
            onClose={() => setCustomizing(null)}
            onConfirm={(r: CustomizeResult) => { addLine(customizing.product, customizing.station, r.modifierIds, r.mods, r.unitPriceCents, r.qty); setCustomizing(null); }}
          />
        ) : (
          <ProductCustomizer
            product={customizing.product}
            accent={ACCENT_HI}
            onClose={() => setCustomizing(null)}
            onConfirm={(r: CustomizeResult) => { addLine(customizing.product, customizing.station, r.modifierIds, r.mods, r.unitPriceCents, r.qty); setCustomizing(null); }}
          />
        )
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
              <div className="py-8 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600">
                  <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                </div>
                <p className="text-lg font-bold">Pedido enviado! {placed}</p>
                <p className="mt-1 text-sm text-zinc-500">{isDeliveryFlow ? "A loja vai confirmar pelo WhatsApp." : "Já está sendo preparado."}</p>
                {isDeliveryFlow && placedCode && (
                  <a href={`/${slug}/pedido/${placedCode}`} className="mt-4 block rounded-xl border border-zinc-200 bg-zinc-50 p-3 transition hover:border-zinc-300">
                    <span className="text-xs text-zinc-500">Acompanhe pelo código</span>
                    <span className="mt-0.5 block text-2xl font-extrabold tracking-[0.2em]" style={{ color: branding?.primaryColor || ACCENT }}>{placedCode}</span>
                    <span className="text-xs font-semibold text-zinc-400">toque para ver o status →</span>
                  </a>
                )}
                {isDeliveryFlow && whatsapp && (
                  <a href={`https://wa.me/${whatsapp}?text=${waText()}`} target="_blank" rel="noopener noreferrer"
                    className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-6 py-3 font-bold text-white active:scale-[0.99]">
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l-.999 3.648 3.978-1.607z"/></svg>
                    Confirmar pelo WhatsApp
                  </a>
                )}
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

                {isDeliveryFlow && (
                  <div className="mt-4 space-y-3 border-t border-zinc-100 pt-4">
                    {/* retirada x entrega */}
                    <div className="grid grid-cols-2 gap-2">
                      {(["retirada", "entrega"] as const).map((m) => (
                        <button key={m} onClick={() => setDMode(m)} className={`rounded-xl border-2 p-2.5 text-sm font-bold transition ${dMode === m ? "border-current" : "border-zinc-200 text-zinc-500"}`} style={dMode === m ? { color: branding?.primaryColor || ACCENT } : undefined}>
                          {m === "retirada" ? "Retirar no balcão" : "Entrega"}
                          <span className="block text-[11px] font-medium text-zinc-400">{m === "retirada" ? "Sem taxa" : usaZonas ? "Taxa por bairro" : `+ ${brl(deliveryFeeCents)}`}</span>
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input value={dName} onChange={(e) => setDName(e.target.value)} placeholder="Seu nome" className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm outline-none focus:border-zinc-400" />
                      <input value={dPhone} onChange={(e) => setDPhone(e.target.value)} inputMode="tel" placeholder="WhatsApp" className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm outline-none focus:border-zinc-400" />
                    </div>
                    {dMode === "entrega" && (
                      <>
                        <div className="flex gap-2">
                          <input value={dCep} onChange={(e) => setDCep(e.target.value)} onBlur={(e) => lookupCep(e.target.value)} inputMode="numeric" placeholder="CEP" className="w-28 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm outline-none focus:border-zinc-400" />
                          <span className="flex items-center text-[11px] text-zinc-400">preenche o endereço</span>
                        </div>
                        <input value={dAddress} onChange={(e) => setDAddress(e.target.value)} placeholder="Endereço, número, complemento" className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm outline-none focus:border-zinc-400" />
                        {usaZonas && (
                          <select value={dBairro} onChange={(e) => setDBairro(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm outline-none focus:border-zinc-400">
                            <option value="">Bairro de entrega…</option>
                            {deliveryZones.map((z) => <option key={z.bairro} value={z.bairro}>{z.bairro} (+{brl(z.feeCents)})</option>)}
                          </select>
                        )}
                      </>
                    )}
                    {/* como vai pagar (informativo — a loja recebe na entrega) */}
                    <div>
                      <p className="mb-1.5 text-xs font-semibold text-zinc-500">Como vai pagar {dMode === "entrega" ? "na entrega" : "na retirada"}?</p>
                      <div className="grid grid-cols-3 gap-2">
                        {([["pix", "PIX"], ["dinheiro", "Dinheiro"], ["credito", "Cartão"]] as const).map(([id, label]) => (
                          <button key={id} onClick={() => setDPay(id)} className={`rounded-xl border-2 py-2 text-sm font-bold transition ${dPay === id ? "border-current" : "border-zinc-200 text-zinc-500"}`} style={dPay === id ? { color: branding?.primaryColor || ACCENT } : undefined}>{label}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {Object.keys(byStation).length > 1 && (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-400">
                    {Object.entries(byStation).map(([st, n]) => (<span key={st} className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 capitalize">{n} → {st}</span>))}
                  </div>
                )}
                <div className="mt-5 space-y-1">
                  {isDeliveryFlow && (
                    <>
                      <div className="flex items-center justify-between text-sm text-zinc-500"><span>Subtotal</span><span className="tabular-nums">{brl(total)}</span></div>
                      <div className="flex items-center justify-between text-sm text-zinc-500"><span>{dMode === "entrega" ? "Taxa de entrega" : "Retirada"}</span><span className="tabular-nums">{deliFee ? brl(deliFee) : "grátis"}</span></div>
                    </>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">Total</span>
                    <span className="text-2xl font-extrabold tabular-nums" style={{ color: branding?.primaryColor || ACCENT }}>{brl(total + (isDeliveryFlow ? deliFee : 0))}</span>
                  </div>
                </div>
                {errorMsg && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-center text-sm font-semibold text-red-600">{errorMsg}</p>}
                <button onClick={send} disabled={count === 0 || sending || (isDeliveryFlow && !aberto)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-extrabold text-white shadow-xl active:scale-[0.99] disabled:opacity-50" style={{ background: branding?.primaryColor || ACCENT, boxShadow: "0 14px 36px -12px rgba(0,0,0,0.4)" }}>
                  {isDeliveryFlow && !aberto ? "Loja fechada" : sending ? "Enviando…" : tableNumber ? "Enviar pedido" : isDeliveryFlow ? "Fazer pedido" : "Confirmar pedido"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
