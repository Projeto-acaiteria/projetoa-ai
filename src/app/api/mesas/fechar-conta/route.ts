import { NextResponse } from "next/server";
import { resolveStoreId } from "@/lib/auth/current";
import { getTabFull, addPayment, closeTab, markTabCallsAttended } from "@/lib/tables-store";
import { getActiveEvent } from "@/lib/events-store";
import { resolveCardFee } from "@/lib/settings-store";
import type { PaymentMethod } from "@/lib/orders-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Fechamento SERVER-AUTHORITATIVE da comanda (Verbo P0 #2): re-busca a comanda FRESCA, calcula a
// taxa de serviço no SERVIDOR (applyFee boolean — não confia no fee do client), paga o que FALTA
// pelo total fresco e fecha. Sem isso, pedido que entrou com o painel aberto era pago a menos.
const PAYS: PaymentMethod[] = ["dinheiro", "pix", "debito", "credito"];

export async function POST(req: Request) {
  let b: { tabId?: number; applyFee?: boolean; applyCover?: boolean; method?: string; machineId?: string; parcelas?: number; customerPhone?: string; customerName?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }
  if (typeof b.tabId !== "number" || !Number.isFinite(b.tabId)) {
    return NextResponse.json({ error: "tabId é obrigatório" }, { status: 400 });
  }
  const method: PaymentMethod = PAYS.includes(b.method as PaymentMethod) ? (b.method as PaymentMethod) : "dinheiro";

  try {
    const sid = await resolveStoreId();
    // FRESCO do banco — nunca o total da tela (pode ter entrado pedido no meio)
    const full = await getTabFull(b.tabId, sid);
    if (full.tab.status === "fechada") return NextResponse.json({ ok: true, alreadyClosed: true });

    const serviceFeeCents = b.applyFee ? Math.round(full.consumoCents * 0.1) : 0; // taxa só sobre consumo
    // COUVERT: cobrado por padrão; se o cliente recusar (applyCover === false) zera E persiste 0.
    // Se o snapshot ainda é 0 (comanda antiga/QR aberta sem pax) mas há show ativo, calcula cover/pessoa
    // × pessoas — assim o couvert do checkbox marcado sempre cobra, mesmo sem ter passado pelo ajuste.
    let coverCents = 0;
    if (b.applyCover !== false) {
      coverCents = full.coverCents;
      if (coverCents === 0) {
        const ev = await getActiveEvent(sid);
        if (ev) coverCents = ev.cover_cents * Math.max(1, full.tab.people_count || 1);
      }
    }
    const grand = full.consumoCents + coverCents + serviceFeeCents;
    const falta = Math.max(0, grand - full.paidCents);

    if (falta > 0) {
      const card = await resolveCardFee(method, falta, sid, { machineId: b.machineId, parcelas: b.parcelas });
      await addPayment(b.tabId, method, falta, card.feePercent); // valida dono + grava taxa da máquina escolhida
    }
    const r = await closeTab(b.tabId, { serviceFeeCents, coverCents, customerPhone: b.customerPhone, customerName: b.customerName });
    await markTabCallsAttended(b.tabId); // ao fechar, quita o "pediu a conta" (some o âmbar do tile)
    return NextResponse.json({ ok: true, totalCents: grand, paidNowCents: falta, pointsAwarded: r.pointsAwarded });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
