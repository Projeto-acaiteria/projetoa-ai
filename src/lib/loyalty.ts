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
  minEarnCents: number; // valor MÍNIMO (centavos) que pontua nada abaixo disso; 0 = sem mínimo
  fixedPointsPerSale: number; // pontos FIXOS por compra (acima do mínimo), ignora pointsPerBrl; 0 = por valor gasto
  // AÇAÍ/PDV: categorias de REVENDA (stock.category) que NÃO pontuam — a montagem do copo
  // sempre pontua. (No mundo relacional a regra mora em menu_categories.earns_points.)
  nonEarningCategories: string[];
};

export const DEFAULT_LOYALTY: LoyaltyConfig = {
  pointsPerBrl: POINTS_PER_BRL,
  validityDays: POINTS_VALIDITY_DAYS,
  rewards: REWARDS,
  doubleDay: null,
  doubleMultiplier: 2,
  firstPurchaseBonus: 0,
  minEarnCents: 0,
  fixedPointsPerSale: 0,
  nonEarningCategories: [],
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

/** Bloco de fidelidade pro cupom (gatilho de retorno): ganho + saldo + quanto falta pro
 *  próximo prêmio. Diferencial — concorrentes não imprimem isso. Multi-linha (\n → <br> no cupom). */
export function loyaltyReceiptInfo(earned: number, balance: number, rewards: Reward[] = REWARDS): string {
  const pt = (n: number) => `${n} ${n === 1 ? "ponto" : "pontos"}`;
  const lines: string[] = [];
  if (earned > 0) lines.push(`Você ganhou +${pt(earned)}`);
  lines.push(`Saldo: ${pt(balance)}`);
  const nx = nextReward(balance, rewards);
  if (nx) lines.push(`Faltam ${nx.missing} pra ${nx.reward.label}`);
  else {
    const b = bestAvailable(balance, rewards);
    if (b) lines.push(`Você já pode trocar por ${b.label}!`);
  }
  return lines.join("\n");
}

const DIAS_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
export const dayLabel = (d: number | null) => (d == null ? "nenhum" : DIAS_SEMANA[d] ?? "?");

/** Saldo VÁLIDO agora: simula o ledger FIFO com expiração (pontos valem validityDays dias).
 *  Cada ganho vira um lote que expira em validityDays; resgates/ajustes negativos consomem os
 *  lotes mais ANTIGOS ainda válidos (FIFO). Lançamentos 'expire' são ignorados (só auditoria do
 *  cron). Como todo lote usa o mesmo prazo e os eventos entram em ordem, o lote da frente é sempre
 *  o que expira primeiro. É a fonte da verdade pro gate de resgate e pro display do cliente. */
export function validBalance(
  history: { type: string; points: number; at: string }[],
  validityDays: number = POINTS_VALIDITY_DAYS,
  now: Date = new Date(),
): number {
  const ms = Math.max(1, validityDays) * 86400000;
  const nowMs = now.getTime();
  const evs = (history ?? [])
    .filter((tx) => tx.type !== "expire")
    .map((tx) => ({ points: Number(tx.points) || 0, t: new Date(tx.at).getTime() }))
    .filter((e) => Number.isFinite(e.t))
    .sort((a, b) => a.t - b.t);
  const lots: { remaining: number; expiresAt: number }[] = [];
  const dropExpired = (t: number) => { while (lots.length && lots[0].expiresAt <= t) lots.shift(); };
  for (const e of evs) {
    if (e.points > 0) {
      lots.push({ remaining: e.points, expiresAt: e.t + ms });
    } else if (e.points < 0) {
      dropExpired(e.t); // lote já expirado não pode ser consumido por um resgate posterior
      let need = -e.points;
      while (need > 0 && lots.length) {
        const take = Math.min(lots[0].remaining, need);
        lots[0].remaining -= take;
        need -= take;
        if (lots[0].remaining <= 0) lots.shift();
      }
    }
  }
  dropExpired(nowMs);
  return lots.reduce((s, l) => s + l.remaining, 0);
}

/** pontos finais aplicando dia-turbo + bônus de 1ª compra */
export function pointsForSale(productCents: number, cfg: LoyaltyConfig, opts: { isFirstPurchase?: boolean; now?: Date } = {}): number {
  // valor mínimo pra pontuar: abaixo do mínimo NÃO pontua (nem dia-turbo, nem bônus de 1ª compra)
  if (cfg.minEarnCents > 0 && productCents < cfg.minEarnCents) return 0;
  const now = opts.now ?? new Date();
  // pontos FIXOS por compra (se configurado) — senão proporcional ao valor gasto
  let pts = cfg.fixedPointsPerSale > 0 ? cfg.fixedPointsPerSale : computePoints(productCents, cfg.pointsPerBrl);
  if (cfg.doubleDay != null && now.getDay() === cfg.doubleDay) pts = Math.floor(pts * cfg.doubleMultiplier);
  if (opts.isFirstPurchase && cfg.firstPurchaseBonus > 0) pts += cfg.firstPurchaseBonus;
  return pts;
}
