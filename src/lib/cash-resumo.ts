// Resumo do caixa por JANELA + virada automática da noite operacional.
// Extraído da rota /api/caixa pra ser reusado pelos dois: a tela (janela = noite corrente) e o
// fechamento automático (janela = a noite QUE ACABOU). Server-side. Valores em centavos.
import { getOpenSession, openCash, closeCash, type CashSession } from "@/lib/cash-store";
import { listOrders } from "@/lib/orders-store";
import { listServiceOrders } from "@/lib/service-orders-store";
import { listMesaPayments } from "@/lib/tables-store";
import { weightSoldSince } from "@/lib/weight-report";
import { dateBR } from "@/lib/date-br";
import { inicioNoiteOperacionalISO, noiteOperacionalBR } from "@/lib/events-store";

const HORAS6_MS = 6 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;

/** Noite operacional (YYYY-MM-DD) à qual um instante pertence: a data de (T − 6h) no fuso BR.
 *  02:00 do dia 22 − 6h = 20:00 do dia 21 → noite de 21. Casa com noiteOperacionalBR(). */
export const noiteDe = (iso: string): string => dateBR(new Date(new Date(iso).getTime() - HORAS6_MS).toISOString());

/** Fim (ms) de uma noite operacional = 6h do dia seguinte. */
const fimDaNoiteMs = (ymd: string): number => new Date(`${ymd}T06:00:00-03:00`).getTime() + DIA_MS;

/** JANELA DA TELA = noite operacional corrente. Se a sessão é de uma noite passada (ninguém fechou),
 *  a tela mostra só a noite de agora — não mistura datas e zera sozinha às 6h. */
export function janelaNoite(session: CashSession): number {
  return Math.max(new Date(session.openedAt).getTime(), new Date(inicioNoiteOperacionalISO()).getTime());
}

/** Resumo do caixa numa janela [fromMs, toMs). Sem toMs = até agora.
 *  Tudo comparado por TIMESTAMP (não string): paid_at vem "+00:00" e openedAt vem "Z". */
export async function resumoJanela(session: CashSession, fromMs: number, toMs?: number) {
  const dentro = (iso: string) => {
    const t = new Date(iso).getTime();
    return t >= fromMs && (toMs == null || t < toMs);
  };
  const fromISO = new Date(fromMs).toISOString();
  const orders = (await listOrders()).filter((o) => o.mode === "balcao" && !o.cancelled && dentro(o.createdAt));
  const mesas = (await listMesaPayments()).filter((m) => dentro(m.date));
  const mesaCashCents = mesas.filter((m) => m.method === "dinheiro").reduce((s, m) => s + m.grossCents, 0);
  const mesaTotalCents = mesas.reduce((s, m) => s + m.grossCents, 0);
  const salesTotalCents = orders.reduce((s, o) => s + o.totalCents, 0) + mesaTotalCents;
  // por método (conferência tripla): se a order tem split (payments[]), soma cada forma no seu balde;
  // senão cai no método único (o.paymentMethod). Backward-compat com vendas antigas.
  const isCard = (m?: string) => m === "debito" || m === "credito";
  const bucket = (o: (typeof orders)[number]) => {
    if (o.payments?.length) {
      let cash = 0, card = 0, pix = 0;
      for (const p of o.payments) { if (p.method === "dinheiro") cash += p.amountCents; else if (p.method === "pix") pix += p.amountCents; else card += p.amountCents; }
      return { cash, card, pix };
    }
    return { cash: o.paymentMethod === "dinheiro" ? o.totalCents : 0, card: isCard(o.paymentMethod) ? o.totalCents : 0, pix: o.paymentMethod === "pix" ? o.totalCents : 0 };
  };
  const ob = orders.map(bucket);
  const salesCashCents = ob.reduce((s, b) => s + b.cash, 0) + mesaCashCents;
  const salesCardCents = ob.reduce((s, b) => s + b.card, 0) + mesas.filter((m) => isCard(m.method)).reduce((s, m) => s + m.grossCents, 0);
  const salesPixCents = ob.reduce((s, b) => s + b.pix, 0) + mesas.filter((m) => m.method === "pix").reduce((s, m) => s + m.grossCents, 0);
  const cardFeeCents =
    orders.reduce((s, o) => s + (o.cardFeeCents ?? 0), 0) +
    mesas.filter((m) => isCard(m.method)).reduce((s, m) => s + (m.cardFeeCents ?? 0), 0);
  const cardNetCents = salesCardCents - cardFeeCents;
  // OS quitadas na janela (assistência técnica). SÓ o dinheiro da OS entra no saldo físico; pix/cartão
  // aparecem no total mas não incham a gaveta. Food não tem OS → lista vazia (no-op).
  const os = (await listServiceOrders()).filter(
    (o) => o.paymentStatus === "quitada" && o.status !== "cancelado" && o.paidAt != null && dentro(o.paidAt),
  );
  const osTotalCents = os.reduce((s, o) => s + o.totalCents, 0);
  const osCashCents = os.filter((o) => o.paymentMethod === "dinheiro").reduce((s, o) => s + o.totalCents, 0);
  const nOS = os.length;
  // sangria/suprimento na mesma janela (senão movimento de ontem some no saldo de hoje)
  const movs = session.movements.filter((m) => dentro(m.at));
  const suprimentoCents = movs.filter((m) => m.type === "suprimento").reduce((s, m) => s + m.amountCents, 0);
  const sangriaCents = movs.filter((m) => m.type === "sangria").reduce((s, m) => s + m.amountCents, 0);
  const saldoCaixaCents = session.openingFloatCents + salesCashCents + osCashCents + suprimentoCents - sangriaCents;
  // nVendas: balcão (1 order = 1 venda) + comandas DISTINTAS (split em N parciais NÃO conta N vezes)
  const nMesas = new Set(mesas.map((m) => m.tabId)).size;
  const acai = await weightSoldSince(fromISO, undefined, orders);
  return { salesCashCents, salesTotalCents, salesCardCents, salesPixCents, cardFeeCents, cardNetCents, suprimentoCents, sangriaCents, saldoCaixaCents, nVendas: orders.length + nMesas, osTotalCents, osCashCents, nOS, acai };
}

