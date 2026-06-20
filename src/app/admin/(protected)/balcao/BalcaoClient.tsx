"use client";

import { useState } from "react";
import type { BarCategory, BarProduct } from "@/lib/menu-bar-store";
import type { PaymentMethod } from "@/lib/orders-store";
import ProductCustomizer, { type CustomizeResult } from "@/components/menu/ProductCustomizer";
import { printTicket } from "@/lib/print";
import { ticketHtml } from "@/lib/ticket";
import { brl } from "@/lib/format";
import { qzReadScaleGrams, qzListSerialPorts, getScaleConfig, setScaleConfig } from "@/lib/qz";

type Line = { uid: string; productId: string; name: string; qty: number; unitPriceCents: number; grams?: number; modifierIds?: string[] };

const PAYS: { id: PaymentMethod; label: string }[] = [
  { id: "dinheiro", label: "Dinheiro" },
  { id: "pix", label: "PIX" },
  { id: "debito", label: "Débito" },
  { id: "credito", label: "Crédito" },
];

let seq = 0;
const uid = () => `l${++seq}`;

export default function BalcaoClient({ categories, storeName }: { categories: BarCategory[]; storeName: string }) {
  const [cart, setCart] = useState<Line[]>([]);
  const [weightFor, setWeightFor] = useState<BarProduct | null>(null);
  const [customizeFor, setCustomizeFor] = useState<BarProduct | null>(null);
  const [pay, setPay] = useState<PaymentMethod>("dinheiro");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const total = cart.reduce((s, l) => s + l.qty * l.unitPriceCents, 0);

  function onProduct(p: BarProduct) {
    setErr("");
    if (p.by_weight) { setWeightFor(p); return; }
    if (p.groups && p.groups.length) { setCustomizeFor(p); return; }
    // simples: incrementa a linha igual (mesmo produto, sem peso/mods)
    setCart((c) => {
      const ix = c.findIndex((l) => l.productId === p.id && !l.grams && !l.modifierIds);
      if (ix >= 0) { const n = [...c]; n[ix] = { ...n[ix], qty: n[ix].qty + 1 }; return n; }
      return [...c, { uid: uid(), productId: p.id, name: p.name, qty: 1, unitPriceCents: p.price_cents }];
    });
  }
  function addWeight(p: BarProduct, grams: number) {
    const liquido = Math.max(0, grams - (p.tare_grams || 0));
    const cents = Math.round((liquido / 1000) * p.price_cents);
    setCart((c) => [...c, { uid: uid(), productId: p.id, name: `${p.name} ${liquido}g`, qty: 1, unitPriceCents: cents, grams }]);
    setWeightFor(null);
  }
  function addCustom(p: BarProduct, r: CustomizeResult) {
    const nm = p.name + (r.mods.length ? ` (${r.mods.map((m) => m.name).join(", ")})` : "");
    setCart((c) => [...c, { uid: uid(), productId: p.id, name: nm, qty: r.qty, unitPriceCents: r.unitPriceCents, modifierIds: r.modifierIds }]);
    setCustomizeFor(null);
  }
  const inc = (u: string) => setCart((c) => c.map((l) => (l.uid === u ? { ...l, qty: l.qty + 1 } : l)));
  const dec = (u: string) => setCart((c) => c.flatMap((l) => (l.uid === u ? (l.qty > 1 ? [{ ...l, qty: l.qty - 1 }] : []) : [l])));
  const del = (u: string) => setCart((c) => c.filter((l) => l.uid !== u));

  async function finalizar() {
    if (saving || !cart.length) return;
    setSaving(true); setErr("");
    try {
      const r = await fetch("/api/balcao-venda", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod: pay, items: cart.map((l) => ({ productId: l.productId, qty: l.qty, grams: l.grams, modifierIds: l.modifierIds })) }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Falha ao registrar a venda.");
      // cupom
      const o = d.order;
      const now = new Date(); const p2 = (n: number) => String(n).padStart(2, "0");
      void printTicket(ticketHtml({
        loja: storeName, display: o.display, dateLabel: `${p2(now.getDate())}/${p2(now.getMonth() + 1)} ${p2(now.getHours())}:${p2(now.getMinutes())}`,
        modeLabel: "Balcão", paymentLabel: PAYS.find((x) => x.id === pay)?.label,
        items: o.items.map((it: { qty: number; name: string; paidCents: number }) => ({ qty: it.qty, name: it.name, totalCents: it.paidCents > 0 ? it.paidCents : undefined })),
        totalCents: o.totalCents, code: o.code, origem: "balcao",
      }));
      setDone(o.display); setCart([]);
      setTimeout(() => setDone(null), 3500);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao registrar a venda.");
    } finally { setSaving(false); }
  }

  const cats = categories.filter((c) => c.products.length);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      {/* produtos */}
      <div className="space-y-6">
        {cats.length === 0 && <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-[var(--text-muted)]">Sem produtos no cardápio ainda. Cadastre em Cardápio.</p>}
        {cats.map((cat) => (
          <section key={cat.id}>
            <h2 className="mb-2 text-sm font-extrabold text-ink">{cat.name}</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {cat.products.map((p) => (
                <button key={p.id} onClick={() => onProduct(p)} className="rounded-xl border border-line bg-bg-elevated p-3 text-left transition hover:border-brand-600 active:scale-[0.98]">
                  <div className="text-sm font-bold leading-tight text-ink">{p.name}</div>
                  <div className="mt-1 text-sm font-extrabold text-brand-600">
                    {brl(p.price_cents)}{p.by_weight && <span className="text-[11px] font-medium text-[var(--text-faded)]">/kg</span>}
                  </div>
                  {p.by_weight && <span className="mt-1 inline-block rounded-full bg-[#E8F6DD] px-1.5 text-[10px] font-bold text-lime">pesar</span>}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* carrinho */}
      <div className="lg:sticky lg:top-4 lg:self-start">
        <div className="rounded-2xl border border-line bg-bg-elevated p-4">
          <h3 className="mb-3 text-base font-extrabold text-ink">Venda atual</h3>
          {done && <div className="mb-3 rounded-xl bg-[#E8F6DD] p-3 text-center text-sm font-bold text-lime">Venda {done} registrada ✓ (cupom enviado)</div>}
          {cart.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--text-faded)]">Toque nos produtos pra lançar.</p>
          ) : (
            <ul className="mb-3 divide-y divide-line">
              {cart.map((l) => (
                <li key={l.uid} className="flex items-center gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-ink">{l.name}</div>
                    <div className="text-xs text-[var(--text-muted)]">{brl(l.unitPriceCents)}{l.qty > 1 ? ` × ${l.qty}` : ""}</div>
                  </div>
                  {!l.grams && (
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => dec(l.uid)} className="grid h-7 w-7 place-items-center rounded-lg border border-line text-lg leading-none">−</button>
                      <span className="w-4 text-center text-sm font-bold tabular-nums">{l.qty}</span>
                      <button onClick={() => inc(l.uid)} className="grid h-7 w-7 place-items-center rounded-lg brand-gradient text-lg leading-none text-white">+</button>
                    </div>
                  )}
                  <button onClick={() => del(l.uid)} className="grid h-7 w-7 place-items-center rounded-lg text-[var(--text-faded)] hover:text-[var(--red-no)]">✕</button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center justify-between border-t border-line pt-3">
            <span className="text-[var(--text-muted)]">Total</span>
            <span className="text-2xl font-extrabold text-brand-600">{brl(total)}</span>
          </div>

          <p className="mt-3 mb-1.5 text-xs font-semibold text-[var(--text-muted)]">Pagamento</p>
          <div className="grid grid-cols-4 gap-1.5">
            {PAYS.map((m) => (
              <button key={m.id} onClick={() => setPay(m.id)} className={`rounded-lg border-2 py-2 text-[11px] font-bold transition ${pay === m.id ? "border-brand-600 text-brand-600" : "border-line text-[var(--text-muted)]"}`}>{m.label}</button>
            ))}
          </div>

          {err && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-center text-sm font-semibold text-red-600">{err}</p>}

          <button onClick={finalizar} disabled={saving || !cart.length} className="mt-3 w-full rounded-xl brand-gradient py-3 font-bold text-white disabled:opacity-50">
            {saving ? "Registrando…" : `Finalizar — ${brl(total)}`}
          </button>
        </div>
      </div>

      {weightFor && <WeightModal product={weightFor} onClose={() => setWeightFor(null)} onConfirm={(g) => addWeight(weightFor, g)} />}
      {customizeFor && <ProductCustomizer product={customizeFor} accent="#7C3AED" onClose={() => setCustomizeFor(null)} onConfirm={(r) => addCustom(customizeFor, r)} />}
    </div>
  );
}

function WeightModal({ product, onClose, onConfirm }: { product: BarProduct; onClose: () => void; onConfirm: (grams: number) => void }) {
  const [grams, setGrams] = useState("");
  const [reading, setReading] = useState(false);
  const [scaleMsg, setScaleMsg] = useState("");
  const [cfgOpen, setCfgOpen] = useState(false);
  const [ports, setPorts] = useState<string[]>([]);
  const [selPort, setSelPort] = useState("");
  const [baud, setBaud] = useState("9600");
  const bruto = Math.max(0, Math.round(parseFloat(grams.replace(",", ".")) || 0));
  const liquido = Math.max(0, bruto - (product.tare_grams || 0));
  const cents = Math.round((liquido / 1000) * product.price_cents);

  async function ler() {
    setScaleMsg("");
    if (!getScaleConfig()) { // 1ª vez: configurar a porta
      setReading(true);
      try {
        const ps = await qzListSerialPorts();
        setPorts(ps); setSelPort(ps[0] ?? ""); setCfgOpen(true);
      } catch {
        setScaleMsg("QZ Tray não está rodando. Abra o QZ Tray ou digite o peso na mão.");
      } finally { setReading(false); }
      return;
    }
    setReading(true);
    try {
      const g = await qzReadScaleGrams();
      if (g != null && g > 0) setGrams(String(g));
      else setScaleMsg("Não consegui ler um peso estável. Tente de novo ou digite na mão.");
    } catch (e) {
      setScaleMsg(e instanceof Error ? e.message : "Falha ao ler a balança.");
    } finally { setReading(false); }
  }
  function salvarCfg() {
    if (!selPort) return;
    setScaleConfig({ port: selPort, baudRate: Number(baud) || 9600, dataBits: 8, parity: "none", stopBits: 1 });
    setCfgOpen(false);
    void ler();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm rounded-2xl bg-bg-elevated p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-extrabold text-ink">{product.name}</h3>
        <p className="mb-3 text-sm text-[var(--text-muted)]">{brl(product.price_cents)}/kg{product.tare_grams ? ` · tara ${product.tare_grams}g` : ""}</p>

        {cfgOpen ? (
          <div className="rounded-xl border border-line p-3">
            <p className="mb-2 text-xs font-bold text-[var(--text-muted)]">Configurar balança (1ª vez)</p>
            <select value={selPort} onChange={(e) => setSelPort(e.target.value)} className="mb-2 w-full rounded-lg border border-line bg-bg-base px-3 py-2 text-sm text-ink">
              {ports.length === 0 && <option value="">nenhuma porta encontrada</option>}
              {ports.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={baud} onChange={(e) => setBaud(e.target.value)} className="mb-2 w-full rounded-lg border border-line bg-bg-base px-3 py-2 text-sm text-ink">
              {["2400", "4800", "9600"].map((b) => <option key={b} value={b}>{b} baud</option>)}
            </select>
            <button onClick={salvarCfg} disabled={!selPort} className="w-full rounded-lg brand-gradient py-2 text-sm font-bold text-white disabled:opacity-50">Salvar e ler</button>
          </div>
        ) : (
          <>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-bold uppercase text-[var(--text-muted)]">Peso na balança (g)</label>
              <button onClick={ler} disabled={reading} className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[11px] font-bold text-brand-600 disabled:opacity-50">
                {reading ? "Lendo…" : "⚖ Ler balança"}
              </button>
            </div>
            <input autoFocus type="number" inputMode="numeric" value={grams} onChange={(e) => setGrams(e.target.value)} placeholder="ex: 480" className="w-full rounded-xl border border-line bg-bg-base px-4 py-3 text-lg font-bold text-ink outline-none focus:border-brand-600" />
            {scaleMsg && <p className="mt-1 text-[11px] text-[var(--red-no)]">{scaleMsg}</p>}
            {product.tare_grams > 0 && bruto > 0 && <p className="mt-1 text-[11px] text-[var(--text-faded)]">líquido {liquido}g (tara {product.tare_grams}g descontada)</p>}
            <div className="mt-3 flex items-center justify-between rounded-xl bg-bg-surface-2 px-4 py-3">
              <span className="text-sm text-[var(--text-muted)]">Valor</span>
              <span className="text-2xl font-extrabold text-brand-600">{brl(cents)}</span>
            </div>
            <button onClick={() => liquido > 0 && onConfirm(bruto)} disabled={liquido <= 0} className="mt-3 w-full rounded-xl brand-gradient py-3 font-bold text-white disabled:opacity-50">Lançar</button>
          </>
        )}
      </div>
    </div>
  );
}
