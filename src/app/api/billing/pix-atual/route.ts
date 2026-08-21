import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { getCurrentStore } from "@/lib/auth/store";
import { BILLING, type PlanoId } from "@/config/billing";
import * as asaas from "@/lib/asaas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/billing/pix-atual — devolve o PIX da cobrança EM ABERTO pro dono pagar dentro do painel,
// sem sair da tela. Espelha o AgendaPRO (`/api/billing/pix-atual`, 18/07), que é o fluxo que já roda
// redondo lá: o painel é o canal de cobrança, e-mail/WhatsApp é reforço.
//
// FONTE DA VERDADE = a lista de cobranças do customer no Asaas, NÃO o `asaas_payment_id_atual` do
// banco. Esse campo guarda a última cobrança CRIADA — depois que o webhook confirma, ele aponta pra
// uma cobrança já quitada. Perguntando ao Asaas quem está PENDING/OVERDUE, o cliente que clica três
// vezes em "Pagar" vê o MESMO QR, em vez de abrir três cobranças de R$ 219 no Asaas (era o que o
// checkout do ComandaPRO fazia: todo clique chamava createPayment).
//
// Cartão automático não passa por aqui — o Asaas retenta sozinho.
const STATUS_PAGAVEL = new Set(["PENDING", "OVERDUE", "AWAITING_RISK_ANALYSIS"]);

export async function GET() {
  try {
    return await handler();
  } catch (e) {
    // Qualquer tropeço falando com o Asaas (chave ausente, timeout, 5xx deles) vira mensagem de
    // gente na tela do dono, não um 500 cru — o front só sabe mostrar "não deu pra gerar o PIX".
    console.error("[pix-atual]", e);
    return NextResponse.json({ error: "Não deu pra gerar o PIX agora. Tenta de novo em instantes." }, { status: 502 });
  }
}

async function handler() {
  const loja = await getCurrentStore();
  if (!loja) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { data: sub } = await db()
    .from("subscriptions")
    .select("status, plano, pago_ate, permanent_courtesy, asaas_customer_id, asaas_payment_id_atual, asaas_subscription_id")
    .eq("store_id", loja.id)
    .maybeSingle();

  if (!sub) return NextResponse.json({ error: "loja sem assinatura" }, { status: 404 });
  if (sub.permanent_courtesy) return NextResponse.json({ paid: true });

  // Blindagem (mesma do AgendaPRO): NUNCA gerar cobrança pra quem cancelou ou expirou — senão a
  // rota cobra de novo quem já saiu. Reativação é outro fluxo (checkout/suporte).
  if (sub.status !== "active" && sub.status !== "past_due")
    return NextResponse.json({ error: "assinatura inativa" }, { status: 400 });

  if (sub.asaas_subscription_id)
    return NextResponse.json({ error: "cobrança no cartão — o Asaas retenta sozinho" }, { status: 400 });

  const planoId = (sub.plano ?? "mensal") as PlanoId;
  const cfg = BILLING.planos[planoId] ?? BILLING.planos.mensal;

  // Customer: salvo → por externalReference → sem cadastro (manda pro checkout que coleta CPF/CNPJ)
  let customerId: string | null = sub.asaas_customer_id ?? null;
  if (!customerId) {
    const achado = await asaas.findCustomerByExternalReference(loja.id);
    customerId = achado.data?.data?.[0]?.id ?? null;
    if (customerId) await db().from("subscriptions").update({ asaas_customer_id: customerId }).eq("store_id", loja.id);
  }
  if (!customerId) {
    // Caso do Medellín: nunca cadastrado no Asaas. O front leva pra /admin/bloqueado, que já abre
    // com nome + CPF/CNPJ na tela e emite a cobrança no primeiro clique.
    return NextResponse.json({ error: "need_full_checkout" }, { status: 409 });
  }

  // O webhook casa o pagamento pelo externalReference, mas o painel lê asaas_payment_id_atual —
  // tem que apontar pra cobrança que o cliente vai pagar AGORA.
  async function sincroniza(paymentId: string, invoiceUrl?: string | null) {
    await db()
      .from("subscriptions")
      .update({ asaas_payment_id_atual: paymentId, ...(invoiceUrl ? { pix_link_atual: invoiceUrl } : {}) })
      .eq("store_id", loja!.id);
  }

  function resposta(paymentId: string, qr: { encodedImage?: string; payload?: string } | null | undefined) {
    return NextResponse.json({
      payment_id: paymentId,
      plano: planoId,
      plano_label: cfg.label,
      meses: cfg.meses,
      valor_cents: cfg.cents,
      qr_image: qr?.encodedImage ?? null,
      qr_payload: qr?.payload ?? null,
    });
  }

  // 1. Reaproveitar a cobrança realmente em aberto no Asaas
  const lista = await asaas.listPaymentsByCustomer(customerId, 15);
  if (lista.ok && lista.data?.data) {
    const emAberto = lista.data.data.find((p) => STATUS_PAGAVEL.has(p.status));
    if (emAberto) {
      const qr = await asaas.getPixQrCode(emAberto.id);
      if (qr.ok && qr.data?.payload) {
        if (emAberto.id !== sub.asaas_payment_id_atual) await sincroniza(emAberto.id, emAberto.invoiceUrl);
        return resposta(emAberto.id, qr.data);
      }
      // cobrança em aberto sem PIX renderizável → cai pra geração nova
    } else {
      // Nada pagável. Se a assinatura está coberta, não há o que pagar — o webhook já ativou.
      const coberta = sub.status === "active" && sub.pago_ate && new Date(sub.pago_ate) > new Date();
      if (coberta) return NextResponse.json({ paid: true });
    }
  }

  // 2. Sem cobrança reaproveitável → emite uma
  const pay = await asaas.createPayment({
    customer: customerId,
    billingType: "PIX",
    value: cfg.cents / 100,
    dueDate: asaas.getNextDueDate(1),
    description: `ComandaPRO — ${cfg.label}`,
    externalReference: `${loja.id}|${planoId}|${cfg.meses}`,
  });
  if (!pay.ok || !pay.data?.id)
    return NextResponse.json({ error: "Não deu pra gerar o PIX agora. Tenta de novo em instantes." }, { status: 502 });

  const qr = await asaas.getPixQrCode(pay.data.id);
  await sincroniza(pay.data.id, pay.data.invoiceUrl);
  return resposta(pay.data.id, qr.data);
}
