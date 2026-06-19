"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/admin/ui";
import {
  IconReceipt,
  IconBag,
  IconCheck,
  IconPlus,
  IconMinus,
  IconArrowRight,
  IconClock,
} from "@/components/Icons";
import { brl } from "@/lib/format";

// ---- tipos do contrato das APIs ----
type SizeOption = { id: string; label: string; priceCents: number; ml: number };

type TableCell = {
  number: number;
  area: string | null;
  tabId: number | null;
  openTotalCents: number;
  openedAt: string | null;
};

type ComandaItem = { name: string; sizeLabel?: string | null; qty: number; unitPriceCents: number };
type ComandaOrder = { items: ComandaItem[] };
type ComandaPayment = { method: string; amountCents: number };
type Comanda = {
  tab: { id: number };
  orders: ComandaOrder[];
  payments: ComandaPayment[];
  totalCents: number;
  paidCents: number;
};

type CartLine = { name: string; sizeLabel?: string; qty: number; unitPriceCents: number; consumes?: unknown };

const METHODS: { key: string; label: string }[] = [
  { key: "dinheiro", label: "Dinheiro" },
  { key: "pix", label: "Pix" },
  { key: "credito", label: "Crédito" },
  { key: "debito", label: "Débito" },
];

function agoMin(iso: string | null): string {
  if (!iso) return "";
  const min = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  return `há ${h}h${min % 60 ? ` ${min % 60}min` : ""}`;
}

