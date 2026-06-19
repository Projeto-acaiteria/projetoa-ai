import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Webhook Asaas (ComandaPRO 3.5). A conta é COMPARTILHADA com o AgendaPRO, então processa SÓ os
// pagamentos cujo externalReference (store_id|plano|meses) aponta pra uma loja do ComandaPRO —
// os do AgendaPRO não acham subscription aqui e são ignorados (sempre 200).
// Bugs do AgendaPRO corrigidos: (2) token OBRIGATÓRIO (falha fechado); (1) dedup por payment.id
// nos eventos de liberação (reenvio não estende pago_ate de novo).
export async function POST(req: Request) {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!expected) return NextResponse.json({ error: "webhook não configurado" }, { status: 500 });
  if (req.headers.get("asaas-access-token") !== expected)
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });

  let body: { event?: string; payment?: { id?: string; externalReference?: string } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const event = body.event ?? "";
  const payment = body.payment;
  if (!payment?.id) return NextResponse.json({ ok: true });

  const [storeId, , mesesStr] = (payment.externalReference ?? "").split("|");
  if (!storeId) return NextResponse.json({ ok: true });
  const meses = parseInt(mesesStr || "1", 10) || 1;

  const { data: sub } = await db().from("subscriptions").select("*").eq("store_id", storeId).maybeSingle();
  if (!sub) return NextResponse.json({ ok: true }); // não é loja do ComandaPRO

  const now = new Date();

  if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
    // dedup: libera (estende pago_ate) UMA vez só por payment.id
    const ins = await db()
      .from("billing_events")
      .insert({ payment_id: payment.id, event, store_id: storeId });
    if (ins.error) return NextResponse.json({ ok: true, duplicado: true });

    // preserva crédito não usado em renovação antecipada
    const base = sub.pago_ate && new Date(sub.pago_ate) > now ? new Date(sub.pago_ate) : now;
    base.setMonth(base.getMonth() + meses);
    await db()
      .from("subscriptions")
      .update({
        status: "active",
        pago_ate: base.toISOString(),
        grace_ends_at: null,
        pix_link_atual: null,
        ...(sub.setup_paid_at ? {} : { setup_paid_at: now.toISOString() }),
      })
      .eq("store_id", storeId);
  } else if (event === "PAYMENT_OVERDUE") {
    const grace = new Date(now);
    grace.setDate(grace.getDate() + 3);
    await db()
      .from("subscriptions")
      .update({ status: "past_due", grace_ends_at: grace.toISOString() })
      .eq("store_id", storeId);
  } else if (event === "PAYMENT_REFUNDED") {
    await db()
      .from("subscriptions")
      .update({ status: "cancelled", refunded_at: now.toISOString() })
      .eq("store_id", storeId);
  }

  return NextResponse.json({ ok: true });
}
