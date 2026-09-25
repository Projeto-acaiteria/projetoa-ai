// Pricing do ComandaPRO (Eduardo, 19/06 → 14d em 05/07): só mensalidade, 14 dias de trial grátis, sem setup.
// Base R$219/mês. Planos mais longos = mês mais barato (10% off semestral, ~20% off anual).
// Recorrente via Asaas: cartão = subscription no cycle; PIX = cobrança avulsa pelo período.
export const BILLING = {
  trialDias: 14, // onboarding: tempo de introduzir o sistema no cliente antes de cobrar
  // Dias de calendário BR que o cliente ainda trabalha depois do vencimento (pop-up sobe mas fecha).
  // No dia seguinte ao fim da carência o pop-up trava sem ✕ — regra cravada pelo Eduardo em 02/09.
  carenciaDias: 3,
  // Loja vencida cujo pop-up volta sozinho a cada N minutos depois de fechado, até pagar (continua
  // com ✕). Exclusivo por loja — pedido do Eduardo pro Medellín em 25/09, não é regra do produto.
  reabrirCobrancaMin: {
    "e2c9b699-8b92-4f95-a6b0-ef750a7721a4": 30, // Medellín Music Bar
  } as Record<string, number>,
  planos: {
    mensal: { label: "Mensal", meses: 1, cents: 21_900, cycle: "MONTHLY" as const, equivMes: 219 },
    semestral: { label: "Semestral", meses: 6, cents: 118_200, cycle: "SEMIANNUALLY" as const, equivMes: 197 },
    anual: { label: "Anual", meses: 12, cents: 210_000, cycle: "YEARLY" as const, equivMes: 175 },
  },
} as const;

export type PlanoId = keyof typeof BILLING.planos;
