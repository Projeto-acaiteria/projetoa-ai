import { NextResponse } from "next/server";
import { addOrder, markPointsAwarded, type OrderItem } from "@/lib/orders-store";
import { applyConsumes, listStock } from "@/lib/stock-store";
import { awardPoints, getByPhone } from "@/lib/customers-store";
import { pointsForSale } from "@/lib/loyalty";
import { getLoyalty } from "@/lib/loyalty-store";
import { getOpenSession } from "@/lib/cash-store";
import { resolveCardFee, resolveSplitCardFee } from "@/lib/settings-store";
import { resolveStoreId } from "@/lib/auth/current";
import type { PaymentMethod } from "@/lib/orders-store";

const METHODS: PaymentMethod[] = ["dinheiro", "pix", "debito", "credito"];

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CartItem = { name: string; qty: number; unitCents: number; group?: string; stockId?: string };
type Consume = { stockId: string; qty: number };

// POST /api/vendas — venda de balcão (imediata, já paga)
export async function POST(req: Request) {
  let b: {
    items?: CartItem[];
    consumes?: Consume[];
    paymentMethod?: PaymentMethod;
    machineId?: string; // máquina do cartão (taxa)
    parcelas?: number; // parcelas no crédito
    amountPaidCents?: number;
    customerPhone?: string;
    customerName?: string;
    discountCents?: number;
    payments?: { method: PaymentMethod; amountCents: number }[];
  };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  // sem caixa aberto, não vende (regra de PDV)
  if (!(await getOpenSession())) {
    return NextResponse.json({ error: "Abra o caixa antes de vender" }, { status: 409 });
  }

  const items = (b.items || []).filter((i) => i.qty > 0);
  if (!items.length) return NextResponse.json({ error: "Comanda vazia" }, { status: 400 });
  if (!b.paymentMethod || !METHODS.includes(b.paymentMethod)) {
    return NextResponse.json({ error: "Forma de pagamento inválida" }, { status: 400 });
  }

  const subtotalCents = items.reduce((s, i) => s + i.unitCents * i.qty, 0);
  // desconto do operador (clampa em [0, subtotal]); total = o que o cliente paga
  const discountCents = Math.max(0, Math.min(Math.round(b.discountCents ?? 0), subtotalCents));
  const totalCents = subtotalCents - discountCents;
  // split de pagamento: 2+ formas. Valida a soma; taxa do cartão só sobre a parte no cartão.
  const isCard = (m?: string) => m === "debito" || m === "credito";
  const rawPays = Array.isArray(b.payments) ? b.payments.filter((p) => p && METHODS.includes(p.method) && Math.round(p.amountCents) > 0).map((p) => ({ method: p.method, amountCents: Math.round(p.amountCents) })) : [];
  const isSplit = rawPays.length >= 2;
  if (isSplit && rawPays.reduce((s, p) => s + p.amountCents, 0) !== totalCents) {
    return NextResponse.json({ error: "A soma das formas de pagamento não bate com o total." }, { status: 400 });
  }
  const effMethod: PaymentMethod = isSplit ? rawPays.slice().sort((a, b) => b.amountCents - a.amountCents)[0].method : b.paymentMethod;
  // taxa do cartão sobre o TOTAL pago (forma única) OU soma de TODAS as parcelas no cartão (split)
  const storeId = await resolveStoreId();
  const card = isSplit
    ? await resolveSplitCardFee(rawPays.filter((p) => isCard(p.method)), storeId, { machineId: b.machineId, parcelas: b.parcelas })
    : await resolveCardFee(b.paymentMethod, totalCents, storeId, { machineId: b.machineId, parcelas: b.parcelas });
  const orderItems: OrderItem[] = items.map((i) => ({
    group: i.group || "Venda",
    name: i.name,
    qty: i.qty,
    paidCents: i.unitCents * i.qty,
  }));
  const nowIso = new Date().toISOString();

  const order = await addOrder(
    {
      customerName: b.customerName?.trim() || "Balcão",
      phone: b.customerPhone?.trim() || "",
      mode: "balcao",
      sizeLabel: `${items.length} ${items.length === 1 ? "item" : "itens"}`,
      items: orderItems,
      subtotalCents,
      feeCents: 0, // sem taxa de entrega no balcão
      totalCents,
      discountCents,
      paymentMethod: effMethod,
      payments: isSplit ? rawPays : undefined,
      cardFeeCents: card.feeCents,
      cardMachineId: card.machineId,
      cardMachineName: card.machineName,
      cardFeePercent: card.feePercent,
      parcelas: card.parcelas,
      consumes: b.consumes || [], // grava a ficha técnica aplicada (rastro de auditoria — espelha /api/balcao-venda)
    },
    nowIso,
    "entregue", // balcão = já entregue/pago
  );

  // baixa automática de estoque pela ficha técnica — NÃO-FATAL (a venda já está commitada).
  // Mas NÃO engole o resultado: se alguma baixa falhar, o operador é avisado (stockWarning).
  const stock = await applyConsumes(b.consumes || [], `Venda ${order.display}`, nowIso.slice(0, 10));
  const stockWarning = stock.failed.length
    ? `Venda registrada, mas ${stock.failed.length} item(ns) não baixaram do estoque — confira o estoque.`
    : undefined;

  // pontos (só se identificou o cliente por telefone)
  let pointsAwarded = 0;
  if (b.customerPhone?.trim()) {
    const phone = b.customerPhone.trim();
    const cfg = await getLoyalty();
    const existing = await getByPhone(phone);
    const isFirstPurchase = !existing || existing.history.length === 0;
    // fidelidade por categoria (açaí): a montagem do copo (sem stockId) SEMPRE pontua; a revenda
    // pontua só se a categoria do estoque não estiver desligada. Lookup server-side (não confia no client).
    const nonEarning = new Set(cfg.nonEarningCategories ?? []);
    let eligibleSubtotal = subtotalCents;
    if (nonEarning.size) {
      const catById = new Map((await listStock(storeId)).map((s) => [s.id, s.category]));
      eligibleSubtotal = items.reduce((s, i) => {
        const cat = i.stockId ? catById.get(i.stockId) : undefined;
        const earns = !cat || !nonEarning.has(cat); // sem categoria de revenda = montagem = pontua
        return s + (earns ? i.unitCents * i.qty : 0);
      }, 0);
    }
    // desconto rateado proporcional sobre a parte elegível
    const eligibleCents = subtotalCents > 0 ? Math.round((eligibleSubtotal * totalCents) / subtotalCents) : 0;
    pointsAwarded = pointsForSale(eligibleCents, cfg, { isFirstPurchase });
    if (pointsAwarded > 0) {
      await awardPoints(phone, order.customerName, pointsAwarded, order.display, nowIso);
      await markPointsAwarded(order.id, pointsAwarded);
    }
  }

  const changeCents =
    !isSplit && b.paymentMethod === "dinheiro" && b.amountPaidCents
      ? Math.max(0, b.amountPaidCents - totalCents)
      : 0;

  return NextResponse.json(
    { ok: true, order, pointsAwarded, changeCents, feeCents: card.feeCents, netCents: totalCents - card.feeCents, stockWarning },
    { status: 201 },
  );
}