let virando = false; // trava de reentrância (duas requisições simultâneas na virada)

/** VIRADA AUTOMÁTICA DA NOITE. Se a sessão aberta é de uma noite operacional ANTERIOR, fecha ela
 *  com o retrato DAQUELA noite (vira um fechamento no Histórico) e abre uma nova com fundo R$ 0.
 *  Sem cron: roda na 1ª interação com o caixa depois das 6h.
 *
 *  Por que fecha E abre: receber pagamento exige caixa aberto (409 em mesas/pagamento, fechar-conta
 *  e vendas). A casa não tem o hábito de abrir/fechar caixa, então só fechar deixaria o bar sem
 *  receber à noite. Como também não fazem conferência de dinheiro, o fechamento automático não
 *  mente sobre contagem nenhuma: grava o esperado e diferença zero, assinado como automático. */
export async function virarNoiteSePreciso(): Promise<CashSession | null> {
  const open = await getOpenSession();
  if (!open) return null;
  const noiteSessao = noiteDe(open.openedAt);
  if (noiteSessao === noiteOperacionalBR()) return open; // ainda é a mesma noite — nada a fazer
  if (virando) return open;
  virando = true;
  try {
    const fim = fimDaNoiteMs(noiteSessao); // a noite dela acabou às 6h do dia seguinte
    const r = await resumoJanela(open, new Date(open.openedAt).getTime(), fim);
    const QUEM = "sistema · virada automática da noite";
    await closeCash({
      at: new Date(fim).toISOString(),
      closedBy: QUEM,
      countedCents: r.saldoCaixaCents, // sem conferência física: assume o esperado (diferença 0)
      expectedCents: r.saldoCaixaCents,
      salesCashCents: r.salesCashCents,
      salesCardCents: r.salesCardCents,
      salesPixCents: r.salesPixCents,
      salesTotalCents: r.salesTotalCents,
      cardFeeCents: r.cardFeeCents,
      osCashCents: r.osCashCents,
      osTotalCents: r.osTotalCents,
    });
    return await openCash(0, new Date().toISOString(), QUEM); // noite nova começa com fundo R$ 0
  } finally {
    virando = false;
  }
}
