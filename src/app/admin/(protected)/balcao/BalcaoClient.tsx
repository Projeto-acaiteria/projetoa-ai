"use client";

import { useState } from "react";
import type { BarCategory, BarProduct } from "@/lib/menu-bar-store";
import type { PaymentMethod } from "@/lib/orders-store";
import type { CardMachine } from "@/lib/settings-store";
import ProductCustomizer, { type CustomizeResult } from "@/components/menu/ProductCustomizer";
import { printTicket } from "@/lib/print";
import { ticketHtml } from "@/lib/ticket";
import { brl } from "@/lib/format";
import WeightModal from "@/components/admin/WeightModal";
import { IconSearch } from "@/components/Icons";

type Line = { uid: string; productId: string; name: string; qty: number; unitPriceCents: number; grams?: number; modifierIds?: string[]; note?: string };

// normaliza p/ busca: minúsculo + sem acento (açaí → acai)
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

const PAYS: { id: PaymentMethod; label: string }[] = [
  { id: "dinheiro", label: "Dinheiro" },
  { id: "pix", label: "PIX" },
  { id: "debito", label: "Débito" },
  { id: "credito", label: "Crédito" },
];

let seq = 0;
const uid = () => `l${++seq}`;

export default function BalcaoClient({ categories, storeName, machines, endereco, cnpj, tel, loyaltyEnabled }: { categories: BarCategory[]; storeName: string; machines: CardMachine[]; endereco: string; cnpj: string; tel: string; loyaltyEnabled: boolean }) {
  const [cart, setCart] = useState<Line[]>([]);
  const [query, setQuery] = useState("");
  const [weightFor, setWeightFor] = useState<BarProduct | null>(null);
  const [customizeFor, setCustomizeFor] = useState<BarProduct | null>(null);
  const [pay, setPay] = useState<PaymentMethod>("dinheiro");
  const [discInput, setDiscInput] = useState("");
  const [discMode, setDiscMode] = useState<"brl" | "pct">("brl");
  const activeMachines = machines.filter((m) => m.active);
  const [machineId, setMachineId] = useState<string>(activeMachines[0]?.id ?? "");
  const [parcelas, setParcelas] = useState(1);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState("");
  // fidelidade: identifica o cliente pelo telefone p/ pontuar a venda e resgatar prêmio (item inteiro)
  const [phone, setPhone] = useState("");
  const [customer, setCustomer] = useState<{ name: string; points: number; found: boolean } | null>(null);
  const [rewards, setRewards] = useState<{ label: string; points: number }[]>([]);
  const [loyMsg, setLoyMsg] = useState("");
  const [loyBusy, setLoyBusy] = useState(false);

  const total = cart.reduce((s, l) => s + l.qty * l.unitPriceCents, 0);
  // desconto: % do total ou R$ digitado; clampa em [0, total]
  const discRaw = parseFloat(discInput.replace(",", ".")) || 0;
  const discountCents = discMode === "pct" ? Math.round((total * Math.min(discRaw, 100)) / 100) : Math.min(Math.round(discRaw * 100), total);
  const finalTotal = Math.max(0, total - discountCents);

  async function buscarCliente() {
    const p = phone.trim();
    if (!p || loyBusy) return;
    setLoyBusy(true); setLoyMsg("");
    try {
      const r = await fetch(`/api/pontos?phone=${encodeURIComponent(p)}`, { cache: "no-store" });
      const d = await r.json();
      setRewards(Array.isArray(d.rewards) ? d.rewards : []);
      if (d.customer) setCustomer({ name: d.customer.name || "Cliente", points: d.customer.points ?? 0, found: true });
      else setCustomer({ name: "", points: 0, found: false });
    } catch { setLoyMsg("Não consegui buscar o cliente."); }
    finally { setLoyBusy(false); }
  }

  async function resgatar(rewardPoints: number, label: string) {
    if (loyBusy || !phone.trim()) return;
    setLoyBusy(true); setLoyMsg("");
    try {
      const r = await fetch("/api/pontos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: phone.trim(), rewardPoints }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Falha no resgate.");
      setCustomer((c) => (c ? { ...c, points: d.customer?.points ?? c.points } : c));
      setLoyMsg(`Resgatado: ${label} ✓ (entregue ao cliente)`);
    } catch (e) { setLoyMsg(e instanceof Error ? e.message : "Falha no resgate."); }
    finally { setLoyBusy(false); }
  }

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
  const setNote = (u: string, v: string) => setCart((c) => c.map((l) => (l.uid === u ? { ...l, note: v } : l)));
  // qtd rápida: digita o número direto (3) em vez de tocar + várias vezes; clampa em [1, 999]
  const setQty = (u: string, v: string) => { const n = Math.max(1, Math.min(999, parseInt(v.replace(/\D/g, ""), 10) || 1)); setCart((c) => c.map((l) => (l.uid === u ? { ...l, qty: n } : l))); };

  async function finalizar() {
    if (saving || !cart.length) return;
    setSaving(true); setErr("");
    try {
      const r = await fetch("/api/balcao-venda", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod: pay, machineId: (pay === "debito" || pay === "credito") && machineId ? machineId : undefined, parcelas: pay === "credito" ? parcelas : 1, customerPhone: phone.trim() || undefined, customerName: customer?.found ? customer.name : undefined, discountCents: discountCents || undefined, items: cart.map((l) => ({ productId: l.productId, qty: l.qty, grams: l.grams, modifierIds: l.modifierIds, note: l.note?.trim() || undefined })) }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Falha ao registrar a venda.");
      // cupom
      const o = d.order;
      const now = new Date(); const p2 = (n: number) => String(n).padStart(2, "0");
      void printTicket(ticketHtml({
        loja: storeName, endereco, cnpj, tel, display: o.display, dateLabel: `${p2(now.getDate())}/${p2(now.getMonth() + 1)} ${p2(now.getHours())}:${p2(now.getMinutes())}`,
        modeLabel: "Balcão", paymentLabel: PAYS.find((x) => x.id === pay)?.label,
        items: o.items.map((it: { qty: number; name: string; paidCents: number; note?: string }) => ({ qty: it.qty, name: it.name, note: it.note, totalCents: it.paidCents > 0 ? it.paidCents : undefined })),
        totalCents: o.totalCents, subtotalCents: o.discountCents ? o.subtotalCents : undefined, discountCents: o.discountCents || undefined, code: o.code, origem: "balcao",
      }));
      const pts = d.pointsAwarded ?? 0;
      setDone(o.display + (pts > 0 ? ` · +${pts} pts` : "")); setCart([]); setDiscInput("");
      setPhone(""); setCustomer(null); setRewards([]); setLoyMsg("");
      setTimeout(() => setDone(null), 3500);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao registrar a venda.");
    } finally { setSaving(false); }
  }

  const cats = categories.filter((c) => c.products.length);

  // busca por nome (sem acento/caixa). Achata todos os produtos ativos das categorias.
  const q = norm(query.trim());
  const results = q
    ? categories.flatMap((c) => c.products).filter((p) => norm(p.name).includes(q))
    : [];
  // adiciona via busca: roteia igual ao grid (peso/grupos/simples) e limpa a busca
  function pickResult(p: BarProduct) {
    onProduct(p);
    if (!p.by_weight && !(p.groups && p.groups.length)) setQuery("");
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      {/* produtos */}
      <div className="space-y-6">
        {/* busca por nome — Enter lança o 1º resultado */}
        <div className="sticky top-0 z-10 -mx-1 bg-bg-base/95 px-1 pb-1 pt-0.5 backdrop-blur supports-[backdrop-filter]:bg-bg-base/80">
          <div className="relative">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--text-faded)]" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && results[0]) { e.preventDefault(); pickResult(results[0]); }
                else if (e.key === "Escape") setQuery("");
              }}
              type="search"
              autoComplete="off"
              placeholder="Buscar produto pelo nome…"
              aria-label="Buscar produto"
              className="h-11 w-full rounded-lg border border-line bg-bg-elevated pl-10 pr-3 text-sm text-ink outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-400/40"
            />
          </div>
        </div>

        {cats.length === 0 && <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-[var(--text-muted)]">Sem produtos no cardápio ainda. Cadastre em Cardápio.</p>}

        {q ? (
          results.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-[var(--text-muted)]">Nenhum produto com “{query.trim()}”.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {results.map((p) => (
                <button key={p.id} onClick={() => pickResult(p)} className="rounded-xl border border-line bg-bg-elevated p-3 text-left transition hover:border-brand-600 active:scale-[0.98]">
                  <div className="text-sm font-bold leading-tight text-ink">{p.name}</div>
                  <div className="mt-1 text-sm font-extrabold text-brand-600">
                    {brl(p.price_cents)}{p.by_weight && <span className="text-[11px] font-medium text-[var(--text-faded)]">/kg</span>}
                  </div>
                  {p.by_weight && <span className="mt-1 inline-block rounded-full bg-[#E8F6DD] px-1.5 text-[10px] font-bold text-lime">pesar</span>}
                </button>
              ))}
            </div>
          )
        ) : cats.map((cat) => (
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
                <li key={l.uid} className="py-2">
                  <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-ink">{l.name}</div>
                    <div className="text-xs text-[var(--text-muted)]">{brl(l.unitPriceCents)}{l.qty > 1 ? ` × ${l.qty}` : ""}</div>
                  </div>
                  {!l.grams && (
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => dec(l.uid)} className="grid h-7 w-7 place-items-center rounded-lg border border-line text-lg leading-none">−</button>
                      <input type="text" inputMode="numeric" value={l.qty} onChange={(e) => setQty(l.uid, e.target.value)} aria-label="Quantidade" className="w-9 rounded-lg border border-line bg-bg-base text-center text-sm font-bold tabular-nums text-ink outline-none focus:border-brand-600" />
                      <button onClick={() => inc(l.uid)} className="grid h-7 w-7 place-items-center rounded-lg brand-gradient text-lg leading-none text-white">+</button>
                    </div>
                  )}
                  <button onClick={() => del(l.uid)} className="grid h-7 w-7 place-items-center rounded-lg text-[var(--text-faded)] hover:text-[var(--red-no)]">✕</button>
                  </div>
                  <input value={l.note ?? ""} onChange={(e) => setNote(l.uid, e.target.value)} placeholder="Obs: sem granola, pra viagem…" aria-label="Observação do item" className="mt-1.5 w-full rounded-lg border border-line bg-bg-base px-2.5 py-1.5 text-xs text-ink outline-none focus:border-brand-600" />
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-line pt-3">
            {discountCents > 0 && (
              <div className="mb-1 flex items-center justify-between text-sm text-[var(--text-muted)]">
                <span>Subtotal</span><span className="tabular-nums">{brl(total)}</span>
              </div>
            )}
            {discountCents > 0 && (
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-[var(--text-muted)]">Desconto</span><span className="font-semibold tabular-nums text-lime">− {brl(discountCents)}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-muted)]">Total</span>
              <span className="text-2xl font-extrabold tabular-nums text-brand-600">{brl(finalTotal)}</span>
            </div>
            {/* desconto na venda — R$ ou % */}
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-xs font-semibold text-[var(--text-muted)]">Desconto</span>
              <input value={discInput} onChange={(e) => setDiscInput(e.target.value)} inputMode="decimal" placeholder="0" aria-label="Desconto na venda" className="ml-auto w-16 rounded-lg border border-line bg-bg-base px-2 py-1.5 text-right text-sm tabular-nums text-ink outline-none focus:border-brand-600" />
              <button type="button" onClick={() => setDiscMode("brl")} className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold transition ${discMode === "brl" ? "border-brand-600 text-brand-600" : "border-line text-[var(--text-muted)]"}`}>R$</button>
              <button type="button" onClick={() => setDiscMode("pct")} className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold transition ${discMode === "pct" ? "border-brand-600 text-brand-600" : "border-line text-[var(--text-muted)]"}`}>%</button>
            </div>
          </div>

          {/* fidelidade: só quando o recurso está ligado (espelha o nav/store_config) */}
          {loyaltyEnabled && (
          <div className="mt-3 rounded-xl border border-line bg-bg-surface-2 p-2.5">
            <p className="mb-1.5 text-xs font-semibold text-[var(--text-muted)]">Fidelidade (opcional)</p>
            <div className="flex gap-1.5">
              <input value={phone} onChange={(e) => { setPhone(e.target.value); setCustomer(null); setLoyMsg(""); }} onKeyDown={(e) => { if (e.key === "Enter") buscarCliente(); }} inputMode="tel" placeholder="telefone do cliente" className="min-w-0 flex-1 rounded-lg border border-line bg-bg-base px-2.5 py-2 text-sm text-ink outline-none focus:border-brand-600" />
              <button onClick={buscarCliente} disabled={loyBusy || !phone.trim()} className="rounded-lg border border-line px-3 py-2 text-xs font-bold text-brand-600 disabled:opacity-40">Buscar</button>
            </div>
            {customer && (customer.found ? (
              <div className="mt-2">
                <p className="text-sm text-ink"><b>{customer.name}</b> · <span className="font-bold text-brand-600">{customer.points} pts</span></p>
                {rewards.filter((rw) => customer.points >= rw.points).length > 0 ? (
                  <div className="mt-1.5 space-y-1">
                    <p className="text-[11px] font-bold uppercase text-[var(--text-muted)]">Resgatar prêmio</p>
                    {rewards.filter((rw) => customer.points >= rw.points).map((rw) => (
                      <button key={rw.points} onClick={() => resgatar(rw.points, rw.label)} disabled={loyBusy} className="flex w-full items-center justify-between rounded-lg border border-brand-400 px-2.5 py-1.5 text-xs font-bold text-brand-600 disabled:opacity-40">
                        <span className="truncate">{rw.label}</span><span className="shrink-0">−{rw.points} pts</span>
                      </button>
                    ))}
                  </div>
                ) : <p className="mt-1 text-[11px] text-[var(--text-faded)]">Sem prêmio disponível ainda. A venda vai somar pontos.</p>}
              </div>
            ) : <p className="mt-2 text-[11px] text-[var(--text-faded)]">Cliente novo — a venda vai cadastrar e pontuar.</p>)}
            {loyMsg && <p className="mt-2 rounded-lg bg-[#E8F6DD] px-2.5 py-1.5 text-[11px] font-semibold text-lime">{loyMsg}</p>}
          </div>
          )}

          <p className="mt-3 mb-1.5 text-xs font-semibold text-[var(--text-muted)]">Pagamento</p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {PAYS.map((m) => (
              <button key={m.id} onClick={() => setPay(m.id)} className={`rounded-lg border-2 py-2 text-[11px] font-bold transition ${pay === m.id ? "border-brand-600 text-brand-600" : "border-line text-[var(--text-muted)]"}`}>{m.label}</button>
            ))}
          </div>

          {(pay === "debito" || pay === "credito") && activeMachines.length > 0 && (
            <div className="mt-2 space-y-1.5 rounded-lg border border-line bg-bg-surface-2 p-2.5">
              {activeMachines.length > 1 && (
                <select value={machineId} onChange={(e) => setMachineId(e.target.value)} className="w-full rounded-lg border border-line bg-bg-base px-2.5 py-2 text-sm font-semibold text-ink outline-none">
                  {activeMachines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              )}
              {pay === "credito" && (
                <select value={parcelas} onChange={(e) => setParcelas(Number(e.target.value))} className="w-full rounded-lg border border-line bg-bg-base px-2.5 py-2 text-sm font-semibold text-ink outline-none">
                  {Array.from({ length: activeMachines.find((x) => x.id === machineId)?.maxParcelas ?? 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n === 1 ? "À vista (1x)" : `${n}x parcelado`}</option>)}
                </select>
              )}
            </div>
          )}

          {err && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-center text-sm font-semibold text-red-600">{err}</p>}

          <button onClick={finalizar} disabled={saving || !cart.length} className="mt-3 w-full rounded-xl brand-gradient py-3 font-bold text-white disabled:opacity-50">
            {saving ? "Registrando…" : `Finalizar — ${brl(finalTotal)}`}
          </button>
        </div>
      </div>

      {weightFor && <WeightModal product={weightFor} onClose={() => setWeightFor(null)} onConfirm={(g) => addWeight(weightFor, g)} />}
      {customizeFor && <ProductCustomizer product={customizeFor} accent="#4F46E5" onClose={() => setCustomizeFor(null)} onConfirm={(r) => addCustom(customizeFor, r)} />}
    </div>
  );
}
