import { getCurrentStore } from "@/lib/auth/store";
import { CANTINHO_STORE_ID } from "@/lib/tenant";

// Resolve a loja do CONTEXTO (Fase 4 — ativação):
//   - usuário logado (painel admin) → a loja dele (getCurrentStore)
//   - sem login (cardápio público sem slug ainda / transição) → Cantinho
// Os config-stores usam isto como default — assim o painel de CADA loja mostra os dados DELA
// sem precisar migrar os ~14 callers um a um. O cardápio público vira /[slug] depois (passa o id).
export async function resolveStoreId(): Promise<string> {
  try {
    const loja = await getCurrentStore();
    return loja?.id ?? CANTINHO_STORE_ID;
  } catch {
    return CANTINHO_STORE_ID;
  }
}
