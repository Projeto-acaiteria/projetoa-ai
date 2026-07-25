import { NextResponse } from "next/server";
import { resolveStoreId } from "@/lib/auth/current";
import { getOpenSession } from "@/lib/cash-store";
import { getTabFull, addPayment, closeTab, markTabCallsAttended, getOrCreateTableByNumber } from "@/lib/tables-store";
import { db } from "@/lib/supabase";
import { getActiveEvent } from "@/lib/events-store";
import { resolveCardFee } from "@/lib/settings-store";
import { withIdempotency, httpError } from "@/lib/idempotency";
import type { PaymentMethod } from "@/lib/orders-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Fechamento SERVER-AUTHORITATIVE da comanda (Verbo P0 #2): re-busca a comanda FRESCA, calcula a
// taxa de serviço no SERVIDOR (applyFee boolean — não confia no fee do client), paga o que FALTA
// pelo total fresco e fecha. Sem isso, pedido que entrou com o painel aberto era pago a menos.
const PAYS: PaymentMethod[] = ["dinheiro", "pix", "debito", "credito"];

export async function POST(req: Request) {
  let b: { tabId?: number; tableNumber?: number; applyFee?: boolean; applyCover?: boolean; method?: string; machineId?: string; parcelas?: number; customerPhone?: string; customerName?: string; opId?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }
  const hasTab = typeof b.tabId === "number" && Number.isFinite(b.tabId);
  const hasNum = typeof b.tableNumber === "number" && Number.isFinite(b.tableNumber);
  if (!hasTab && !hasNum) {
    return NextResponse.json({ error: "tabId ou tableNumber é obrigatório" }, { status: 400 });
  }
  const method: PaymentMethod = PAYS.includes(b.method as PaymentMethod) ? (b.method as PaymentMethod) : "dinheiro";

  try {
    const sid = await resolveStoreId();
    // idempotência (offline Fatia 1): sem opId roda igual a hoje; com opId, replay devolve o mesmo
    // fechamento (não fecha de novo nem cobra 2×). closeTab já é idempotente por status; o op_id
    // garante a MESMA resposta e barra um 2º pagamento se o replay chegar antes do status atualizar.
    const { result } = await withIdempotency(b.opId, sid, "fechar", async () => {
      // resolve o tabId: por número quando a mesa nasceu OFFLINE (só vira tabId real no sync, e o
      // fechar sincroniza DEPOIS dos lançamentos — por isso a comanda já existe aqui, achável por número)
      let tabId = hasTab ? (b.tabId as number) : 0;
      if (!hasTab) {
        const tableId = await getOrCreateTableByNumber(b.tableNumber as number, sid);
        const { data } = await db().from("tabs").select("id").eq("store_id", sid).eq("table_id", tableId).eq("status", "aberta").maybeSingle();
        if (!data) return { ok: true, alreadyClosed: true }; // nada aberto pra fechar (já fechou/sync anterior)
        tabId = Number((data as { id: number }).id);
      }
      // FRESCO do banco — nunca o total da tela (pode ter entrado pedido no meio)
      const full = await getTabFull(tabId, sid);
      if (full.tab.status === "fechada") return { ok: true, alreadyClosed: true };

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
        // #2-caixa: recebe o que falta SÓ com caixa aberto (uniforme com balcao-venda). Comanda já
        // quitada (falta=0) fecha normal sem exigir caixa — só o recebimento de dinheiro exige.
        if (!(await getOpenSession())) throw httpError(409, "Abra o caixa antes de receber pagamento");
        const card = await resolveCardFee(method, falta, sid, { machineId: b.machineId, parcelas: b.parcelas });
        await addPayment(tabId, method, falta, card.feePercent); // valida dono + grava taxa da máquina escolhida
      }
      const r = await closeTab(tabId, { serviceFeeCents, coverCents, customerPhone: b.customerPhone, customerName: b.customerName });
      await markTabCallsAttended(tabId); // ao fechar, quita o "pediu a conta" (some o âmbar do tile)
      return { ok: true, totalCents: grand, paidNowCents: falta, pointsAwarded: r.pointsAwarded };
    });
    return NextResponse.json(result);
  } catch (e) {
    const status = (e as { inflight?: boolean }).inflight ? 409 : ((e as { httpStatus?: number }).httpStatus ?? 500);
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
