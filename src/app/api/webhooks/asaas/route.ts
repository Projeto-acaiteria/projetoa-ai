import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { liberarPorPagamento } from "@/lib/billing/liberar";
import { fimCarenciaISO } from "@/lib/billing/carencia";

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
    // mesma função que a conferência do checkout usa — dedup por payment.id na PK de billing_events
    const r = await liberarPorPagamento({ storeId, paymentId: payment.id, event, meses });
    if (!r.liberou) return NextResponse.json({ ok: true, motivo: r.motivo });
  } else if (event === "PAYMENT_OVERDUE") {
    // Carência contada do VENCIMENTO (mesma conta da tela) — o OVERDUE do Asaas chega na hora que
    // ele quiser, e "agora + 3" fazia o prazo do cliente depender disso.
    await db()
      .from("subscriptions")
      .update({ status: "past_due", grace_ends_at: fimCarenciaISO(sub.pago_ate) })
      .eq("store_id", storeId);
  } else if (event === "PAYMENT_REFUNDED") {
    await db()
      .from("subscriptions")
      .update({ status: "cancelled", refunded_at: now.toISOString() })
      .eq("store_id", storeId);
  }

  return NextResponse.json({ ok: true });
}
