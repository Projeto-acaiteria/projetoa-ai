import { cache } from "react";
import { db } from "@/lib/supabase";
import { BILLING } from "@/config/billing";
import { fimCarenciaISO } from "@/lib/billing/carencia";
import { dateBR, todayBR } from "@/lib/date-br";

export type SubStatus = "pending_payment" | "trial" | "active" | "past_due" | "cancelled" | "expired";

export type Subscription = {
  id: string;
  store_id: string;
  status: SubStatus;
  pago_ate: string | null;
  grace_ends_at: string | null;
  asaas_subscription_id: string | null; // preenchido = cartão recorrente (o Asaas retenta sozinho)
  permanent_courtesy: boolean;
  refunded_at: string | null;
  pix_link_atual: string | null;
  asaas_customer_id: string | null; // null = loja nunca cadastrada no Asaas (a tela pede nome+CPF antes)
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
  // past_due NÃO manda mais pra /admin/bloqueado. Quem vence entra no painel e leva o pop-up
  // travado da cobrança por cima (BillingDueBanner) — a parede continua existindo, só que dentro
  // do sistema, com o QR a um clique. Tirar o dono do painel pra uma tela preta fazia ele achar
  // que tinha perdido tudo. Cancelado/expirado/estornado seguem na tela de fora: ali não é
  // "pague pra continuar", é assinatura encerrada, outro assunto.
  return false;
}

const DAY = 86400000;

/** Quantos dias de calendário BR faltam até `quando`. 0 = vence hoje, 1 = amanhã, negativo = passou. */
function diasDeCalendarioBR(quando: string | Date): number {
  const [ay, am, ad] = dateBR(quando).split("-").map(Number);
  const [hy, hm, hd] = todayBR().split("-").map(Number);
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(hy, hm - 1, hd)) / DAY);
}
/** dd/mm no fuso BR — o `dateBR` devolve YYYY-MM-DD, que ninguém lê numa faixa de aviso. */
function diaMesBR(iso: string): string {
  const [, m, d] = dateBR(iso).split("-");
  return `${d}/${m}`;
}

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
  graceUntil: string | null; // último dia em que dá pra usar vencido (past_due)
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
    : sub.pago_ate ? diasDeCalendarioBR(sub.pago_ate) : null; // mesma régua da faixa: dia BR, não fração de 24h
  // Dias que ainda dá pra trabalhar vencido — mesma régua de calendário BR do pop-up, ancorada no
  // vencimento (não em grace_ends_at cru, que nasce na hora em que o cron/webhook por acaso rodou).
  // `past_due` OU vencida ainda como active: entre a meia-noite e o cron das 08:00 a loja está
  // vencida de fato, e a faixa tem que falar disso, não repetir "vence hoje".
  const vencida = sub.status === "past_due" || (sub.status === "active" && daysLeft != null && daysLeft < 0);
  const fimCarencia = vencida ? fimCarenciaISO(sub.pago_ate, sub.grace_ends_at) : null;
  const graceDays = fimCarencia ? Math.max(0, diasDeCalendarioBR(fimCarencia)) : null;
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
    daysLeft, graceDays, graceUntil: fimCarencia, tone,
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
  // VENCIDA (inclusive a que ainda está `active` porque o cron das 08:00 não passou): a faixa fala
  // da carência pela DATA, não por contagem — "você tem 2 dias" some no meio do expediente e
  // ninguém sabe qual é o último dia. Passou a carência, o assunto é outro: já travou.
  if (v.graceUntil) {
    const travou = diasDeCalendarioBR(v.graceUntil) < 0;
    return {
      text: travou
        ? "Mensalidade vencida — o sistema está travado. Pague pra voltar a usar."
        : `Mensalidade vencida — dá pra usar até ${diaMesBR(v.graceUntil)}. Depois disso o sistema trava. Renove agora.`,
      tone: "danger",
    };
  }
  if (sub!.status === "past_due") return { text: "Mensalidade vencida — renove agora pra não travar.", tone: "danger" };
  if (sub!.status === "active" && v.tone === "warn" && v.daysLeft != null)
    return { text: v.daysLeft <= 0 ? "Sua mensalidade vence hoje — renove pra não travar." : `Sua mensalidade vence em ${v.daysLeft} dia${v.daysLeft === 1 ? "" : "s"} — renove pra não travar.`, tone: "warn" };
  return null;
}

