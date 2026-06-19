// Pricing do ComandaPRO (Eduardo, 19/06): só mensalidade, 7 dias de trial grátis, sem setup.
// Base R$219/mês. Planos mais longos = mês mais barato (10% off semestral, ~20% off anual).
// Recorrente via Asaas: cartão = subscription no cycle; PIX = cobrança avulsa pelo período.
export const BILLING = {
  trialDias: 7,
  planos: {
    mensal: { label: "Mensal", meses: 1, cents: 21_900, cycle: "MONTHLY" as const, equivMes: 219 },
    semestral: { label: "Semestral", meses: 6, cents: 118_200, cycle: "SEMIANNUALLY" as const, equivMes: 197 },
    anual: { label: "Anual", meses: 12, cents: 210_000, cycle: "YEARLY" as const, equivMes: 175 },
  },
} as const;

export type PlanoId = keyof typeof BILLING.planos;
