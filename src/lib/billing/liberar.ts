import { db } from "@/lib/supabase";
import { dateBR } from "@/lib/date-br";

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
  // renovação antecipada não queima o crédito que sobrou: conta a partir do vencimento, não de hoje.
  // `new Date(now)` e não `now`: com o alias, o setMonth abaixo mutava o PRÓPRIO now e o
  // setup_paid_at ia gravado um mês no futuro. Pegou o Medellín no 1º pagamento real (25/08 →
  // gravou 25/09). Herdado do webhook antigo, que tinha o mesmo alias.
  const base = sub.pago_ate && new Date(sub.pago_ate) > now ? new Date(sub.pago_ate) : new Date(now);
  base.setMonth(base.getMonth() + meses);
  // Vencimento no FIM do dia, no fuso do Brasil. Sem isso o pago_ate herdava a hora do pagamento
  // (o Medellín pagou 19:24 → venceria 19:24 do mês seguinte) e a mensalidade morria no meio do
  // expediente, num bar que abre 18h.
  const vence = `${dateBR(base)}T23:59:59-03:00`;

  await db()
    .from("subscriptions")
    .update({
      status: "active",
      pago_ate: vence,
      grace_ends_at: null,
      pix_link_atual: null,
      ...(sub.setup_paid_at ? {} : { setup_paid_at: now.toISOString() }),
    })
    .eq("store_id", storeId);

  return { liberou: true, motivo: "ok" };
}
