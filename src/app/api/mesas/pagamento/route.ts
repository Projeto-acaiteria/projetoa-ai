import { NextResponse } from "next/server";
import { addPayment, getTabFull, getOrCreateTableByNumber, comandaPayload } from "@/lib/tables-store";
import { db } from "@/lib/supabase";
import { getActiveEvent } from "@/lib/events-store";
import { resolveCardFee } from "@/lib/settings-store";
import { resolveStoreId } from "@/lib/auth/current";
import { getOpenSession } from "@/lib/cash-store";
import { withIdempotency, httpError } from "@/lib/idempotency";
import type { PaymentMethod } from "@/lib/orders-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/mesas/pagamento — registra um pagamento PARCIAL (split) na comanda
export async function POST(req: Request) {
  let b: { tabId?: number; tableNumber?: number; method?: string; amountCents?: number; machineId?: string; parcelas?: number; applyFee?: boolean; applyCover?: boolean; opId?: string };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const hasTab = typeof b.tabId === "number" && Number.isFinite(b.tabId);
  const hasNum = typeof b.tableNumber === "number" && Number.isFinite(b.tableNumber);
  if (!hasTab && !hasNum) {
    return NextResponse.json({ error: "tabId ou tableNumber é obrigatório" }, { status: 400 });
  }
  const method = (b.method ?? "").trim();
  if (!method) {
    return NextResponse.json({ error: "method é obrigatório" }, { status: 400 });
  }
  if (typeof b.amountCents !== "number" || !Number.isFinite(b.amountCents)) {
    return NextResponse.json({ error: "amountCents é obrigatório" }, { status: 400 });
  }

  const amountCents = b.amountCents as number;
  try {
    const sid = await resolveStoreId();
    // idempotência (offline Fatia 1): sem opId roda igual a hoje; com opId, replay NÃO grava 2º pagamento
    const { result } = await withIdempotency(b.opId, sid, "pagamento", async () => {
      // resolve o tabId por NÚMERO quando a mesa nasceu offline (só vira tabId real no sync; o pagamento
      // sincroniza depois dos lançamentos por ser FIFO, então a comanda já existe aqui, achável por número)
      let tabId = hasTab ? (b.tabId as number) : 0;
      if (!hasTab) {
        const tableId = await getOrCreateTableByNumber(b.tableNumber as number, sid);
        const { data } = await db().from("tabs").select("id").eq("store_id", sid).eq("table_id", tableId).eq("status", "aberta").maybeSingle();
        if (!data) return { ok: true, recordedCents: 0, trocoCents: 0 }; // sem comanda aberta (fechou?)
        tabId = Number((data as { id: number }).id);
      }
      // TROCO NÃO É RECEITA: limita o valor GRAVADO ao que ainda falta (grand − pago). O excedente
      // que o cliente deu em dinheiro é troco e volta pra ele — não pode inflar caixa/faturamento.
      const full = await getTabFull(tabId, sid);
      const serviceFeeCents = b.applyFee ? Math.round(full.consumoCents * 0.1) : 0;
      let coverCents = 0;
      if (b.applyCover !== false) {
        coverCents = full.coverCents;
        if (coverCents === 0) { const ev = await getActiveEvent(sid); if (ev) coverCents = ev.cover_cents * Math.max(1, full.tab.people_count || 1); }
      }
      const grand = full.consumoCents + coverCents + serviceFeeCents;
      const falta = Math.max(0, grand - full.paidCents);
      const recorded = Math.min(amountCents, falta);
      const trocoCents = Math.max(0, amountCents - falta);
      if (recorded <= 0) return { ok: true, recordedCents: 0, trocoCents }; // já quitado; resto é troco
      // #2-caixa: dinheiro recebido SÓ com caixa aberto (uniforme com balcao-venda/vendas). Sem isso,
      // pagamento de mesa com caixa fechado some da conferência da gaveta (λ.reconciliação de caixa).
      if (!(await getOpenSession())) throw httpError(409, "Abra o caixa antes de receber pagamento");
      // taxa do cartão: máquina escolhida (snapshot) ou flat por método — server-authoritative
      const card = await resolveCardFee(method as PaymentMethod, recorded, sid, { machineId: b.machineId, parcelas: b.parcelas });
      await addPayment(tabId, method, recorded, card.feePercent);
      // read-after-write AQUI, no servidor (λ.prova-na-fonte): relê a comanda gravada e devolve
      // junto. O cliente para de fazer uma 2ª chamada só pra ver o que acabou de mudar — a prova
      // continua sendo a leitura do banco, só que numa viagem em vez de duas.
      return { ok: true, recordedCents: recorded, trocoCents, comanda: comandaPayload(await getTabFull(tabId, sid)) };
    });
    return NextResponse.json(result);
  } catch (e) {
    const status = (e as { inflight?: boolean }).inflight ? 409 : ((e as { httpStatus?: number }).httpStatus ?? 500);
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
