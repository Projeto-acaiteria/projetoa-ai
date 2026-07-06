import { addOrder, type NewOrder, type OrderItem, type PaymentMethod, type Order } from "@/lib/orders-store";
import { listStock, snapshotConsumes, applyConsumes } from "@/lib/stock-store";
import { dateBR } from "@/lib/date-br";

// VENDA DE PEÇA da assistência técnica (peças/periféricos), separada da OS.
// Vira uma Order (mode "balcao") — cai no Financeiro/caixa/dashboard como VENDA, de graça.
// NUNCA gera comissão de técnico: comissão só existe em service_orders (osCommissionCents).
// Preço é resolvido no SERVIDOR pelo sellPriceCents (anti-fraude: ignora preço que o cliente mandar).
//   deliver=true  → venda paga no balcão: status "entregue" + baixa de estoque agora.
//   deliver=false → pedido do site: status "recebido" (sem baixa); o balcão confirma/baixa depois.

export type PartsSaleInput = {
  items: { sku: string; qty: number }[];
  paymentMethod?: PaymentMethod;
  customerName?: string;
  customerPhone?: string;
  discountCents?: number;
};

const PAY: PaymentMethod[] = ["dinheiro", "pix", "debito", "credito"];

export async function createPartsSale(
  storeId: string,
  input: PartsSaleInput,
  opts: { deliver: boolean },
): Promise<{ order: Order; stockWarning: boolean } | { error: string }> {
  const rawItems = (input.items ?? []).filter((i) => i?.sku && Number(i.qty) > 0);
  if (!rawItems.length) return { error: "Carrinho vazio." };

  const stock = await listStock(storeId);
  const byId = new Map(stock.map((s) => [s.id, s]));

  const items: OrderItem[] = [];
  const consumes: { stockId: string; qty: number }[] = [];
  for (const it of rawItems) {
    const s = byId.get(String(it.sku));
    const price = Number(s?.sellPriceCents ?? 0);
    if (!s || !(price > 0)) continue; // ignora sku inválido / sem preço de venda (não confia no cliente)
    const qty = Math.min(999, Math.max(1, Math.floor(Number(it.qty))));
    items.push({ group: String(s.category), name: s.name, qty, paidCents: qty * price, earnsPoints: false });
    consumes.push({ stockId: s.id, qty });
  }
  if (!items.length) return { error: "Nenhum item válido (sem preço de venda)." };

  const subtotalCents = items.reduce((sum, i) => sum + i.paidCents, 0);
  const discountCents = Math.max(0, Math.min(subtotalCents, Math.floor(Number(input.discountCents ?? 0))));
  const totalCents = subtotalCents - discountCents;
  const paymentMethod = PAY.includes(input.paymentMethod as PaymentMethod) ? (input.paymentMethod as PaymentMethod) : "dinheiro";
  const nowIso = new Date().toISOString();

  // entregue congela o custo (CMV histórico); pedido pendente guarda só o que baixar depois
  const snapshot = opts.deliver ? await snapshotConsumes(consumes, storeId) : consumes.map((c) => ({ ...c }));

  const base: NewOrder = {
    customerName: (input.customerName ?? "").trim() || "Balcão",
    phone: (input.customerPhone ?? "").trim(),
    mode: "balcao",
    sizeLabel: "",
    items,
    subtotalCents,
    feeCents: 0,
    totalCents,
    discountCents: discountCents || undefined,
    paymentMethod: opts.deliver ? paymentMethod : undefined,
    consumes: snapshot,
    consumed: opts.deliver, // entregue já baixou; pedido pendente ainda não
  };

  const order = await addOrder(base, nowIso, opts.deliver ? "entregue" : "recebido", storeId);

  let stockWarning = false;
  if (opts.deliver) {
    // baixa NÃO-FATAL: a venda já está commitada, uma falha de baixa não pode virar 500 → venda dupla
    const { failed } = await applyConsumes(consumes, "Venda " + order.display, dateBR(nowIso), storeId);
    stockWarning = failed.length > 0;
  }

  return { order, stockWarning };
}
