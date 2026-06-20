// Transição multi-tenant (Fase 4 — ativação). Enquanto os callers não passam store_id explícito,
// os config-stores caem no Cantinho (loja #1), mantendo a produção do Vidal funcionando sem quebra.
// REMOVER quando todos os callers resolverem a loja do contexto:
//   - painel admin → getCurrentStore() (usuário logado)
//   - cardápio público → slug da URL
// Ver COMANDAPRO-ONBOARDING-PLANO.md.
export const CANTINHO_STORE_ID = "48412a95-a52b-4df2-ab8c-1edaf1a7f35f";
