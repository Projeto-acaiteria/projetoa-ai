"use client";

import { useState, useEffect, useRef } from "react";
import { brl } from "@/lib/format";
import type { CardMachine } from "@/lib/settings-store";
import { type Size, type ModifierGroup, type Ingredient, WEIGHT_BASE_STOCK_ID } from "@/lib/menu";
import { IconCart, IconPlus, IconMinus, IconCheck, IconTrash, IconBowl, IconBox, IconStar, IconPrinter, IconSearch } from "@/components/Icons";
import { type CupomData } from "@/components/admin/CupomPrinter";
import { printVias, openDrawer } from "@/lib/print";
import { ticketHtml } from "@/lib/ticket";
import WeightModal from "@/components/admin/WeightModal";
import { usePdvHotkeys, ShortcutsHelp, ShortcutsHint } from "@/components/admin/PdvShortcuts";

const PAY_LABEL: Record<string, string> = { dinheiro: "Dinheiro", pix: "Pix", debito: "Cartão débito", credito: "Cartão crédito" };
const nowLabel = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
let pesoSeq = 0;
// normaliza p/ busca: minúsculo + sem acento (açaí → acai)
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
const IconScale = (p: { width?: number; height?: number; className?: string }) => (
  <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18M7 21h10M5 7h14M5 7l-2.5 5a3 3 0 0 0 5 0L5 7zm14 0l-2.5 5a3 3 0 0 0 5 0L19 7z" /></svg>
);

type Produto = { id: string; name: string; priceCents: number; qty: number; unit: string };
type CartLine = { key: string; label: string; note?: string; unitCents: number; qty: number; group: string; stockId?: string; consumes?: Ingredient[] };
type PayMethod = "dinheiro" | "pix" | "debito" | "credito";
export type Fees = Record<PayMethod, number>;
type Qty = Record<string, number>;
type Cust = { phone: string; name: string; points: number };
type SaleResult = { display: string; changeCents: number; pointsAwarded: number; pointsInfo?: string; method: string; receivedCents?: number; stockWarning?: string };

function groupUnits(g: ModifierGroup, qty: Qty) {
  return g.items.reduce((n, it) => n + (qty[it.id] || 0), 0);
}
// custo cobrado do grupo: primeiras `freeUpTo` unidades grátis
function groupCost(g: ModifierGroup, qty: Qty) {
  let free = g.paid ? 0 : g.freeUpTo;
  let cents = 0;
  for (const it of g.items) {
    let q = qty[it.id] || 0;
    while (q-- > 0) {
      if (free > 0) free--;
      else cents += it.priceCents;
    }
  }
  return cents;
}

