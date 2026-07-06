import { NextResponse } from "next/server";
import { resolveStoreId } from "@/lib/auth/current";
import { confirmPedido, cancelPedido } from "@/lib/parts-sale";
import type { PaymentMethod } from "@/lib/orders-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Gestão dos pedidos que o SITE mandou (assistência técnica). Sessão do dono/recepção.
// Rota própria (namespace at-) pra não colidir com /api/pedidos (delivery de food).
// POST {action, payload}: confirm (vira venda + baixa) | cancel (cliente desistiu).
export async function POST(req: Request) {
  const storeId = await resolveStoreId();
  let b: { action?: string; payload?: Record<string, unknown> };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "body inválido" }, { status: 400 });
  }
  const p = b.payload ?? {};
  const id = Number(p.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "id inválido" }, { status: 400 });
  try {
    if (b.action === "confirm") {
      const r = await confirmPedido(storeId, id, p.paymentMethod as PaymentMethod | undefined, {
        machineId: p.machineId ? String(p.machineId) : undefined,
        parcelas: p.parcelas != null ? Number(p.parcelas) : undefined,
      });
      if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
      return NextResponse.json({ ok: true, display: r.order.display, stockWarning: r.stockWarning });
    }
    if (b.action === "cancel") {
      const r = await cancelPedido(storeId, id);
      if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "ação inválida" }, { status: 400 });
  } catch (e) {
    console.error("at-pedidos:", e);
    return NextResponse.json({ error: "Não consegui processar o pedido." }, { status: 500 });
  }
}
