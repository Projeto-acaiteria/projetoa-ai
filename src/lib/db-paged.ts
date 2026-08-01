import "server-only";

// Leitura COMPLETA de tabela que cresce, sem cair na armadilha do teto de 1000 linhas.
//
// O PostgREST devolve no máximo 1000 linhas por requisição e NÃO avisa que truncou — devolve as
// primeiras da ordenação e pronto. Quem lê "tudo" e filtra por data DEPOIS, em memória, passa a
// perder justamente o que é mais novo.
//
// Foi assim que o caixa do Cantinho congelou em 31/07: cruzou 1000 pedidos às 16:41 e o
// faturamento parou em R$ 34,16 (a soma das duas últimas vendas que couberam na página), enquanto
// a tela de Pedidos — que filtra por data no banco — continuava mostrando tudo.
//
// Regra: tabela que cresce sem teto (orders, tab_payments, customers, expenses) só se lê por
// PÁGINA ou com filtro de data NO BANCO. Nunca `select()` solto.
export const PAGINA_DB = 1000;

export async function lerPaginado<T>(
  buscarPagina: (de: number, ate: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
  contexto: string,
): Promise<T[]> {
  const tudo: T[] = [];
  for (let inicio = 0; ; inicio += PAGINA_DB) {
    const { data, error } = await buscarPagina(inicio, inicio + PAGINA_DB - 1);
    if (error) throw new Error(`${contexto}: ${error.message}`); // erro NUNCA vira lista vazia
    const linhas = (data ?? []) as T[];
    tudo.push(...linhas);
    if (linhas.length < PAGINA_DB) return tudo;
  }
}
