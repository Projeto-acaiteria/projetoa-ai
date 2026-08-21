import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { getCurrentStore } from "@/lib/auth/store";
import { BILLING, type PlanoId } from "@/config/billing";
import * as asaas from "@/lib/asaas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Checkout ComandaPRO (Fase 3.4). Cartão → subscription recorrente; PIX → cobrança avulsa pelo
// período (QR inline). O externalReference `store_id|plano|meses` é o que o webhook usa pra saber
// QUAL loja liberar (e distingue do AgendaPRO, que divide a mesma conta Asaas).
export async function POST(req: Request) {
  const loja = await getCurrentStore();
  if (!loja) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  let body: { plano?: PlanoId; forma?: "cartao" | "pix"; nome?: string; cpfCnpj?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "body inválido" }, { status: 400 });
  }

  const cfg = body.plano ? BILLING.planos[body.plano] : undefined;
  if (!cfg) return NextResponse.json({ error: "plano inválido" }, { status: 400 });
  if (body.forma !== "cartao" && body.forma !== "pix")
    return NextResponse.json({ error: "forma inválida" }, { status: 400 });

  const { data: sub } = await db().from("subscriptions").select("*").eq("store_id", loja.id).maybeSingle();
  if (!sub) return NextResponse.json({ error: "loja sem assinatura" }, { status: 400 });

  // get-or-create customer (3 camadas: salvo → por externalReference → cria)
  let customerId: string | undefined = sub.asaas_customer_id ?? undefined;
  if (!customerId) {
    const found = await asaas.findCustomerByExternalReference(loja.id);
    customerId = found.data?.data?.[0]?.id;
  }
  if (!customerId) {
    // 1ª vez: precisa dos dados pra emitir a cobrança. O front mostra os campos e reenvia.
    if (!body.nome || !body.cpfCnpj) return NextResponse.json({ needs_customer_data: true });
    const created = await asaas.createCustomer({
      name: body.nome,
      cpfCnpj: body.cpfCnpj,
      email: body.email,
      externalReference: loja.id,
    });
    if (!created.ok || !created.data)
      return NextResponse.json({ error: created.error ?? "falha ao criar cliente" }, { status: 502 });
    customerId = created.data.id;
  }

  const valueReais = cfg.cents / 100;
  const externalReference = `${loja.id}|${body.plano}|${cfg.meses}`;
  const descricao = `ComandaPRO — ${cfg.label}`;

  if (body.forma === "cartao") {
    const r = await asaas.createSubscription({
      customer: customerId,
      billingType: "CREDIT_CARD",
      value: valueReais,
      nextDueDate: asaas.getNextDueDate(1),
      cycle: cfg.cycle,
      description: descricao,
      externalReference,
    });
    if (!r.ok || !r.data)
      return NextResponse.json({ error: r.error ?? "falha na assinatura" }, { status: 502 });
    // a subscription não traz URL — a 1ª cobrança dela tem a invoiceUrl (página segura de cartão do Asaas)
    const pays = await asaas.listSubscriptionPayments(r.data.id);
    const first = pays.data?.data?.[0];
    await db()
      .from("subscriptions")
      .update({
        asaas_customer_id: customerId,
        asaas_subscription_id: r.data.id,
        asaas_payment_id_atual: first?.id ?? null,
        pix_link_atual: first?.invoiceUrl ?? null,
        plano: body.plano,
      })
      .eq("store_id", loja.id);
    return NextResponse.json({ ok: true, tipo: "cartao", url: first?.invoiceUrl ?? null, subscriptionId: r.data.id });
  }

  // PIX avulso pelo período do plano.
  // Antes de emitir, procura cobrança do MESMO plano ainda pagável no Asaas e devolve o QR dela.
  // Sem isso, cada clique em "Pagar via PIX" abria outra cobrança de R$ 219 — o cliente que clica
  // três vezes fica com três em aberto e paga a errada. Mesma trava da /api/billing/pix-atual;
  // o externalReference no filtro garante que trocar de plano (mensal → anual) emite nova.
  const abertas = await asaas.listPaymentsByCustomer(customerId, 15);
  const reaproveitavel = abertas.data?.data?.find(
    (p) => p.externalReference === externalReference && (p.status === "PENDING" || p.status === "OVERDUE"),
  );
  if (reaproveitavel) {
    const qrExistente = await asaas.getPixQrCode(reaproveitavel.id);
    if (qrExistente.ok && qrExistente.data?.payload) {
      await db()
        .from("subscriptions")
        .update({
          asaas_customer_id: customerId,
          asaas_payment_id_atual: reaproveitavel.id,
          pix_link_atual: reaproveitavel.invoiceUrl ?? null,
          plano: body.plano,
        })
        .eq("store_id", loja.id);
      return NextResponse.json({
        ok: true,
        tipo: "pix",
        reaproveitada: true,
        invoiceUrl: reaproveitavel.invoiceUrl,
        qrImage: qrExistente.data.encodedImage ?? null,
        qrPayload: qrExistente.data.payload,
      });
    }
  }

  const pay = await asaas.createPayment({
    customer: customerId,
    billingType: "PIX",
    value: valueReais,
    dueDate: asaas.getNextDueDate(1),
    description: descricao,
    externalReference,
  });
  if (!pay.ok || !pay.data)
    return NextResponse.json({ error: pay.error ?? "falha na cobrança" }, { status: 502 });
  const qr = await asaas.getPixQrCode(pay.data.id);
  await db()
    .from("subscriptions")
    .update({
      asaas_customer_id: customerId,
      asaas_payment_id_atual: pay.data.id,
      pix_link_atual: pay.data.invoiceUrl ?? null,
      plano: body.plano,
    })
    .eq("store_id", loja.id);
  return NextResponse.json({
    ok: true,
    tipo: "pix",
    invoiceUrl: pay.data.invoiceUrl,
    qrImage: qr.data?.encodedImage ?? null,
    qrPayload: qr.data?.payload ?? null,
  });
}
