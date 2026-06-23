"use client";

import { useState } from "react";
import { brl } from "@/lib/format";
import type { CardMachine } from "@/lib/settings-store";
import { type Size, type ModifierGroup, type Ingredient } from "@/lib/menu";
import { IconCart, IconPlus, IconMinus, IconCheck, IconTrash, IconBowl, IconBox, IconStar, IconPrinter } from "@/components/Icons";
import CupomPrinter, { type CupomData } from "@/components/admin/CupomPrinter";

const PAY_LABEL: Record<string, string> = { dinheiro: "Dinheiro", pix: "Pix", debito: "Cartão débito", credito: "Cartão crédito" };
const nowLabel = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

type Produto = { id: string; name: string; priceCents: number; qty: number; unit: string };
type CartLine = { key: string; label: string; note?: string; unitCents: number; qty: number; group: string; stockId?: string; consumes?: Ingredient[] };
type PayMethod = "dinheiro" | "pix" | "debito" | "credito";
export type Fees = Record<PayMethod, number>;
type Qty = Record<string, number>;
type Cust = { phone: string; name: string; points: number };

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

export default function PDV({ sizes, groups, produtos, fees, storeName, machines, onSold }: { sizes: Size[]; groups: ModifierGroup[]; produtos: Produto[]; fees: Fees; storeName: string; machines: CardMachine[]; onSold?: () => void }) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [tab, setTab] = useState<"acai" | "produtos">("acai");
  const [customer, setCustomer] = useState<Cust | null>(null);
  const [pay, setPay] = useState(false);
  const [building, setBuilding] = useState<Size | null>(null);
  const [result, setResult] = useState<null | { display: string; changeCents: number; pointsAwarded: number; method: string; receivedCents?: number }>(null);
  const [cupomOpen, setCupomOpen] = useState(false);

  function montaCupom(): CupomData {
    return {
      loja: storeName,
      display: result!.display,
      dateLabel: nowLabel(),
      modeLabel: "Balcão",
      paymentLabel: PAY_LABEL[result!.method],
      customerName: customer?.name,
      phone: customer?.phone,
      items: cart.map((l) => ({ qty: l.qty, name: l.label, note: l.note, totalCents: l.unitCents * l.qty })),
      totalCents: total,
      receivedCents: result!.receivedCents,
      changeCents: result!.changeCents,
      pointsInfo: result!.pointsAwarded > 0 ? `Pontos ganhos: +${result!.pointsAwarded}` : undefined,
    };
  }

  const total = cart.reduce((s, l) => s + l.unitCents * l.qty, 0);

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
    setCart([]);
    setCustomer(null);
    setResult(null);
    setPay(false);
    setCupomOpen(false);
  }

  /* ---- tela de sucesso ---- */
  if (result) {
    return (
      <div className="mx-auto max-w-md py-12 text-center">
        <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full brand-gradient text-white shadow-[var(--shadow-brand)]">
          <IconCheck width={42} height={42} />
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
        <button onClick={() => setCupomOpen(true)} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-brand-600 py-3.5 font-bold text-brand-600">
          <IconPrinter width={20} height={20} /> Imprimir cupom
        </button>
        <button onClick={reset} className="mt-2 w-full rounded-2xl brand-gradient py-4 font-bold text-white shadow-[var(--shadow-brand)]">
          Nova venda
        </button>

        {cupomOpen && <CupomPrinter data={montaCupom()} onClose={() => setCupomOpen(false)} />}
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* Catálogo */}
        <div>
          <div className="mb-4 inline-flex rounded-xl border border-line bg-bg-elevated p-1">
            <TabBtn active={tab === "acai"} onClick={() => setTab("acai")} Icon={IconBowl} label="Açaí" />
            <TabBtn active={tab === "produtos"} onClick={() => setTab("produtos")} Icon={IconBox} label="Produtos" />
          </div>

          {tab === "acai" && (
            <Section title="Monte o açaí — escolha o tamanho">
              {sizes.map((s) => (
                <ProdBtn key={s.id} label={s.label} price={s.priceCents} sub="toque pra montar" onClick={() => setBuilding(s)} />
              ))}
            </Section>
          )}

          {tab === "produtos" && (
            <Section title="Produtos à venda">
              {produtos.length === 0 && <p className="text-sm text-[var(--text-muted)]">Cadastre produtos à venda no Estoque (com preço).</p>}
              {produtos.map((p) => (
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
          )}
        </div>

        {/* Comanda */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <div className="card flex max-h-[calc(100vh-7rem)] flex-col p-4">
            <div className="mb-3 flex items-center gap-2">
              <IconCart width={18} height={18} className="text-brand-600" />
              <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">Comanda</h2>
              {cart.length > 0 && (
                <button onClick={() => setCart([])} className="ml-auto text-xs font-semibold text-[var(--text-faded)] hover:text-[var(--red-no)]">
                  limpar
                </button>
              )}
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
                        {l.note && <div className="truncate text-[11px] text-[var(--text-muted)]">{l.note}</div>}
                        <div className="text-xs text-[var(--text-muted)]">{brl(l.unitCents)}</div>
                      </div>
                      <button onClick={() => dec(l.key)} className="grid h-7 w-7 place-items-center rounded-md border border-line text-ink">
                        <IconMinus width={13} height={13} />
                      </button>
                      <span className="w-5 text-center text-sm font-bold text-ink">{l.qty}</span>
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
              <div className="mb-3">
                <CustomerBox customer={customer} onChange={setCustomer} />
              </div>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-[var(--text-muted)]">Total</span>
                <span className="text-2xl font-extrabold text-ink">{brl(total)}</span>
              </div>
              <button
                onClick={() => setPay(true)}
                disabled={cart.length === 0}
                className="w-full rounded-xl brand-gradient py-3.5 font-bold text-white shadow-[var(--shadow-brand)] disabled:bg-none disabled:bg-bg-surface-2 disabled:text-[var(--text-faded)] disabled:shadow-none"
              >
                Cobrar {brl(total)}
              </button>
            </div>
          </div>
        </div>
      </div>

      {pay && (
        <PayModal
          total={total}
          fees={fees}
          machines={machines}
          onClose={() => setPay(false)}
          onDone={(r) => {
            setPay(false);
            setResult(r);
            onSold?.();
            setCupomOpen(true); // imprime o cupom automaticamente
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

  // cliente identificado
  if (customer) {
    return (
      <div className="rounded-xl border border-lime/40 bg-[#F3FAEC] p-3">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 truncate font-bold text-ink">
              <IconStar width={14} height={14} className="text-lime" /> {customer.name}
            </div>
            <div className="text-xs font-semibold text-lime">{customer.points} pontos · vai pontuar nesta venda</div>
          </div>
          <button onClick={() => onChange(null)} className="shrink-0 text-xs font-bold text-[var(--text-muted)] hover:text-[var(--red-no)]">
            trocar
          </button>
        </div>
      </div>
    );
  }

  async function buscar() {
    if (!phone.trim()) return;
    setBusy(true);
    setNotfound(false);
    const d = await fetch(`/api/clientes?phone=${encodeURIComponent(phone)}`, { cache: "no-store" }).then((r) => r.json());
    setBusy(false);
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
          <button onClick={cadastrar} disabled={busy || !phone.trim()} className="flex-1 rounded-lg brand-gradient py-2 text-sm font-bold text-white disabled:opacity-60">
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
  cart,
  phone,
  onClose,
  onDone,
  fees,
  machines,
}: {
  total: number;
  cart: CartLine[];
  phone: string;
  fees: Fees;
  machines: CardMachine[];
  onClose: () => void;
  onDone: (r: { display: string; changeCents: number; pointsAwarded: number; method: string; receivedCents?: number }) => void;
}) {
  const [method, setMethod] = useState<PayMethod>("dinheiro");
  const [received, setReceived] = useState("");
  const [sending, setSending] = useState(false);
  const activeMachines = machines.filter((m) => m.active);
  const [machineId, setMachineId] = useState<string>(activeMachines[0]?.id ?? "");
  const [parcelas, setParcelas] = useState(1);
  const recCents = Math.round((parseFloat(received) || 0) * 100);
  const change = method === "dinheiro" ? Math.max(0, recCents - total) : 0;
  const selMachine = activeMachines.find((m) => m.id === machineId);
  const useMachine = (method === "debito" || method === "credito") && !!selMachine;
  const feePct = useMachine
    ? method === "debito" ? selMachine!.debito : parcelas > 1 ? selMachine!.creditoParcelado : selMachine!.credito
    : fees[method] || 0;
  const feeCents = Math.round((total * feePct) / 100);
  const netCents = total - feeCents;

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
    setSending(true);
    try {
      const res = await fetch("/api/vendas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((l) => ({ name: l.note ? `${l.label} — ${l.note}` : l.label, qty: l.qty, unitCents: l.unitCents, group: l.group, stockId: l.stockId })),
          consumes: buildConsumes(),
          paymentMethod: method,
          machineId: (method === "debito" || method === "credito") && machineId ? machineId : undefined,
          parcelas: method === "credito" ? parcelas : 1,
          amountPaidCents: method === "dinheiro" ? recCents : undefined,
          customerPhone: phone.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) onDone({ display: data.order.display, changeCents: data.changeCents, pointsAwarded: data.pointsAwarded, method, receivedCents: method === "dinheiro" ? recCents : undefined });
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

        <button
          onClick={finalize}
          disabled={sending || (method === "dinheiro" && recCents < total)}
          className="mt-5 w-full rounded-2xl brand-gradient py-4 font-bold text-white shadow-[var(--shadow-brand)] disabled:opacity-60"
        >
          {sending ? "Registrando..." : "Finalizar venda"}
        </button>
      </div>
    </div>
  );
}
