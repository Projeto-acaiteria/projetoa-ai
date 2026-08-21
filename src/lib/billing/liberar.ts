import { db } from "@/lib/supabase";

// Liberação da assinatura por pagamento confirmado — UM lugar só, usado por dois caminhos:
//   1. webhook do Asaas (`/api/webhooks/asaas`) — o caminho normal, empurrado pelo Asaas;
//   2. conferência do checkout (`/api/billing/status`) — o cliente está com o QR na tela e a gente
//      pergunta ao Asaas se caiu. É a rede: se o webhook não chegar (token divergente, deploy fora
//      do ar, evento perdido), o cara paga e o painel libera do mesmo jeito, sem ninguém na mão.
// Dedup pela PRIMARY KEY de billing_events (payment_id): os dois caminhos podem rodar pro mesmo
// pagamento, mas só o primeiro estende `pago_ate`.

export type Liberacao = { liberou: boolean; motivo: "ok" | "duplicado" | "sem_assinatura" };

export async function liberarPorPagamento(input: {
  storeId: string;
  paymentId: string;
  event: string;
  meses: number;
}): Promise<Liberacao> {
  const { storeId, paymentId, event, meses } = input;

  const { data: sub } = await db().from("subscriptions").select("*").eq("store_id", storeId).maybeSingle();
  if (!sub) return { liberou: false, motivo: "sem_assinatura" };

  const ins = await db().from("billing_events").insert({ payment_id: paymentId, event, store_id: storeId });
  if (ins.error) return { liberou: false, motivo: "duplicado" };

  const now = new Date();
  // renovação antecipada não queima o crédito que sobrou: conta a partir do vencimento, não de hoje
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

  return { liberou: true, motivo: "ok" };
}
