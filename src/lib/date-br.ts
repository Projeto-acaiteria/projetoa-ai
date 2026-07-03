// Data no fuso do BRASIL (America/Sao_Paulo). A Vercel/Node rodam em UTC, então um pedido às 22h
// no Brasil (01h UTC do dia seguinte) caía no "amanhã" e sumia do relatório "Hoje". Usar SEMPRE
// estes helpers pra agrupar/filtrar venda por dia. Funciona no servidor e no browser (Intl).
const TZ = "America/Sao_Paulo";

/** Data local-BR (YYYY-MM-DD) de um timestamp ISO — ou de AGORA se não passar nada. */
export function dateBR(iso?: string | Date): string {
  const d = iso ? new Date(iso) : new Date();
  if (isNaN(d.getTime())) return "";
  // en-CA formata como YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Hoje (YYYY-MM-DD) no fuso do Brasil. */
export const todayBR = (): string => dateBR();

/** Instante ISO da meia-noite BR de um dia YYYY-MM-DD. Fronteira de janela de timestamp:
 *  .gte(col, inicioDiaBR(dia)).lt(col, inicioDiaBR(addDiasBR(dia,1))) fecha 00h→00h LOCAL. */
export const inicioDiaBR = (ymd: string): string => `${ymd}T00:00:00-03:00`;

/** Soma n dias a um YYYY-MM-DD, ancorado ao MEIO-DIA UTC pra nunca saltar por borda de fuso. */
export function addDiasBR(ymd: string, n: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// NOTA multi-tenant: TZ fixo em America/Sao_Paulo (todas as lojas são BR hoje). Se entrar loja de
// outro fuso, virar isto por-loja (store.timezone) em vez de constante.
