import { NextResponse } from "next/server";
import { setStatus, markPointsAwarded, markConsumed, type OrderStatus } from "@/lib/orders-store";
import { awardPoints, getByPhone } from "@/lib/customers-store";
import { applyConsumes } from "@/lib/stock-store";
import { pointsForSale, eligibleCents } from "@/lib/loyalty";
import { getLoyalty } from "@/lib/loyalty-store";
import { resolveStoreId } from "@/lib/auth/current";
import { getStoreConfig } from "@/lib/auth/store-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID: OrderStatus[] = ["recebido", "preparo", "saiu", "entregue"];

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: { status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!body.status || !VALID.includes(body.status as OrderStatus)) {
    return NextResponse.json({ error: "Status inválido" }, { status: 400 });
  }
  const sid = await resolveStoreId();
  const order = await setStatus(Number(id), body.status as OrderStatus, sid);
  if (!order) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });

  // Pedido entregue = pago. Credita pontos uma única vez, sobre o valor dos
  // produtos (sem a taxa de entrega). Regra: pontua só em venda paga.
  let awarded = 0;
  const storeCfg = await getStoreConfig(sid);
  if (order.status === "entregue" && !order.pointsAwarded && order.phone && storeCfg?.loyalty_enabled) {
    const cfg = await getLoyalty();
    const existing = await getByPhone(order.phone);
    const isFirstPurchase = !existing || existing.history.length === 0;
    // pontua só sobre categorias que dão pontos (fidelidade por categoria). Itens sem o flag
    // (pedidos açaí/antigos) contam normal (default). Sem flag em nenhum item = subtotal inteiro.
    awarded = pointsForSale(eligibleCents(order.items), cfg, { isFirstPurchase });
    if (awarded > 0) {
      await awardPoints(order.phone, order.customerName, awarded, order.display, order.createdAt);
      await markPointsAwarded(order.id, awarded, sid);
    }
  }

  // Baixa de estoque do delivery: abate a ficha técnica ao entregar (uma vez). NÃO-FATAL + marca
  // consumido SEMPRE após a tentativa — senão uma falha no meio re-baixaria os que já saíram na
  // próxima troca de status (dupla-baixa).
  if (order.status === "entregue" && !order.consumed && order.consumes?.length) {
    await applyConsumes(order.consumes, `Pedido ${order.display}`, order.createdAt.slice(0, 10), sid);
    await markConsumed(order.id, sid);
  }

  return NextResponse.json({ ok: true, order, pointsAwarded: awarded });
}