export default function MesasClient({
  pricePerKgCents,
  sizes,
}: {
  pricePerKgCents: number;
  sizes: SizeOption[];
}) {
  const [tables, setTables] = useState<TableCell[]>([]);
  const [loaded, setLoaded] = useState(false);

  // modal / comanda aberta
  const [tabId, setTabId] = useState<number | null>(null);
  const [tableNumber, setTableNumber] = useState<number | null>(null);
  const [comanda, setComanda] = useState<Comanda | null>(null);
  const [payMode, setPayMode] = useState(false);
  const [busy, setBusy] = useState(false);

  // carrinho temporário (antes de lançar na comanda)
  const [cart, setCart] = useState<CartLine[]>([]);
  const [mode, setMode] = useState<"copo" | "pesar">("copo");
  const [grams, setGrams] = useState("");

  // pagamento
  const [fee, setFee] = useState(false);
  const [method, setMethod] = useState("pix");
  const [amount, setAmount] = useState("");
  const [received, setReceived] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [pointsMsg, setPointsMsg] = useState<string | null>(null);

  // ---- grade ----
  const loadTables = useCallback(async () => {
    try {
      const res = await fetch("/api/mesas", { cache: "no-store" });
      const data = await res.json();
      setTables(data.tables ?? []);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadTables();
    const t = setInterval(loadTables, 5000);
    return () => clearInterval(t);
  }, [loadTables]);

  const loadComanda = useCallback(async (id: number) => {
    const res = await fetch(`/api/mesas/comanda?tabId=${id}`, { cache: "no-store" });
    const data: Comanda = await res.json();
    setComanda(data);
  }, []);

  async function openTable(cell: TableCell) {
    setBusy(true);
    try {
      let id = cell.tabId;
      if (!id) {
        const res = await fetch("/api/mesas/abrir", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tableNumber: cell.number }),
        });
        const data = await res.json();
        id = data.tab?.id ?? null;
      }
      if (!id) return;
      setTabId(id);
      setTableNumber(cell.number);
      setPayMode(false);
      setCart([]);
      setMode("copo");
      setGrams("");
      resetPay();
      await loadComanda(id);
      loadTables();
    } finally {
      setBusy(false);
    }
  }

  function closeModal() {
    setTabId(null);
    setTableNumber(null);
    setComanda(null);
    setPayMode(false);
    setCart([]);
    setGrams("");
    resetPay();
    loadTables();
  }

  function resetPay() {
    setFee(false);
    setMethod("pix");
    setAmount("");
    setReceived("");
    setPhone("");
    setName("");
    setPointsMsg(null);
  }

  async function addTables() {
    const raw = window.prompt("Quantas mesas adicionar?", "1");
    if (!raw) return;
    const n = Math.max(1, Math.min(99, Math.round(Number(raw)) || 0));
    if (!n) return;
    setBusy(true);
    try {
      await fetch("/api/mesas/adicionar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ n }),
      });
      await loadTables();
    } finally {
      setBusy(false);
    }
  }

  // ---- carrinho ----
  const gramsNum = Math.max(0, Math.round(Number(grams.replace(",", ".")) || 0));
  const gramsPriceCents = Math.round((gramsNum / 1000) * pricePerKgCents);

  function addCopo(s: SizeOption) {
    setCart((c) => {
      const i = c.findIndex((l) => l.name === s.label && l.unitPriceCents === s.priceCents);
      if (i >= 0) {
        const nx = [...c];
        nx[i] = { ...nx[i], qty: nx[i].qty + 1 };
        return nx;
      }
      return [...c, { name: s.label, sizeLabel: s.label, qty: 1, unitPriceCents: s.priceCents }];
    });
  }

  function addPesado() {
    if (gramsNum <= 0) return;
    setCart((c) => [...c, { name: `Açaí ${gramsNum}g`, qty: 1, unitPriceCents: gramsPriceCents }]);
    setGrams("");
  }

  function incCart(i: number, d: number) {
    setCart((c) => {
      const nx = [...c];
      const q = nx[i].qty + d;
      if (q <= 0) return nx.filter((_, idx) => idx !== i);
      nx[i] = { ...nx[i], qty: q };
      return nx;
    });
  }

  const cartTotal = cart.reduce((s, l) => s + l.qty * l.unitPriceCents, 0);

  async function lancar() {
    if (!tabId || cart.length === 0) return;
    setBusy(true);
    try {
      await fetch("/api/mesas/itens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tabId, items: cart }),
      });
      setCart([]);
      setGrams("");
      await loadComanda(tabId);
      loadTables();
    } finally {
      setBusy(false);
    }
  }

  // ---- comanda consolidada (junta itens iguais) ----
  const lines = useMemo(() => {
    if (!comanda) return [] as ComandaItem[];
    const map: Record<string, ComandaItem> = {};
    for (const o of comanda.orders)
      for (const it of o.items) {
        const k = `${it.name}|${it.sizeLabel ?? ""}|${it.unitPriceCents}`;
        if (!map[k]) map[k] = { ...it, qty: 0 };
        map[k].qty += it.qty;
      }
    return Object.values(map);
  }, [comanda]);

  // ---- pagamento ----
  const subtotal = comanda?.totalCents ?? 0;
  const serviceFeeCents = fee ? Math.round(subtotal * 0.1) : 0;
  const grand = subtotal + serviceFeeCents;
  const paid = comanda?.paidCents ?? 0;
  const falta = Math.max(0, grand - paid);

  const appliedReais = Number(amount.replace(",", ".")) || 0;
  const appliedCents = appliedReais > 0 ? Math.round(appliedReais * 100) : falta;
  const payNow = Math.min(appliedCents, falta);
  const recvCents = Math.round((Number(received.replace(",", ".")) || 0) * 100);
  const troco = method === "dinheiro" && recvCents > payNow ? recvCents - payNow : 0;

  async function addPayment() {
    if (!tabId || payNow <= 0) return;
    setBusy(true);
    try {
      await fetch("/api/mesas/pagamento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tabId, method, amountCents: payNow }),
      });
      setAmount("");
      setReceived("");
      await loadComanda(tabId);
    } finally {
      setBusy(false);
    }
  }

  async function fechar() {
    if (!tabId || falta > 0) return;
    setBusy(true);
    try {
      const res = await fetch("/api/mesas/fechar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tabId,
          serviceFeeCents,
          customerPhone: phone.replace(/\D+/g, "") || undefined,
          customerName: name.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data?.pointsAwarded) {
        setPointsMsg(`Cliente ganhou ${data.pointsAwarded} ponto${data.pointsAwarded === 1 ? "" : "s"}.`);
        setTimeout(closeModal, 1600);
      } else {
        closeModal();
      }
    } finally {
      setBusy(false);
    }
  }

  // ---- render grade ----
  const Tile = ({ t }: { t: TableCell }) => {
    const ocupada = t.tabId != null;
    return (
      <button
        onClick={() => openTable(t)}
        disabled={busy}
        className={`card flex aspect-square flex-col items-center justify-center p-3 text-center transition disabled:opacity-60 ${
          ocupada
            ? "border-[var(--gold)] bg-[#FBF6EA]"
            : "border-[var(--lime)] bg-[#F4FAEC] hover:bg-[#ECF6DF]"
        }`}
        style={{ borderWidth: 2 }}
      >
        <span className={`text-3xl font-extrabold ${ocupada ? "text-ink" : "text-lime"}`}>{t.number}</span>
        {ocupada ? (
          <>
            <span className="mt-0.5 text-sm font-extrabold tabular-nums text-gold">{brl(t.openTotalCents)}</span>
            <span className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-[var(--text-muted)]">
              <IconClock width={11} height={11} /> {agoMin(t.openedAt)}
            </span>
          </>
        ) : (
          <span className="mt-1 text-[11px] font-bold text-lime">Livre</span>
        )}
      </button>
    );
  };

  return (
    <>
      {/* legenda + ação */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-4 text-[11px] font-semibold text-[var(--text-muted)]">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border-2 border-[var(--lime)] bg-[#F4FAEC]" /> Livre
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border-2 border-[var(--gold)] bg-[#FBF6EA]" /> Ocupada
          </span>
        </div>
        <button
          onClick={addTables}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-bg-elevated px-3.5 py-2 text-sm font-bold text-ink disabled:opacity-60"
        >
          <IconPlus width={15} height={15} /> Adicionar mesas
        </button>
      </div>

      {loaded && tables.length === 0 && (
        <div className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-[var(--text-muted)]">
          Nenhuma mesa cadastrada. Toque em “Adicionar mesas” para montar o salão.
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {tables.map((t) => (
          <Tile key={t.number} t={t} />
        ))}
      </div>

      {/* ---- modal da comanda ---- */}
      {tabId != null && (
        <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !busy && closeModal()} />
          <div className="card relative flex max-h-[94vh] w-full max-w-lg flex-col rounded-b-none border-line sm:rounded-2xl">
            {/* header */}
            <div className="flex items-center justify-between border-b border-line p-4">
              <div>
                <h3 className="flex items-center gap-2 text-xl font-extrabold text-ink">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#EFE6FF] text-brand-600">
                    <IconReceipt width={17} height={17} />
                  </span>
                  Mesa {tableNumber}
                </h3>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">Comanda #{tabId}</p>
              </div>
              <button
                onClick={() => !busy && closeModal()}
                className="grid h-9 w-9 place-items-center rounded-lg border border-line text-[var(--text-muted)]"
                aria-label="Fechar"
              >
                <span className="text-lg leading-none">×</span>
              </button>
            </div>

            {!payMode ? (
              <>
                {/* corpo: lançar + comanda */}
                <div className="flex-1 space-y-4 overflow-y-auto p-4">
                  {/* toggle copo / pesar */}
                  <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-bg-surface-2 p-1">
                    {(["copo", "pesar"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setMode(m)}
                        className={`rounded-lg py-2 text-sm font-bold transition ${
                          mode === m ? "brand-gradient text-white shadow-[var(--shadow-brand)]" : "text-[var(--text-muted)]"
                        }`}
                      >
                        {m === "copo" ? "Copo" : "Pesar"}
                      </button>
                    ))}
                  </div>

                  {mode === "copo" ? (
                    <div className="grid grid-cols-3 gap-2">
                      {sizes.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => addCopo(s)}
                          className="rounded-xl border border-line bg-bg-elevated p-3 text-center transition hover:border-brand-600"
                        >
                          <div className="text-sm font-bold text-ink">{s.label}</div>
                          <div className="mt-0.5 text-xs font-semibold text-brand-600">{brl(s.priceCents)}</div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-line bg-bg-elevated p-3">
                      <label className="text-xs font-bold uppercase text-[var(--text-muted)]">Peso (gramas)</label>
                      <div className="mt-1.5 flex items-center gap-2">
                        <input
                          value={grams}
                          onChange={(e) => setGrams(e.target.value)}
                          inputMode="numeric"
                          placeholder="ex: 350"
                          className="w-full rounded-lg border border-line bg-bg-surface-2 px-3 py-2.5 text-sm font-semibold text-ink outline-none focus:border-brand-600"
                        />
                        <span className="whitespace-nowrap text-lg font-extrabold tabular-nums text-brand-600">
                          {brl(gramsPriceCents)}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-[var(--text-muted)]">{brl(pricePerKgCents)}/kg</p>
                      <button
                        onClick={addPesado}
                        disabled={gramsNum <= 0}
                        className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg brand-gradient py-2 text-sm font-bold text-white disabled:opacity-50"
                      >
                        <IconPlus width={15} height={15} /> Lançar açaí pesado
                      </button>
                    </div>
                  )}

                  {/* carrinho temporário */}
                  {cart.length > 0 && (
                    <div className="rounded-xl bg-bg-surface-2 p-3">
                      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--text-muted)]">
                        <IconBag width={14} height={14} /> A lançar
                      </div>
                      <div className="space-y-1.5">
                        {cart.map((l, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            <span className="flex-1 font-semibold text-ink">{l.name}</span>
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => incCart(i, -1)} className="grid h-6 w-6 place-items-center rounded-md border border-line text-ink">
                                <IconMinus width={13} height={13} />
                              </button>
                              <span className="w-5 text-center font-bold tabular-nums">{l.qty}</span>
                              <button onClick={() => incCart(i, 1)} className="grid h-6 w-6 place-items-center rounded-md border border-line text-ink">
                                <IconPlus width={13} height={13} />
                              </button>
                            </div>
                            <span className="w-16 text-right font-bold tabular-nums text-ink">{brl(l.qty * l.unitPriceCents)}</span>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={lancar}
                        disabled={busy}
                        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg brand-gradient py-2.5 text-sm font-bold text-white disabled:opacity-60"
                      >
                        <IconArrowRight width={16} height={16} /> Lançar na comanda · {brl(cartTotal)}
                      </button>
                    </div>
                  )}

                  {/* itens já na comanda */}
                  <div>
                    <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--text-muted)]">
                      <IconReceipt width={14} height={14} /> Na comanda
                    </div>
                    {lines.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-line p-4 text-center text-sm text-[var(--text-muted)]">
                        Comanda vazia. Lance o primeiro item.
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {lines.map((it, i) => (
                          <div key={i} className="flex justify-between py-0.5 text-sm">
                            <span className="text-ink">
                              <span className="font-bold text-brand-600">{it.qty}×</span> {it.name}
                            </span>
                            <span className="tabular-nums text-[var(--text-muted)]">{brl(it.qty * it.unitPriceCents)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* rodapé com total + fechar conta */}
                <div className="space-y-3 border-t border-line p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[var(--text-muted)]">Total da comanda</span>
                    <span className="text-2xl font-extrabold tabular-nums text-ink">{brl(subtotal)}</span>
                  </div>
                  <button
                    onClick={() => setPayMode(true)}
                    disabled={subtotal <= 0}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl brand-gradient py-3.5 text-base font-bold text-white shadow-[var(--shadow-brand)] disabled:opacity-50"
                  >
                    Fechar conta <IconArrowRight width={18} height={18} />
                  </button>
                </div>
              </>
            ) : (
              /* ---- tela de pagamento ---- */
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                <button
                  onClick={() => setPayMode(false)}
                  className="mb-1 flex items-center gap-1 text-sm font-semibold text-[var(--text-muted)]"
                >
                  <IconArrowRight width={15} height={15} className="rotate-180" /> Voltar pra comanda
                </button>

                {/* taxa de serviço */}
                <button onClick={() => setFee((f) => !f)} className="flex w-full items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-semibold text-ink">
                    <span className={`relative h-5 w-9 rounded-full transition ${fee ? "bg-brand-600" : "bg-bg-surface-2"}`}>
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${fee ? "right-0.5" : "left-0.5"}`} />
                    </span>
                    Taxa de serviço 10%
                  </span>
                  <span className="tabular-nums text-[var(--text-muted)]">{brl(serviceFeeCents)}</span>
                </button>

                <div className="flex justify-between text-sm text-[var(--text-muted)]">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{brl(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[var(--text-muted)]">Total</span>
                  <span className="text-2xl font-extrabold tabular-nums text-ink">{brl(grand)}</span>
                </div>

                <div className="hairline my-1" />

                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-muted)]">Já pago</span>
                  <span className="font-semibold tabular-nums text-lime">{brl(paid)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-ink">Falta</span>
                  <span className="tabular-nums" style={{ color: falta > 0 ? "var(--gold)" : "var(--lime)" }}>
                    {brl(falta)}
                  </span>
                </div>

                {comanda && comanda.payments.length > 0 && (
                  <div className="space-y-0.5 rounded-xl bg-bg-surface-2 p-2.5 text-xs text-[var(--text-muted)]">
                    {comanda.payments.map((p, i) => (
                      <div key={i} className="flex justify-between">
                        <span>{METHODS.find((m) => m.key === p.method)?.label ?? p.method}</span>
                        <span className="tabular-nums">{brl(p.amountCents)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {falta > 0 && (
                  <>
                    <div className="grid grid-cols-4 gap-1.5">
                      {METHODS.map((m) => (
                        <button
                          key={m.key}
                          onClick={() => setMethod(m.key)}
                          className={`rounded-lg border py-2 text-xs font-bold transition ${
                            method === m.key ? "border-brand-600 bg-brand-600 text-white" : "border-line text-[var(--text-muted)]"
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                    <input
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      inputMode="decimal"
                      placeholder={`Valor (falta ${brl(falta)})`}
                      className="w-full rounded-lg border border-line bg-bg-surface-2 px-3 py-2.5 text-sm font-semibold text-ink outline-none focus:border-brand-600"
                    />
                    {method === "dinheiro" && (
                      <div className="flex items-center gap-2">
                        <input
                          value={received}
                          onChange={(e) => setReceived(e.target.value)}
                          inputMode="decimal"
                          placeholder="Valor recebido"
                          className="flex-1 rounded-lg border border-line bg-bg-surface-2 px-3 py-2 text-sm font-semibold text-ink outline-none focus:border-brand-600"
                        />
                        {troco > 0 && (
                          <span className="whitespace-nowrap text-sm text-ink">
                            Troco <b className="text-brand-600">{brl(troco)}</b>
                          </span>
                        )}
                      </div>
                    )}
                    <button
                      onClick={addPayment}
                      disabled={busy || payNow <= 0}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-line bg-bg-elevated py-2.5 text-sm font-bold text-ink disabled:opacity-50"
                    >
                      <IconPlus width={15} height={15} /> Adicionar pagamento · {brl(payNow)}
                    </button>
                  </>
                )}

                {/* fidelidade (opcional) */}
                <div className="hairline my-1" />
                <div className="text-xs font-bold uppercase text-[var(--text-muted)]">Fidelidade (opcional)</div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nome do cliente"
                    className="rounded-lg border border-line bg-bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-brand-600"
                  />
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    inputMode="tel"
                    placeholder="WhatsApp"
                    className="rounded-lg border border-line bg-bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-brand-600"
                  />
                </div>

                {pointsMsg && (
                  <div className="flex items-center gap-2 rounded-xl bg-[#E8F6DD] p-3 text-sm font-bold text-lime">
                    <IconCheck width={16} height={16} /> {pointsMsg}
                  </div>
                )}

                <button
                  onClick={fechar}
                  disabled={busy || falta > 0 || grand <= 0}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl brand-gradient py-3.5 text-base font-bold text-white shadow-[var(--shadow-brand)] disabled:opacity-50"
                >
                  <IconCheck width={18} height={18} /> {busy ? "Fechando..." : "Fechar comanda"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
