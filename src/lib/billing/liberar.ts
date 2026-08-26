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

  // O ANIVERSÁRIO DA COBRANÇA NÃO ANDA. Conta sempre a partir do pago_ate anterior, nunca da data
  // do pagamento. Antes era `pago_ate > now ? pago_ate : now`: quem pagava atrasado ganhava um
  // aniversário novo no dia do pagamento, e a data derretia um pouco todo mês. O Medellín vence
  // dia 20; pagou dia 25 e o vencimento seguinte virou 25 — quando tinha que continuar 20.
  // Renovação antecipada segue preservada: partindo do pago_ate futuro, ninguém perde dia pago.
  // `new Date(now)` e não `now`: com o alias, o setMonth mutava o PRÓPRIO now e o setup_paid_at
  // ia gravado um mês no futuro. Herdado do webhook antigo, que tinha o mesmo alias.
  const base = sub.pago_ate ? new Date(sub.pago_ate) : new Date(now);
  const diaDoAniversario = base.getUTCDate();

  const alvo = new Date(base);
  const somaPeriodo = () => {
    alvo.setUTCMonth(alvo.getUTCMonth() + meses);
    // 31/01 + 1 mês vira 03/03 no JS. Se o dia mudou, o mês era mais curto: volta pro último dia dele.
    if (alvo.getUTCDate() !== diaDoAniversario) alvo.setUTCDate(0);
  };
  somaPeriodo();
  // Atraso longo (pagou 2+ períodos depois): avança de período em período até cobrir hoje, sempre
  // no mesmo dia do mês. Sem isso o pago_ate nasceria no passado e a loja travaria de novo na hora.
  for (let i = 0; i < 24 && alvo.getTime() <= now.getTime(); i++) somaPeriodo();
  // Vencimento no FIM do dia, no fuso do Brasil. Sem isso o pago_ate herdava a hora do pagamento
  // (o Medellín pagou 19:24 → venceria 19:24 do mês seguinte) e a mensalidade morria no meio do
  // expediente, num bar que abre 18h.
  const vence = `${dateBR(alvo)}T23:59:59-03:00`;

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
