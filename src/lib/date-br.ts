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
