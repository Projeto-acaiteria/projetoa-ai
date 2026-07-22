import { cache } from "react";
import { db } from "@/lib/supabase";
import { BILLING } from "@/config/billing";

export type SubStatus = "pending_payment" | "trial" | "active" | "past_due" | "cancelled" | "expired";

export type Subscription = {
  id: string;
  store_id: string;
  status: SubStatus;
  pago_ate: string | null;
  grace_ends_at: string | null;
  permanent_courtesy: boolean;
  refunded_at: string | null;
  pix_link_atual: string | null;
  plano: string | null;
  created_at: string | null; // nascimento da assinatura = início do TRIAL (o cron expira por aqui)
};

export const getSubscription = cache(async (storeId: string): Promise<Subscription | null> => {
  const { data } = await db().from("subscriptions").select("*").eq("store_id", storeId).maybeSingle();
  return (data as Subscription) ?? null;
});

// Gate de billing — olha SÓ o status (lição AgendaPRO: quem EXPIRA é o cron, não o gate).
// permanent_courtesy isenta (ex: Cantinho). trial e active passam.
export function isBlocked(sub: Subscription | null): boolean {
  if (!sub) return true;
  if (sub.permanent_courtesy) return false;
  if (sub.refunded_at) return true;
  if (sub.status === "pending_payment" || sub.status === "cancelled" || sub.status === "expired") return true;
  if (sub.status === "past_due") {
    const grace = sub.grace_ends_at ? new Date(sub.grace_ends_at).getTime() : 0;
    return grace < Date.now();
  }
  return false;
}

const DAY = 86400000;
const STATUS_LABEL: Record<SubStatus, string> = {
  trial: "Em teste grátis", active: "Ativo", past_due: "Vencido",
  pending_payment: "Pagamento pendente", cancelled: "Cancelado", expired: "Expirado",
};

// Info do plano pra exibir (seção "Plano" em Ajustes): status, plano, vencimento, dias restantes.
export type BillingView = {
  statusLabel: string;
  planoLabel: string;
  planoCents: number | null;
  pagoAte: string | null;
  daysLeft: number | null; // dias até o vencimento (negativo = já venceu)
  graceDays: number | null; // dias de graça restantes (past_due)
  tone: "ok" | "warn" | "danger";
  courtesy: boolean;
};
/** Fim do TRIAL = nascimento da assinatura + trialDias (a MESMA conta que o cron usa pra expirar).
 *  Sem isso o cliente em teste não tinha contagem nenhuma: pago_ate é nulo no trial, então ele caía
 *  no paywall no dia 14 sem UM aviso — justo na fase de venda (caso Starteq, 06/07 → bloqueou 20/07). */
export function trialEndsAt(sub: Subscription | null): Date | null {
  if (!sub?.created_at || sub.status !== "trial") return null;
  const end = new Date(sub.created_at);
  end.setDate(end.getDate() + BILLING.trialDias);
  return end;
}

export function billingView(sub: Subscription | null): BillingView | null {
  if (!sub) return null;
  const cfg = sub.plano && sub.plano in BILLING.planos ? BILLING.planos[sub.plano as keyof typeof BILLING.planos] : null;
  const fimTrial = trialEndsAt(sub);
  const daysLeft = fimTrial
    ? Math.ceil((fimTrial.getTime() - Date.now()) / DAY) // trial: conta pelo fim do teste
    : sub.pago_ate ? Math.ceil((new Date(sub.pago_ate).getTime() - Date.now()) / DAY) : null;
  const graceDays = sub.grace_ends_at ? Math.max(0, Math.ceil((new Date(sub.grace_ends_at).getTime() - Date.now()) / DAY)) : null;
  const tone: "ok" | "warn" | "danger" = sub.permanent_courtesy
    ? "ok"
    : sub.status === "past_due" || sub.status === "pending_payment" || sub.status === "expired"
      ? "danger"
      : (sub.status === "active" || sub.status === "trial") && daysLeft != null && daysLeft <= 3
        ? "warn" // trial entra aqui também: o teste acabando avisa igual a mensalidade
        : "ok";
  return {
    statusLabel: sub.permanent_courtesy ? "Cortesia" : STATUS_LABEL[sub.status],
    planoLabel: cfg?.label ?? "—",
    planoCents: cfg?.cents ?? null,
    pagoAte: sub.pago_ate ?? (fimTrial ? fimTrial.toISOString() : null), // trial mostra o fim do teste
    daysLeft, graceDays, tone,
    courtesy: sub.permanent_courtesy,
  };
}

// Aviso do topo do painel — 3 dias ANTES do vencimento e durante a graça (vencido). null = sem aviso.
export function billingBanner(sub: Subscription | null): { text: string; tone: "warn" | "danger" } | null {
  const v = billingView(sub);
  if (!v || v.courtesy) return null;
  // TRIAL acabando: antes não avisava NADA — o cliente em teste caía no paywall no dia 14 sem alerta
  // (foi o que travou o Starteq no meio da venda). Mesma régua de 3 dias da mensalidade.
  if (sub!.status === "trial" && v.tone === "warn" && v.daysLeft != null)
    return { text: v.daysLeft <= 0 ? "Seu teste grátis termina hoje — assine pra não perder o acesso." : `Seu teste grátis termina em ${v.daysLeft} dia${v.daysLeft === 1 ? "" : "s"} — assine pra não perder o acesso.`, tone: "warn" };
  if (sub!.status === "active" && v.tone === "warn" && v.daysLeft != null)
    return { text: v.daysLeft <= 0 ? "Sua mensalidade vence hoje — renove pra não travar." : `Sua mensalidade vence em ${v.daysLeft} dia${v.daysLeft === 1 ? "" : "s"} — renove pra não travar.`, tone: "warn" };
  if (sub!.status === "past_due")
    return { text: `Mensalidade vencida — você tem ${v.graceDays ?? 0} dia${v.graceDays === 1 ? "" : "s"} antes do bloqueio. Renove agora.`, tone: "danger" };
  return null;
}