export default function PDV({ sizes, groups, produtos, fees, storeName, machines, endereco, cnpj, tel, cupomRodape, pricePerKgCents, onSold }: { sizes: Size[]; groups: ModifierGroup[]; produtos: Produto[]; fees: Fees; storeName: string; machines: CardMachine[]; endereco: string; cnpj: string; tel: string; cupomRodape: string; pricePerKgCents: number; onSold?: () => void }) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [tab, setTab] = useState<"peso" | "acai" | "produtos">(pricePerKgCents > 0 ? "peso" : "acai");
  const [weighing, setWeighing] = useState(false);
  const [customer, setCustomer] = useState<Cust | null>(null);
  const [pay, setPay] = useState(false);
  const [building, setBuilding] = useState<Size | null>(null);
  const [result, setResult] = useState<SaleResult | null>(null);
  const [query, setQuery] = useState("");
  const [discInput, setDiscInput] = useState("");
  const [discMode, setDiscMode] = useState<"brl" | "pct">("brl");
  const [helpOpen, setHelpOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const discRef = useRef<HTMLInputElement>(null);
  // qtd rápida: digita o número direto; clampa [1,999]
  const setQty = (key: string, v: string) => { const n = Math.max(1, Math.min(999, parseInt(v.replace(/\D/g, ""), 10) || 1)); setCart((prev) => prev.map((l) => (l.key === key ? { ...l, qty: n } : l))); };
  const setNote = (key: string, v: string) => setCart((prev) => prev.map((l) => (l.key === key ? { ...l, note: v } : l)));

  // monta o cupom a partir do resultado da venda (recebe `r` em vez de ler o state —
  // evita corrida com o setResult na hora de imprimir no fim da venda)
  function buildCupom(r: SaleResult): CupomData {
    return {
      loja: storeName,
      endereco, cnpj, tel,
      rodape: cupomRodape,
      display: r.display,
      dateLabel: nowLabel(),
      modeLabel: "Balcão",
      paymentLabel: PAY_LABEL[r.method],
      customerName: customer?.name,
      phone: customer?.phone,
      items: cart.map((l) => ({ qty: l.qty, name: l.label, note: l.note, totalCents: l.unitCents * l.qty })),
      totalCents: finalTotal,
      subtotalCents: discountCents > 0 ? total : undefined,
      discountCents: discountCents > 0 ? discountCents : undefined,
      receivedCents: r.receivedCents,
      changeCents: r.changeCents,
      pointsInfo: r.pointsInfo,
    };
  }
  // imprime o cupom (1 ou 2 vias, mesma política do Balcão — respeita print:duasvias)
  function printCupom(r: SaleResult) {
    void printVias((via) => ticketHtml({ ...buildCupom(r), origem: "balcao", via }));
  }

  const total = cart.reduce((s, l) => s + l.unitCents * l.qty, 0);
  const discRaw = parseFloat(discInput.replace(",", ".")) || 0;
  const discountCents = discMode === "pct" ? Math.round((total * Math.min(discRaw, 100)) / 100) : Math.min(Math.round(discRaw * 100), total);
  const finalTotal = Math.max(0, total - discountCents);

  function add(key: string, label: string, unitCents: number, group: string, stockId?: string) {
    setCart((prev) => {
      const f = prev.find((l) => l.key === key);
      if (f) return prev.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l));
      return [...prev, { key, label, unitCents, qty: 1, group, stockId }];
    });
  }
  // adiciona um açaí montado como linha própria (não agrupa com outros)
  function addBuilt(line: Omit<CartLine, "qty">) {
    setCart((prev) => [...prev, { ...line, qty: 1 }]);
  }
  const dec = (key: string) =>
    setCart((prev) => prev.flatMap((l) => (l.key === key ? (l.qty > 1 ? [{ ...l, qty: l.qty - 1 }] : []) : [l])));
  const removeLine = (key: string) => setCart((prev) => prev.filter((l) => l.key !== key));

  function reset() {
    setCart([]); setDiscInput("");
    setCustomer(null);
    setResult(null);
    setPay(false);
  }

  // atalhos de teclado (caixa em PC fixo) — inativos na tela de sucesso/modais
  usePdvHotkeys({
    onHelp: () => setHelpOpen((v) => !v),
    onSearch: () => { if (result) return; setTab("produtos"); setTimeout(() => searchRef.current?.focus(), 30); },
    onCharge: () => { if (!result && !pay && !building && !weighing && cart.length > 0) setPay(true); },
    onDiscount: () => { if (!result) { setTimeout(() => discRef.current?.focus(), 0); } },
    onClear: () => { if (!result) { setCart([]); setDiscInput(""); } },
    onEscape: () => setHelpOpen(false),
  });

  /* ---- tela de sucesso ---- */
  if (result) {
    return (
      <div className="mx-auto max-w-md py-6 text-center">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full brand-gradient text-white shadow-[var(--shadow-brand)]">
          <IconCheck width={36} height={36} />
        </div>
        <h2 className="text-2xl font-extrabold text-ink">Venda registrada!</h2>
        <p className="mt-1 text-[var(--text-muted)]">Comanda {result.display}</p>
        {result.changeCents > 0 && (
          <div className="mx-auto mt-6 max-w-xs rounded-2xl bg-bg-surface-2 p-4">
            <div className="text-sm font-semibold text-[var(--text-muted)]">Troco</div>
            <div className="text-3xl font-extrabold text-ink">{brl(result.changeCents)}</div>
          </div>
        )}
        {result.pointsAwarded > 0 && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#E8F6DD] px-4 py-2 text-sm font-bold text-lime">
            +{result.pointsAwarded} pontos pro cliente
          </div>
        )}
        {result.stockWarning && (
          <div className="mx-auto mt-3 max-w-xs rounded-xl bg-[#FEF3C7] px-4 py-2.5 text-sm font-semibold text-[#92400E]">
            ⚠ {result.stockWarning}
          </div>
        )}
        <button onClick={() => printCupom(result)} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-brand-600 py-3.5 font-bold text-brand-600">
          <IconPrinter width={20} height={20} /> Imprimir cupom
        </button>
        <button onClick={reset} className="mt-2 w-full rounded-2xl brand-gradient py-4 font-bold text-white shadow-[var(--shadow-brand)]">
          Nova venda
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-5 lg:h-full lg:min-h-0 lg:grid-cols-[1fr_360px]">
        {/* Catálogo — rola por dentro no desktop (não cresce a página) */}
        <div className="lg:min-h-0 lg:overflow-y-auto lg:pr-1">
          <div className="mb-4 inline-flex rounded-xl border border-line bg-bg-elevated p-1">
            {pricePerKgCents > 0 && <TabBtn active={tab === "peso"} onClick={() => setTab("peso")} Icon={IconScale} label="Por peso" />}
            <TabBtn active={tab === "acai"} onClick={() => setTab("acai")} Icon={IconBowl} label="Copo" />
            <TabBtn active={tab === "produtos"} onClick={() => setTab("produtos")} Icon={IconBox} label="Produtos" />
          </div>

          {tab === "peso" && (
            <div className="mb-4">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Por peso · R$ {(pricePerKgCents / 100).toFixed(2).replace(".", ",")}/kg</h3>
              <button onClick={() => setWeighing(true)} className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-brand-400 bg-[#EEF2FF] py-12 text-brand-600 transition hover:border-brand-600">
                <IconScale width={40} height={40} />
                <span className="text-lg font-extrabold">Pesar açaí</span>
                <span className="text-xs font-medium text-[var(--text-muted)]">digite os gramas — ou leia a balança</span>
              </button>
            </div>
          )}

          {tab === "acai" && (
            <Section title="Monte o açaí — escolha o tamanho">
              {sizes.map((s) => (
                <ProdBtn key={s.id} label={s.label} price={s.priceCents} sub="toque pra montar" onClick={() => setBuilding(s)} />
              ))}
            </Section>
          )}

          {tab === "produtos" && (
            <div>
              {produtos.length > 0 && (
                <div className="relative mb-3">
                  <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--text-faded)]" aria-hidden />
                  <input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} type="search" autoComplete="off" placeholder="Buscar produto pelo nome…" aria-label="Buscar produto" className="h-11 w-full rounded-lg border border-line bg-bg-elevated pl-10 pr-3 text-sm text-ink outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-400/40" />
                </div>
              )}
              <Section title="Produtos à venda">
                {produtos.length === 0 && <p className="text-sm text-[var(--text-muted)]">Cadastre produtos à venda no Estoque (com preço).</p>}
                {produtos.filter((p) => !query.trim() || norm(p.name).includes(norm(query.trim()))).map((p) => (
                  <ProdBtn
                    key={p.id}
                    label={p.name}
                    price={p.priceCents}
                    sub={`${p.qty} ${p.unit} em estoque`}
                    disabled={p.qty <= 0}
                    onClick={() => add(`prod-${p.id}`, p.name, p.priceCents, "Produto", p.id)}
                  />
                ))}
              </Section>
            </div>
          )}
        </div>

        {/* Comanda — preenche a altura no desktop; itens rolam por dentro */}
        <div className="lg:min-h-0">
          <div className="card flex max-h-[calc(100vh-7rem)] flex-col p-4 lg:h-full lg:max-h-full">
            <div className="mb-3 flex items-center gap-2">
              <IconCart width={18} height={18} className="text-brand-600" />
              <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Comanda</h2>
              {cart.length > 0 && (
                <button onClick={() => { setCart([]); setDiscInput(""); }} className="ml-auto text-xs font-semibold text-[var(--text-faded)] hover:text-[var(--red-no)]">
                  limpar
                </button>
              )}
            </div>

            {/* Fidelidade no TOPO da comanda — sempre visível, sem precisar rolar (achado Eduardo no caixa) */}
            <div className="mb-3 shrink-0 border-b border-line pb-3">
              <CustomerBox customer={customer} onChange={setCustomer} />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {cart.length === 0 ? (
                <p className="py-8 text-center text-sm text-[var(--text-faded)]">Toque nos itens pra montar a comanda.</p>
              ) : (
                <div className="divide-y divide-[var(--line)]">
                  {cart.map((l) => (
                    <div key={l.key} className="flex items-center gap-2 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-ink">{l.label}</div>
                        <input value={l.note ?? ""} onChange={(e) => setNote(l.key, e.target.value)} placeholder="Obs…" aria-label="Observação do item" className="mt-0.5 w-full rounded border border-line bg-bg-base px-1.5 py-0.5 text-[11px] text-ink outline-none focus:border-brand-600" />
                        <div className="text-xs text-[var(--text-muted)]">{brl(l.unitCents)}</div>
                      </div>
                      <button onClick={() => dec(l.key)} className="grid h-7 w-7 place-items-center rounded-md border border-line text-ink">
                        <IconMinus width={13} height={13} />
                      </button>
                      <input type="text" inputMode="numeric" value={l.qty} onChange={(e) => setQty(l.key, e.target.value)} aria-label="Quantidade" className="w-9 rounded-md border border-line bg-bg-base text-center text-sm font-bold text-ink outline-none focus:border-brand-600" />
                      <button onClick={() => add(l.key, l.label, l.unitCents, l.group, l.stockId)} className="grid h-7 w-7 place-items-center rounded-md brand-gradient text-white">
                        <IconPlus width={13} height={13} />
                      </button>
                      <span className="w-16 text-right text-sm font-bold text-ink">{brl(l.unitCents * l.qty)}</span>
                      <button onClick={() => removeLine(l.key)} className="text-[var(--text-faded)] hover:text-[var(--red-no)]">
                        <IconTrash width={15} height={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-3 border-t border-line pt-3">
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
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-[var(--text-muted)]">Total</span>
                <span className="text-2xl font-extrabold tabular-nums text-ink">{brl(finalTotal)}</span>
              </div>
              <div className="mb-3 flex items-center gap-1.5">
                <span className="text-xs font-semibold text-[var(--text-muted)]">Desconto</span>
                <input ref={discRef} value={discInput} onChange={(e) => setDiscInput(e.target.value)} inputMode="decimal" placeholder="0" aria-label="Desconto na venda" className="ml-auto w-16 rounded-lg border border-line bg-bg-base px-2 py-1.5 text-right text-sm tabular-nums text-ink outline-none focus:border-brand-600" />
                <button type="button" onClick={() => setDiscMode("brl")} className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold transition ${discMode === "brl" ? "border-brand-600 text-brand-600" : "border-line text-[var(--text-muted)]"}`}>R$</button>
                <button type="button" onClick={() => setDiscMode("pct")} className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold transition ${discMode === "pct" ? "border-brand-600 text-brand-600" : "border-line text-[var(--text-muted)]"}`}>%</button>
              </div>
              <button
                onClick={() => setPay(true)}
                disabled={cart.length === 0}
                className="w-full rounded-xl brand-gradient py-3.5 font-bold text-white shadow-[var(--shadow-brand)] disabled:bg-none disabled:bg-bg-surface-2 disabled:text-[var(--text-faded)] disabled:shadow-none"
              >
                Cobrar {brl(finalTotal)}
              </button>
              <ShortcutsHint onClick={() => setHelpOpen(true)} />
            </div>
          </div>
        </div>
      </div>

      {helpOpen && <ShortcutsHelp onClose={() => setHelpOpen(false)} />}

      {pay && (
        <PayModal
          total={finalTotal}
          discountCents={discountCents}
          fees={fees}
          machines={machines}
          onClose={() => setPay(false)}
          onDone={(r) => {
            setPay(false);
            setResult(r);
            onSold?.();
            // auto-impressão POR-MÁQUINA: mesma política do Balcão (respeita o toggle autoprint:venda)
            if (typeof window !== "undefined" && localStorage.getItem("autoprint:venda") !== "0") printCupom(r);
            // abre a gaveta na venda em dinheiro (se a máquina tiver gaveta ligada)
            if (typeof window !== "undefined" && localStorage.getItem("drawer:auto") === "1" && r.method === "dinheiro") void openDrawer("caixa");
          }}
          cart={cart}
          phone={customer?.phone || ""}
        />
      )}

      {building && (
        <MontarModal
          size={building}
          groups={groups}
          onClose={() => setBuilding(null)}
          onAdd={(line) => {
            addBuilt(line);
            setBuilding(null);
          }}
        />
      )}
      {weighing && (
        <WeightModal
          product={{ name: "Açaí por peso", price_cents: pricePerKgCents, tare_grams: 0 }}
          onClose={() => setWeighing(false)}
          onConfirm={(grams) => {
            // baixa de estoque do açaí pesado — polpa proporcional (igual à mesa). Antes o peso do
            // balcão NÃO baixava, então o estoque/kg-vendido saíam furados. Product-wide (WEIGHT_BASE).
            addBuilt({ key: `peso-${++pesoSeq}`, label: `Açaí ${grams}g`, unitCents: Math.round((grams / 1000) * pricePerKgCents), group: "acai", consumes: [{ stockId: WEIGHT_BASE_STOCK_ID, qty: +(grams / 1000).toFixed(3) }] });
            setWeighing(false);
          }}
        />
      )}
    </>
  );
}

function MontarModal({ size, groups, onClose, onAdd }: { size: Size; groups: ModifierGroup[]; onClose: () => void; onAdd: (l: Omit<CartLine, "qty">) => void }) {
  const [qty, setQty] = useState<Qty>({});
  const extras = groups.reduce((s, g) => s + groupCost(g, qty), 0);
  const totalCents = size.priceCents + extras;

  function step(g: ModifierGroup, id: string, dir: 1 | -1) {
    setQty((prev) => {
      const cur = prev[id] || 0;
      const next = Math.max(0, cur + dir);
      if (dir === 1 && g.max > 0 && groupUnits(g, prev) >= g.max) return prev;
      return { ...prev, [id]: next };
    });
  }

  function confirm() {
    const parts: string[] = [];
    // ficha técnica agregada: insumos do tamanho + dos adicionais escolhidos
    const cons: Record<string, number> = {};
    for (const ing of size.recipe || []) cons[ing.stockId] = (cons[ing.stockId] || 0) + ing.qty;
    for (const g of groups) for (const it of g.items) {
      const q = qty[it.id] || 0;
      if (!q) continue;
      parts.push(q > 1 ? `${q}x ${it.name}` : it.name);
      for (const ing of it.recipe || []) cons[ing.stockId] = (cons[ing.stockId] || 0) + ing.qty * q;
    }
    onAdd({
      key: "acai-" + Date.now() + Math.random().toString(36).slice(2, 6),
      label: size.label,
      note: parts.join(", ") || undefined,
      unitCents: totalCents,
      group: "Açaí",
      consumes: Object.entries(cons).map(([stockId, qty]) => ({ stockId, qty })),
    });
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[90vh] max-w-lg flex-col rounded-t-3xl bg-bg-elevated shadow-[var(--shadow-pop)] sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:max-h-[85vh] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl">
        <div className="border-b border-line p-5">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-line sm:hidden" />
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-ink">Montar {size.label}</h2>
            <span className="text-sm font-bold text-brand-600">base {brl(size.priceCents)}</span>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {groups.map((g) => {
            const units = groupUnits(g, qty);
            const tag = g.paid ? "pagos" : `${Math.min(units, g.freeUpTo)}/${g.freeUpTo} grátis`;
            return (
              <div key={g.id} className="mb-5">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">{g.title}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${g.paid ? "bg-[#FBF1DC] text-gold" : "bg-[#E8F6DD] text-lime"}`}>{tag}</span>
                </div>
                <div className="space-y-1.5">
                  {g.items.map((it) => {
                    const q = qty[it.id] || 0;
                    return (
                      <div key={it.id} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-ink">{it.name}</div>
                          <div className="text-xs text-[var(--text-muted)]">{g.paid ? `+ ${brl(it.priceCents)}` : `grátis ou +${brl(it.priceCents)}`}</div>
                        </div>
                        <button onClick={() => step(g, it.id, -1)} disabled={q === 0} className="grid h-8 w-8 place-items-center rounded-lg border border-line text-ink disabled:opacity-30">
                          <IconMinus width={14} height={14} />
                        </button>
                        <span className="w-5 text-center text-sm font-bold text-ink">{q}</span>
                        <button onClick={() => step(g, it.id, 1)} className="grid h-8 w-8 place-items-center rounded-lg brand-gradient text-white">
                          <IconPlus width={14} height={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-line p-5">
          <button onClick={confirm} className="flex w-full items-center justify-between rounded-2xl brand-gradient px-5 py-3.5 font-bold text-white shadow-[var(--shadow-brand)]">
            <span>Adicionar à comanda</span>
            <span>{brl(totalCents)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function CustomerBox({ customer, onChange }: { customer: Cust | null; onChange: (c: Cust | null) => void }) {
  const [phone, setPhone] = useState("");
  const [notfound, setNotfound] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [name, setName] = useState("");
  const [bday, setBday] = useState("");
  const [busy, setBusy] = useState(false);
  // fidelidade: prêmios resgatáveis do cliente identificado (mesmo fluxo do Balcão)
  const [rewards, setRewards] = useState<{ label: string; points: number }[]>([]);
  const [loyBusy, setLoyBusy] = useState(false);
  const [loyMsg, setLoyMsg] = useState("");

  async function resgatar(rw: { label: string; points: number }) {
    if (loyBusy || !customer) return;
    setLoyBusy(true); setLoyMsg("");
    try {
      const r = await fetch("/api/pontos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: customer.phone, rewardPoints: rw.points }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Falha no resgate.");
      onChange({ ...customer, points: d.customer?.points ?? customer.points });
      setLoyMsg(`Resgatado: ${rw.label} ✓ (entregue ao cliente)`);
    } catch (e) { setLoyMsg(e instanceof Error ? e.message : "Falha no resgate."); }
    finally { setLoyBusy(false); }
  }

  // cliente identificado
  if (customer) {
    const redeemable = rewards.filter((rw) => customer.points >= rw.points);
    return (
      <div className="rounded-xl border border-lime/40 bg-[#F3FAEC] p-3">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 truncate font-bold text-ink">
              <IconStar width={14} height={14} className="text-lime" /> {customer.name}
            </div>
            <div className="text-xs font-semibold text-lime">{customer.points} pontos · vai pontuar nesta venda</div>
          </div>
          <button onClick={() => { onChange(null); setRewards([]); setLoyMsg(""); }} className="shrink-0 text-xs font-bold text-[var(--text-muted)] hover:text-[var(--red-no)]">
            trocar
          </button>
        </div>
        {redeemable.length > 0 && (
          <div className="mt-2 space-y-1 border-t border-lime/30 pt-2">
            <p className="text-[11px] font-bold uppercase text-[var(--text-muted)]">Resgatar prêmio</p>
            {redeemable.map((rw) => (
              <button key={rw.points} onClick={() => resgatar(rw)} disabled={loyBusy} className="flex w-full items-center justify-between rounded-lg border border-brand-400 bg-white px-2.5 py-1.5 text-xs font-bold text-brand-600 disabled:opacity-40">
                <span className="truncate">{rw.label}</span><span className="shrink-0">−{rw.points} pts</span>
              </button>
            ))}
          </div>
        )}
        {loyMsg && <p className="mt-2 rounded-lg bg-[#E8F6DD] px-2.5 py-1.5 text-[11px] font-semibold text-lime">{loyMsg}</p>}
      </div>
    );
  }

  async function buscar() {
    if (!phone.trim()) return;
    setBusy(true);
    setNotfound(false);
    // /api/pontos devolve cliente + prêmios da loja (saldo já é o VÁLIDO, com expiração)
    const d = await fetch(`/api/pontos?phone=${encodeURIComponent(phone)}`, { cache: "no-store" }).then((r) => r.json());
    setBusy(false);
    setRewards(Array.isArray(d.rewards) ? d.rewards : []);
    if (d.customer) onChange({ phone: d.customer.phone, name: d.customer.name, points: d.customer.points });
    else setNotfound(true);
  }

  async function cadastrar() {
    setBusy(true);
    const d = await fetch("/api/clientes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, name, birthday: bday || undefined }),
    }).then((r) => r.json());
    setBusy(false);
    if (d.customer) onChange({ phone: d.customer.phone, name: d.customer.name, points: d.customer.points });
  }

  // formulário de cadastro rápido
  if (registering) {
    return (
      <div className="space-y-2 rounded-xl border border-line bg-bg-surface-2 p-3">
        <div className="text-xs font-bold text-ink">Cadastrar cliente — começa a pontuar já</div>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="Telefone" className="w-full rounded-lg border border-line bg-bg-base px-3 py-2 text-sm outline-none focus:border-brand-600" />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" className="w-full rounded-lg border border-line bg-bg-base px-3 py-2 text-sm outline-none focus:border-brand-600" />
        <div>
          <label className="text-[11px] font-semibold text-[var(--text-muted)]">Nascimento (cupom de aniversário)</label>
          <input type="date" value={bday} onChange={(e) => setBday(e.target.value)} className="mt-0.5 w-full rounded-lg border border-line bg-bg-base px-3 py-2 text-sm outline-none focus:border-brand-600" />
        </div>
        <div className="flex gap-2">
          <button onClick={cadastrar} disabled={busy || !phone.trim() || !name.trim()} className="flex-1 rounded-lg brand-gradient py-2 text-sm font-bold text-white disabled:opacity-60">
            {busy ? "..." : "Cadastrar e pontuar"}
          </button>
          <button onClick={() => setRegistering(false)} className="rounded-lg border border-line px-3 text-sm font-semibold text-[var(--text-muted)]">
            cancelar
          </button>
        </div>
      </div>
    );
  }

  // busca por telefone
  return (
    <div className="rounded-xl border border-line p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-ink">
        <IconStar width={13} height={13} className="text-brand-600" /> O cliente pontua?
      </div>
      <div className="flex gap-2">
        <input
          value={phone}
          onChange={(e) => { setPhone(e.target.value); setNotfound(false); }}
          onKeyDown={(e) => e.key === "Enter" && buscar()}
          inputMode="tel"
          placeholder="Telefone do cliente"
          className="min-w-0 flex-1 rounded-lg border border-line bg-bg-base px-3 py-2 text-sm outline-none focus:border-brand-600"
        />
        <button onClick={buscar} disabled={busy} className="shrink-0 rounded-lg bg-bg-surface-2 px-3 text-sm font-bold text-brand-600 disabled:opacity-60">
          {busy ? "..." : "Buscar"}
        </button>
      </div>
      {notfound && (
        <div className="mt-2 rounded-lg bg-[#FBF1DC] px-2.5 py-1.5 text-xs font-semibold text-gold">
          Telefone não cadastrado — toque em &quot;Cadastrar novo&quot; abaixo.
        </div>
      )}
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-[var(--text-faded)]">Pode vender sem identificar.</span>
        <button
          onClick={() => { setName(""); setBday(""); setRegistering(true); }}
          className="inline-flex items-center gap-1 rounded-lg brand-gradient px-3 py-1.5 text-xs font-bold text-white"
        >
          <IconPlus width={13} height={13} /> Cadastrar novo
        </button>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, Icon, label }: { active: boolean; onClick: () => void; Icon: (p: { width?: number; height?: number }) => React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition ${active ? "brand-gradient text-white" : "text-ink-2"}`}
    >
      <Icon width={16} height={16} /> {label}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">{title}</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{children}</div>
    </div>
  );
}

function ProdBtn({ label, price, sub, disabled, onClick }: { label: string; price: number; sub?: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-start rounded-xl border border-line bg-bg-elevated p-3 text-left transition hover:border-brand-600 hover:shadow-[var(--shadow-card)] disabled:opacity-40 disabled:hover:border-line disabled:hover:shadow-none"
    >
      <span className="text-sm font-bold text-ink">{label}</span>
      <span className="mt-0.5 text-sm font-extrabold text-brand-600">{brl(price)}</span>
      {sub && <span className="mt-0.5 text-[11px] font-semibold text-[var(--text-faded)]">{sub}</span>}
    </button>
  );
}

function PayModal({
  total,
  discountCents,
  cart,
  phone,
  onClose,
  onDone,
  fees,
  machines,
}: {
  total: number;
  discountCents: number;
  cart: CartLine[];
  phone: string;
  fees: Fees;
  machines: CardMachine[];
  onClose: () => void;
  onDone: (r: { display: string; changeCents: number; pointsAwarded: number; pointsInfo?: string; method: string; receivedCents?: number; stockWarning?: string }) => void;
}) {
  const [method, setMethod] = useState<PayMethod>("dinheiro");
  const [received, setReceived] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const activeMachines = machines.filter((m) => m.active);
  const [machineId, setMachineId] = useState<string>(activeMachines[0]?.id ?? "");
  const [parcelas, setParcelas] = useState(1);
  const [splitMode, setSplitMode] = useState(false);
  const [splitAmt, setSplitAmt] = useState<Record<string, string>>({ dinheiro: "", pix: "", debito: "", credito: "" });
  const toCents2 = (s: string) => Math.round((parseFloat((s || "").replace(",", ".")) || 0) * 100);
  const splitCents = { dinheiro: toCents2(splitAmt.dinheiro), pix: toCents2(splitAmt.pix), debito: toCents2(splitAmt.debito), credito: toCents2(splitAmt.credito) };
  const splitSum = splitCents.dinheiro + splitCents.pix + splitCents.debito + splitCents.credito;
  const splitRemaining = total - splitSum;
  const splitCardCents = splitCents.debito + splitCents.credito;
  const splitPays = (["dinheiro", "pix", "debito", "credito"] as const).map((k) => ({ method: k, amountCents: splitCents[k] })).filter((p) => p.amountCents > 0);
  const splitDominant = splitPays.slice().sort((a, b) => b.amountCents - a.amountCents)[0]?.method ?? "dinheiro";
  const recCents = Math.round((parseFloat(received) || 0) * 100);
  const change = method === "dinheiro" ? Math.max(0, recCents - total) : 0;
  const selMachine = activeMachines.find((m) => m.id === machineId);
  const useMachine = (method === "debito" || method === "credito") && !!selMachine;
  const feePct = useMachine
    ? method === "debito" ? selMachine!.debito : parcelas > 1 ? selMachine!.creditoParcelado : selMachine!.credito
    : fees[method] || 0;
  const feeCents = Math.round((total * feePct) / 100);
  const netCents = total - feeCents;
  // Esc fecha o modal de pagamento (achado CIC)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // baixa de estoque agregada: produtos de revenda (1 un) + ficha técnica dos açaís
  function buildConsumes() {
    const acc: Record<string, number> = {};
    for (const l of cart) {
      if (l.stockId) acc[l.stockId] = (acc[l.stockId] || 0) + l.qty;
      for (const ing of l.consumes || []) acc[ing.stockId] = (acc[ing.stockId] || 0) + ing.qty * l.qty;
    }
    return Object.entries(acc).map(([stockId, qty]) => ({ stockId, qty: +qty.toFixed(3) }));
  }

  async function finalize() {
    setSending(true); setErr("");
    try {
      const res = await fetch("/api/vendas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((l) => ({ name: l.note ? `${l.label} — ${l.note}` : l.label, qty: l.qty, unitCents: l.unitCents, group: l.group, stockId: l.stockId })),
          consumes: buildConsumes(),
          paymentMethod: splitMode ? splitDominant : method,
          payments: splitMode ? splitPays : undefined,
          machineId: ((splitMode ? splitCardCents > 0 : method === "debito" || method === "credito") && machineId) ? machineId : undefined,
          parcelas: (splitMode ? splitCents.credito > 0 : method === "credito") ? parcelas : 1,
          amountPaidCents: !splitMode && method === "dinheiro" ? recCents : undefined,
          customerPhone: phone.trim() || undefined,
          discountCents: discountCents || undefined,
        }),
      });
      // corpo pode vir vazio (500 não-tratado do Next) → parse tolerante, nunca deixa o erro invisível
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErr(data?.error || `Erro ${res.status} — a venda não foi registrada. Tente de novo.`);
        return;
      }
      onDone({ display: data.order.display, changeCents: data.changeCents, pointsAwarded: data.pointsAwarded, pointsInfo: data.pointsInfo, method: splitMode ? splitDominant : method, receivedCents: !splitMode && method === "dinheiro" ? recCents : undefined, stockWarning: data.stockWarning });
    } catch {
      setErr("Sem conexão com o servidor. A venda não foi registrada — confira a internet e tente de novo.");
    } finally {
      setSending(false);
    }
  }

  const methods = [
    { k: "dinheiro", label: "Dinheiro" },
    { k: "pix", label: "Pix" },
    { k: "debito", label: "Débito" },
    { k: "credito", label: "Crédito" },
  ] as const;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-md animate-pop rounded-t-3xl bg-bg-elevated p-5 shadow-[var(--shadow-pop)] sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-line sm:hidden" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-ink">Pagamento</h2>
          <span className="text-2xl font-extrabold text-brand-600">{brl(total)}</span>
        </div>

        <button type="button" onClick={() => setSplitMode((v) => !v)} className={`mb-3 w-full rounded-xl border-2 py-2 text-sm font-bold transition ${splitMode ? "border-brand-600 text-brand-600" : "border-dashed border-line text-[var(--text-muted)]"}`}>
          {splitMode ? "Dividindo em várias formas" : "Dividir pagamento (2+ formas)"}
        </button>

        {!splitMode && (<>
        <div className="grid grid-cols-2 gap-2">
          {methods.map((m) => (
            <button
              key={m.k}
              onClick={() => setMethod(m.k)}
              className={`rounded-xl border-2 py-3 text-sm font-bold transition ${method === m.k ? "border-brand-600 bg-bg-surface-2 text-brand-600" : "border-line text-ink-2"}`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {(method === "debito" || method === "credito") && activeMachines.length > 0 && (
          <div className="mt-3 space-y-2">
            {activeMachines.length > 1 && (
              <select value={machineId} onChange={(e) => setMachineId(e.target.value)} className="w-full rounded-xl border border-line bg-bg-base px-3 py-2.5 text-sm font-semibold text-ink outline-none">
                {activeMachines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            )}
            {method === "credito" && (
              <select value={parcelas} onChange={(e) => setParcelas(Number(e.target.value))} className="w-full rounded-xl border border-line bg-bg-base px-3 py-2.5 text-sm font-semibold text-ink outline-none">
                {Array.from({ length: selMachine?.maxParcelas ?? 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n === 1 ? "À vista (1x)" : `${n}x parcelado`}</option>)}
              </select>
            )}
          </div>
        )}

        {feePct > 0 && (
          <div className="mt-3 flex items-center justify-between rounded-xl bg-[#FBF1DC] px-4 py-2.5">
            <span className="text-sm font-semibold text-gold">Taxa maquininha {feePct}%</span>
            <span className="text-sm font-bold text-ink">−{brl(feeCents)} · líquido {brl(netCents)}</span>
          </div>
        )}

        {method === "dinheiro" && (
          <div className="mt-4">
            <label className="text-xs font-semibold text-[var(--text-muted)]">Valor recebido</label>
            <div className="mt-1 flex items-center rounded-xl border border-line bg-bg-base px-3">
              <span className="text-sm font-semibold text-[var(--text-muted)]">R$</span>
              <input
                type="number"
                min={0}
                step="0.5"
                value={received}
                onChange={(e) => setReceived(e.target.value)}
                placeholder="0,00"
                autoFocus
                className="w-full bg-transparent px-2 py-3 text-lg font-bold text-ink outline-none"
              />
            </div>
            <div className="mt-2 flex items-center justify-between rounded-xl bg-bg-surface-2 px-4 py-2.5">
              <span className="text-sm font-semibold text-[var(--text-muted)]">Troco</span>
              <span className="text-xl font-extrabold text-ink">{brl(change)}</span>
            </div>
          </div>
        )}
        </>)}

        {splitMode && (
          <div className="space-y-2">
            {methods.map((m) => (
              <div key={m.k} className="flex items-center gap-2">
                <span className="w-20 shrink-0 text-sm font-semibold text-ink-2">{m.label}</span>
                <div className="flex flex-1 items-center rounded-lg border border-line bg-bg-base px-2.5">
                  <span className="text-xs text-[var(--text-muted)]">R$</span>
                  <input inputMode="decimal" value={splitAmt[m.k]} onChange={(e) => setSplitAmt((s) => ({ ...s, [m.k]: e.target.value }))} placeholder="0,00" className="w-full bg-transparent px-2 py-2 text-right text-sm font-bold text-ink outline-none" />
                </div>
              </div>
            ))}
            {splitCardCents > 0 && activeMachines.length > 1 && (
              <select value={machineId} onChange={(e) => setMachineId(e.target.value)} className="w-full rounded-xl border border-line bg-bg-base px-3 py-2.5 text-sm font-semibold text-ink outline-none">
                {activeMachines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            )}
            <div className={`flex items-center justify-between rounded-xl px-4 py-2.5 ${splitRemaining === 0 ? "bg-[#E8F6DD]" : "bg-bg-surface-2"}`}>
              <span className={`text-sm font-semibold ${splitRemaining === 0 ? "text-lime" : "text-[var(--text-muted)]"}`}>{splitRemaining > 0 ? "Falta" : splitRemaining < 0 ? "Passou do total" : "Fechou"}</span>
              <span className="text-lg font-extrabold tabular-nums text-ink">{brl(Math.abs(splitRemaining))}</span>
            </div>
          </div>
        )}

        {err && (
          <p className="mt-4 rounded-xl border border-[var(--red-no)] bg-[#FDECEC] px-4 py-2.5 text-sm font-semibold text-[var(--red-no)]">{err}</p>
        )}

        <button
          onClick={finalize}
          disabled={sending || (splitMode ? splitRemaining !== 0 : (method === "dinheiro" && recCents < total))}
          className="mt-5 w-full rounded-2xl brand-gradient py-4 font-bold text-white shadow-[var(--shadow-brand)] disabled:opacity-60"
        >
          {sending ? "Registrando..." : "Finalizar venda"}
        </button>
      </div>
    </div>
  );
}
