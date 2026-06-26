// Fidelidade do ComandaPRO (multi-segmento — vale pra qualquer loja/nicho): pontos por valor gasto.
// Pontos NUNCA viram dinheiro nem desconto — resgate é troca por item inteiro
// (regra cravada). Pontua só sobre o valor dos produtos (sem taxa de entrega)
// e só em pedido pago/entregue. Os prêmios são definidos pelo DONO (qualquer item).

export const POINTS_PER_BRL = 1; // R$1 gasto = 1 ponto (default)
export const POINTS_VALIDITY_DAYS = 60;

// Prêmio = o que o cliente troca pelos pontos. label livre (qualquer item do nicho:
// "Copo 500ml", "Cerveja", "Pizza pequena"…). sizeId é legado/opcional (não exigido).
export type Reward = { points: number; label: string; sizeId?: string };

export const REWARDS: Reward[] = [
  { points: 100, label: "Item grátis" },
];

// ── Config editável pelo dono (admin) ──
export type LoyaltyConfig = {
  pointsPerBrl: number; // pontos por R$ 1 gasto
  validityDays: number; // validade dos pontos
  rewards: Reward[]; // metas de resgate
  doubleDay: number | null; // 0=dom..6=sáb com pontos multiplicados (null = nenhum)
  doubleMultiplier: number; // multiplicador do dia turbo (ex: 2 = dobro)
  firstPurchaseBonus: number; // pontos extras na 1ª compra do cliente
};

export const DEFAULT_LOYALTY: LoyaltyConfig = {
  pointsPerBrl: POINTS_PER_BRL,
  validityDays: POINTS_VALIDITY_DAYS,
  rewards: REWARDS,
  doubleDay: null,
  doubleMultiplier: 2,
  firstPurchaseBonus: 0,
};

/** Centavos ELEGÍVEIS de uma lista de itens — só os de categoria que pontua.
 *  earnsPoints ausente/undefined = pontua (default, compat com itens/pedidos antigos). */
export function eligibleCents(items: { paidCents: number; earnsPoints?: boolean }[]): number {
  return items.reduce((s, it) => s + (it.earnsPoints === false ? 0 : it.paidCents), 0);
}

/** pontos-base de um pedido, sobre o valor dos PRODUTOS (sem taxa) */
export function computePoints(productCents: number, pointsPerBrl: number = POINTS_PER_BRL): number {
  return Math.floor((productCents / 100) * pointsPerBrl);
}

/** próxima recompensa que o cliente ainda não alcançou + quanto falta */
export function nextReward(points: number, rewards: Reward[] = REWARDS): { reward: Reward; missing: number } | null {
  const next = rewards.find((r) => r.points > points);
  if (!next) return null;
  return { reward: next, missing: next.points - points };
}

/** maior recompensa já resgatável agora (ou null) */
export function bestAvailable(points: number, rewards: Reward[] = REWARDS): Reward | null {
  const ok = rewards.filter((r) => r.points <= points);
  return ok.length ? ok[ok.length - 1] : null;
}

const DIAS_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
export const dayLabel = (d: number | null) => (d == null ? "nenhum" : DIAS_SEMANA[d] ?? "?");

/** pontos finais aplicando dia-turbo + bônus de 1ª compra */
export function pointsForSale(productCents: number, cfg: LoyaltyConfig, opts: { isFirstPurchase?: boolean; now?: Date } = {}): number {
  const now = opts.now ?? new Date();
  let pts = computePoints(productCents, cfg.pointsPerBrl);
  if (cfg.doubleDay != null && now.getDay() === cfg.doubleDay) pts = Math.floor(pts * cfg.doubleMultiplier);
  if (opts.isFirstPurchase && cfg.firstPurchaseBonus > 0) pts += cfg.firstPurchaseBonus;
  return pts;
}
