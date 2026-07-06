import { addOrder, getOrder, cancelOrder, confirmBalcaoPedido, type NewOrder, type OrderItem, type PaymentMethod, type Order } from "@/lib/orders-store";
import { listStock, snapshotConsumes, applyConsumes } from "@/lib/stock-store";
import { getStore, resolveCardFee } from "@/lib/settings-store";
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
  machineId?: string; // maquininha escolhida (débito/crédito) — resolve a taxa no servidor
  parcelas?: number; // parcelas do crédito (1–12) — >1 usa a taxa de "parcelado"
};

const PAY: PaymentMethod[] = ["dinheiro", "pix", "debito", "credito"];

// Ajustes na hora de RECEBER. Desconto PIX (config do Adm) reduz o que o CLIENTE paga (bruto cai).
// Taxa da maquininha é CUSTO da loja (net = total − taxa; sobe com parcelas). São coisas distintas.
async function paymentPricing(
  storeId: string,
  subtotalCents: number,
  manualDiscountCents: number,
  paymentMethod: PaymentMethod,
  opts: { machineId?: string; parcelas?: number },
): Promise<{ totalDiscountCents: number; totalCents: number; card: Awaited<ReturnType<typeof resolveCardFee>> }> {
  const afterManual = subtotalCents - manualDiscountCents;
  let pixDiscount = 0;
  if (paymentMethod === "pix") {
    const store = await getStore(storeId);
    const pct = Math.max(0, Math.min(100, Number(store.pixDiscountPercent ?? 0)));
    pixDiscount = Math.round((afterManual * pct) / 100);
  }
  const totalDiscountCents = manualDiscountCents + pixDiscount;
  const totalCents = subtotalCents - totalDiscountCents;
  const card = await resolveCardFee(paymentMethod, totalCents, storeId, opts);
  return { totalDiscountCents, totalCents, card };
}

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
  const manualDiscount = Math.max(0, Math.min(subtotalCents, Math.floor(Number(input.discountCents ?? 0))));
  const paymentMethod = PAY.includes(input.paymentMethod as PaymentMethod) ? (input.paymentMethod as PaymentMethod) : "dinheiro";
  const nowIso = new Date().toISOString();

  // entregue: aplica desconto PIX + taxa de máquina/parcelas AGORA. Pedido pendente ainda não tem
  // pagamento escolhido → só o desconto manual (PIX/taxa entram na confirmação, em confirmPedido).
  let totalDiscountCents = manualDiscount;
  let totalCents = subtotalCents - manualDiscount;
  let card: Awaited<ReturnType<typeof resolveCardFee>> | null = null;
  if (opts.deliver) {
    const p = await paymentPricing(storeId, subtotalCents, manualDiscount, paymentMethod, { machineId: input.machineId, parcelas: input.parcelas });
    totalDiscountCents = p.totalDiscountCents;
    totalCents = p.totalCents;
    card = p.card;
  }

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
    discountCents: totalDiscountCents || undefined,
    paymentMethod: opts.deliver ? paymentMethod : undefined,
    cardFeeCents: card?.feeCents || undefined,
    cardMachineId: card?.machineId,
    cardMachineName: card?.machineName,
    cardFeePercent: card?.feePercent || undefined,
    parcelas: card && card.parcelas > 1 ? card.parcelas : undefined,
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

// FASE 2 — o balcão gerencia os pedidos que o site mandou (status "recebido").

/** Confirma um pedido do site (recebido) → vira venda ENTREGUE + baixa de estoque agora. Só pedido
 *  pendente (idempotente: recusa se já confirmado/cancelado). Congela o custo no momento da confirmação. */
export async function confirmPedido(
  storeId: string,
  id: number,
  paymentMethod?: PaymentMethod,
  opts?: { machineId?: string; parcelas?: number },
): Promise<{ order: Order; stockWarning: boolean } | { error: string }> {
  const order = await getOrder(id, storeId);
  if (!order) return { error: "Pedido não encontrado." };
  if (order.cancelled) return { error: "Pedido cancelado." };
  if (order.status !== "recebido") return { error: "Esse pedido já foi confirmado." };

  const pm = PAY.includes(paymentMethod as PaymentMethod) ? (paymentMethod as PaymentMethod) : "dinheiro";
  const nowIso = new Date().toISOString();
  // recalcula o preço no momento da confirmação: o desconto do pedido pendente era só o manual;
  // agora que o pagamento foi escolhido, entram o desconto PIX e a taxa de máquina/parcelas.
  const p = await paymentPricing(storeId, order.subtotalCents, order.discountCents ?? 0, pm, { machineId: opts?.machineId, parcelas: opts?.parcelas });
  const consumes = (order.consumes ?? []).map((c) => ({ stockId: c.stockId, qty: c.qty }));
  const snapshot = await snapshotConsumes(consumes, storeId); // congela custo (CMV) agora
  const updated = await confirmBalcaoPedido(id, pm, snapshot, nowIso, storeId, {
    totalCents: p.totalCents,
    discountCents: p.totalDiscountCents,
    card: p.card,
  });
  const { failed } = await applyConsumes(consumes, "Venda " + order.display, dateBR(nowIso), storeId);
  return { order: updated ?? order, stockWarning: failed.length > 0 };
}

/** Cancela um pedido do site pendente (cliente desistiu / não apareceu). Só pedido recebido — não
 *  mexe em venda já confirmada (isso seria estorno, outro fluxo). Não baixou estoque, nada a reverter. */
export async function cancelPedido(storeId: string, id: number): Promise<{ ok: true } | { error: string }> {
  const order = await getOrder(id, storeId);
  if (!order) return { error: "Pedido não encontrado." };
  if (order.status !== "recebido") return { error: "Só dá pra cancelar pedido ainda não confirmado." };
  const nowIso = new Date().toISOString();
  await cancelOrder(id, "cancelado no balcão", undefined, nowIso, storeId);
  return { ok: true };
}
