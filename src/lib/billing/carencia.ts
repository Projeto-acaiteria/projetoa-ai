import { BILLING } from "@/config/billing";
import { addDiasBR, dateBR } from "@/lib/date-br";

// Carência da mensalidade — regra do ComandaPRO (Eduardo, 02/09): vencida, o cliente ainda tem
// BILLING.carenciaDias dias de calendário pra pagar trabalhando normal (pop-up sobe sozinho mas
// FECHA). Só no dia seguinte ao fim da carência o pop-up trava sem ✕. Veio do Medellín.
//
// A conta ancora no `pago_ate`, não em "agora + 3": o cron roda 08:00 e o webhook chega na hora que
// o Asaas quiser — ancorar na hora da execução fazia a carência começar em momentos diferentes pra
// cada loja, e antes do cron passar (00h→08h) não havia carência nenhuma gravada pra ler.

/** Fim da carência: último instante em que a loja vencida ainda usa o sistema (23:59:59 BR do
 *  último dia). `graceEndsAt` mais longo manda — prazo dado na mão nunca encurta. */
export function fimCarenciaISO(pagoAte: string | null, graceEndsAt?: string | null): string | null {
  const fimDoDia = (iso: string) => `${dateBR(iso)}T23:59:59-03:00`;
  const porVencimento = pagoAte ? `${addDiasBR(dateBR(pagoAte), BILLING.carenciaDias)}T23:59:59-03:00` : null;
  if (!graceEndsAt) return porVencimento;
  const manual = fimDoDia(graceEndsAt);
  if (!porVencimento) return manual;
  return new Date(manual).getTime() > new Date(porVencimento).getTime() ? manual : porVencimento;
}
