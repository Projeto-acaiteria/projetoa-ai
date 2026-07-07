"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, Card } from "@/components/admin/ui";
import { IconSearch, IconTrash, IconCart } from "@/components/Icons";
import PedidosPendentes, { type Pedido } from "./PedidosPendentes";

type Product = { sku: string; name: string; category: string; priceCents: number; stock: number };
type Recente = { display: string; totalCents: number; paymentMethod: string | null; count: number };
type Line = { sku: string; name: string; priceCents: number; qty: number; stock: number };
type Machine = { id: string; name: string; maxParcelas: number };
type Pay = "dinheiro" | "pix" | "debito" | "credito";

const brl = (c: number) => "R$ " + (c / 100).toFixed(2).replace(".", ",");
const PAYS: { id: Pay; label: string }[] = [
  { id: "dinheiro", label: "Dinheiro" },
  { id: "pix", label: "Pix" },
  { id: "debito", label: "Débito" },
  { id: "credito", label: "Crédito" },
];

export default function VendasClient({ products, recentes, pedidos, machines, pixDiscountPercent }: { products: Product[]; recentes: Recente[]; pedidos: Pedido[]; machines: Machine[]; pixDiscountPercent: number }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<Line[]>([]);
  const [pay, setPay] = useState<Pay>("dinheiro");
  const [discInput, setDiscInput] = useState("");
  const [customer, setCustomer] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [machineId, setMachineId] = useState(machines[0]?.id ?? "");
  const [parcelas, setParcelas] = useState(1);
  const [showPedidos, setShowPedidos] = useState(false); // pedidos do site colapsados (foco = PDV)

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = s ? products.filter((p) => (p.name + " " + p.category + " " + p.sku).toLowerCase().includes(s)) : products;
    return base.slice(0, 48);
  }, [q, products]);

  const subtotal = cart.reduce((n, l) => n + l.priceCents * l.qty, 0);
  const discountCents = Math.max(0, Math.min(subtotal, Math.round((parseFloat(discInput.replace(",", ".")) || 0) * 100)));
  const pixDiscount = pay === "pix" ? Math.round(((subtotal - discountCents) * pixDiscountPercent) / 100) : 0;
  const total = subtotal - discountCents - pixDiscount;

  function add(p: Product) {
    setErr("");
    setCart((c) => {
      const i = c.findIndex((l) => l.sku === p.sku);
      if (i >= 0) {
        const n = [...c];
        n[i] = { ...n[i], qty: n[i].qty + 1 };
        return n;
      }
      return [...c, { sku: p.sku, name: p.name, priceCents: p.priceCents, qty: 1, stock: p.stock }];
    });
  }
  function setQty(sku: string, qty: number) {
    setCart((c) => c.map((l) => (l.sku === sku ? { ...l, qty: Math.max(1, qty) } : l)));
  }
  function remove(sku: string) {
    setCart((c) => c.filter((l) => l.sku !== sku));
  }

  async function finalizar() {
    if (!cart.length || busy) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/vendas-peca", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((l) => ({ sku: l.sku, qty: l.qty })),
          paymentMethod: pay,
          customerName: customer.trim() || undefined,
          discountCents: discountCents || undefined,
          machineId: (pay === "debito" || pay === "credito") && machineId ? machineId : undefined,
          parcelas: pay === "credito" ? parcelas : undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Falha ao registrar a venda.");
      setDone(d.display + (d.stockWarning ? " · ⚠ confira o estoque" : ""));
      setCart([]);
      setDiscInput("");
      setCustomer("");
      setTimeout(() => setDone(null), 4000);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao registrar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Vendas" sub="Venda de peças e periféricos no balcão — entra no caixa, sem comissão de técnico" />

      {/* Pedidos do site colapsados: aparecem só quando há, sem empurrar o PDV pra baixo da dobra */}
      {pedidos.length > 0 && (
        <div className="mb-4 overflow-hidden rounded-xl border border-brand-400 bg-brand-600/5">
          <button onClick={() => setShowPedidos((v) => !v)} className="flex w-full items-center justify-between px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-bold text-ink">
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-600 px-1.5 text-[11px] font-bold text-white">{pedidos.length}</span>
              Pedidos do site pra confirmar
            </span>
            <span className="text-xs font-bold text-brand-600">{showPedidos ? "esconder ▾" : "confirmar ▸"}</span>
          </button>
          {showPedidos && <div className="px-4 pb-2"><PedidosPendentes pedidos={pedidos} /></div>}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* CATÁLOGO */}
        <div className="space-y-3">
          <div className="relative">
            <IconSearch width={16} height={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar peça, categoria, SKU..."
              className="w-full rounded-xl border border-line bg-bg-base py-2.5 pl-10 pr-3 text-sm text-ink outline-none focus:border-brand-600"
            />
          </div>

          {products.length === 0 ? (
            <Card className="p-6 text-center text-sm text-[var(--text-muted)]">
              Nenhum produto com preço de venda. Defina o <strong>preço de venda</strong> dos itens em <strong>Estoque</strong> pra vender aqui.
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {filtered.map((p) => (
                <button
                  key={p.sku}
                  onClick={() => add(p)}
                  className="flex min-h-[92px] flex-col items-start gap-1 rounded-xl border border-line bg-bg-elevated p-3 text-left transition hover:border-brand-600"
                >
                  <span className="line-clamp-2 text-xs font-semibold text-ink">{p.name}</span>
                  <span className="text-[10px] uppercase tracking-wide text-[var(--text-faded)]">
                    {p.category} · {p.stock} un
                  </span>
                  <span className="mt-auto font-mono text-sm font-bold text-brand-600">{brl(p.priceCents)}</span>
                </button>
              ))}
            </div>
          )}

          {recentes.length > 0 && (
            <div className="pt-2">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Últimas vendas</h3>
              <div className="space-y-1">
                {recentes.map((r) => (
                  <div key={r.display} className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-xs">
                    <span className="text-[var(--text-muted)]">
                      {r.display} · {r.count} item(ns) · {r.paymentMethod ?? "—"}
                    </span>
                    <span className="font-mono font-bold text-ink">{brl(r.totalCents)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* CARRINHO */}
        <Card className="flex h-fit flex-col gap-3 p-4 lg:sticky lg:top-4">
          <div className="flex items-center gap-2 text-sm font-bold text-ink">
            <IconCart width={18} height={18} /> Carrinho
          </div>

          {cart.length === 0 ? (
            <p className="py-6 text-center text-xs text-[var(--text-muted)]">Clique num produto pra adicionar.</p>
          ) : (
            <div className="space-y-2">
              {cart.map((l) => (
                <div key={l.sku} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-ink">{l.name}</div>
                    <div className="font-mono text-[10px] text-[var(--text-muted)]">{brl(l.priceCents)}</div>
                  </div>
                  <input
                    type="number"
                    min={1}
                    value={l.qty}
                    onChange={(e) => setQty(l.sku, parseInt(e.target.value) || 1)}
                    className="w-12 rounded-lg border border-line bg-bg-base px-1 py-1 text-center text-xs text-ink outline-none focus:border-brand-600"
                  />
                  <span className="w-16 text-right font-mono text-xs font-bold text-ink">{brl(l.priceCents * l.qty)}</span>
                  <button onClick={() => remove(l.sku)} aria-label="Remover" className="text-red-500">
                    <IconTrash width={14} height={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2 border-t border-line pt-3">
            <input
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              placeholder="Cliente (opcional)"
              className="w-full rounded-lg border border-line bg-bg-base px-3 py-2 text-xs text-ink outline-none focus:border-brand-600"
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)]">Desconto R$</span>
              <input
                value={discInput}
                onChange={(e) => setDiscInput(e.target.value)}
                placeholder="0,00"
                inputMode="decimal"
                className="ml-auto w-24 rounded-lg border border-line bg-bg-base px-2 py-1.5 text-right text-xs text-ink outline-none focus:border-brand-600"
              />
            </div>
            <div className="grid grid-cols-4 gap-1">
              {PAYS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setPay(m.id)}
                  className={`rounded-lg border px-1 py-1.5 text-[11px] font-bold transition ${pay === m.id ? "border-brand-600 text-brand-600" : "border-line text-[var(--text-muted)]"}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {(pay === "debito" || pay === "credito") && (
              <div className="mt-2 space-y-1.5">
                {machines.length === 0 ? (
                  <p className="text-[10px] text-[var(--text-faded)]">Nenhuma maquininha cadastrada — cadastre em Ajustes pra descontar a taxa.</p>
                ) : (
                  <select value={machineId} onChange={(e) => setMachineId(e.target.value)} className="w-full rounded-lg border border-line bg-bg-base px-2 py-1.5 text-xs text-ink outline-none focus:border-brand-600">
                    {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                )}
                {pay === "credito" && machines.length > 0 && (
                  <select value={parcelas} onChange={(e) => setParcelas(Number(e.target.value))} className="w-full rounded-lg border border-line bg-bg-base px-2 py-1.5 text-xs text-ink outline-none focus:border-brand-600">
                    {Array.from({ length: Math.max(1, machines.find((m) => m.id === machineId)?.maxParcelas ?? 12) }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>{n}x{n === 1 ? " à vista" : ""}</option>
                    ))}
                  </select>
                )}
              </div>
            )}
            {pay === "pix" && pixDiscountPercent > 0 && (
              <div className="mt-2 text-[10px] font-bold text-[var(--green-ok)]">PIX −{pixDiscountPercent}% aplicado</div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-line pt-3">
            <span className="text-sm text-[var(--text-muted)]">Total</span>
            <span className="font-mono text-xl font-bold text-ink">{brl(total)}</span>
          </div>
          {(discountCents > 0 || pixDiscount > 0) && (
            <div className="-mt-2 text-right text-[10px] text-[var(--text-faded)]">
              subtotal {brl(subtotal)}{discountCents > 0 ? ` − ${brl(discountCents)}` : ""}{pixDiscount > 0 ? ` − PIX ${brl(pixDiscount)}` : ""}
            </div>
          )}

          {err && <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-500">{err}</div>}
          {done && <div className="rounded-lg bg-[var(--green-ok)]/10 px-3 py-2 text-xs text-[var(--green-ok)]">Venda {done} registrada ✓</div>}

          <button
            onClick={finalizar}
            disabled={!cart.length || busy}
            className="w-full rounded-xl brand-gradient py-2.5 text-sm font-bold text-white transition disabled:opacity-50"
          >
            {busy ? "Registrando..." : `Finalizar venda · ${brl(total)}`}
          </button>
        </Card>
      </div>
    </>
  );
}