// Faixa de COBRANÇA PIX (a interativa, com "Pagar agora" que abre o QR na própria tela).
// Espelha a condição do AgendaPRO: assinatura PIX viva, perto de vencer ou vencida na carência.
// Fica de fora: cartão recorrente (o Asaas retenta sozinho), cortesia e trial — trial não tem
// cobrança gerada, quem fala com ele é o billingBanner de texto.
export type CobrancaBanner = {
  diasAteVencer: number;
  status: "active" | "past_due";
  graceDays: number | null;
  plano: string;
  planoLabel: string;
  valorCents: number;
  precisaCadastro: boolean; // sem cadastro no Asaas → o modal pede nome + CPF/CNPJ antes do QR
  venceuEm: string | null; // data em que a mensalidade venceu de fato (past_due) — vai na mensagem
  prazoAte: string | null; // até quando ainda dá pra usar (carência/liberação manual)
  abreSozinho: boolean; // pop-up sobe ao abrir o sistema, sem precisar clicar na faixa
  travado: boolean; // acabou o prazo: o pop-up não fecha enquanto não pagar
};

export function cobrancaBanner(sub: Subscription | null): CobrancaBanner | null {
  if (!sub || sub.permanent_courtesy || sub.asaas_subscription_id) return null;
  if (sub.status !== "active" && sub.status !== "past_due") return null;
  if (!sub.pago_ate) return null; // trial ainda não tem vencimento de mensalidade

  // Dias de CALENDÁRIO no fuso do Brasil, não fração de 24h. Com `ceil` sobre milissegundos,
  // uma mensalidade que vence hoje às 23:59 aparecia como "vence amanhã" o dia inteiro — o dono
  // lia que tinha mais um dia e não tinha. E contar em UTC (jeito do AgendaPRO) erra o dia aqui:
  // 21h no Brasil já é o dia seguinte lá. Ver [[feedback_fuso_vercel_utc_bucket_dia]].
  const dias = diasDeCalendarioBR(sub.pago_ate);
  if (dias > 3) return null;

  // Vencida: o cliente ainda trabalha BILLING.carenciaDias dias (pop-up sobe, mas fecha). Passou
  // disso, trava. Ancorado no vencimento, então vale já a partir da meia-noite — sem depender do
  // cron das 08:00 ter passado pra existir uma carência gravada.
  const venceu = sub.status === "past_due" || dias < 0;
  const fimCarencia = venceu ? fimCarenciaISO(sub.pago_ate, sub.grace_ends_at) : null;
  const diasDeCarencia = fimCarencia ? diasDeCalendarioBR(fimCarencia) : null;
  const graceDays = diasDeCarencia == null ? null : Math.max(0, diasDeCarencia);

  const planoId = (sub.plano && sub.plano in BILLING.planos ? sub.plano : "mensal") as keyof typeof BILLING.planos;
  const cfg = BILLING.planos[planoId];

  return {
    diasAteVencer: dias,
    status: sub.status === "past_due" ? "past_due" : "active",
    graceDays,
    plano: planoId,
    planoLabel: cfg.label,
    valorCents: cfg.cents,
    precisaCadastro: !sub.asaas_customer_id,
    venceuEm: venceu ? sub.pago_ate : null,
    prazoAte: fimCarencia,
    // Vencida (mesmo com prazo em aberto) ou vencendo HOJE: o pop-up sobe sozinho quando o dono
    // abre o sistema. Antes só existia a faixa, e faixa se ignora — quem está vencido há 5 dias
    // precisa esbarrar na cobrança, não caçar um botão no topo.
    abreSozinho: sub.status === "past_due" || dias <= 0,
    // Travado = acabou a CARÊNCIA, não o vencimento (Eduardo, 02/09 — regra do ComandaPRO, veio do
    // Medellín): 3 dias vencido o cliente trabalha e o pop-up fecha; do 4º dia em diante ele sobe
    // sem ✕ e só o pagamento tira da tela. Em 25/08 isto era `status === "past_due"`, que travava
    // logo no dia seguinte e comia a carência inteira.
    travado: diasDeCarencia != null && diasDeCarencia < 0,
  };
}
