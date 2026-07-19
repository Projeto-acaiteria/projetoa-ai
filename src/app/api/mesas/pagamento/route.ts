import { NextResponse } from "next/server";
import { addPayment, getTabFull } from "@/lib/tables-store";
import { getActiveEvent } from "@/lib/events-store";
import { resolveCardFee } from "@/lib/settings-store";
import { resolveStoreId } from "@/lib/auth/current";
import { getOpenSession } from "@/lib/cash-store";
import type { PaymentMethod } from "@/lib/orders-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/mesas/pagamento — registra um pagamento PARCIAL (split) na comanda
export async function POST(req: Request) {
  let b: { tabId?: number; method?: string; amountCents?: number; machineId?: string; parcelas?: number; applyFee?: boolean; applyCover?: boolean };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (typeof b.tabId !== "number" || !Number.isFinite(b.tabId)) {
    return NextResponse.json({ error: "tabId é obrigatório" }, { status: 400 });
  }
  const method = (b.method ?? "").trim();
  if (!method) {
    return NextResponse.json({ error: "method é obrigatório" }, { status: 400 });
  }
  if (typeof b.amountCents !== "number" || !Number.isFinite(b.amountCents)) {
    return NextResponse.json({ error: "amountCents é obrigatório" }, { status: 400 });
  }

  try {
    const sid = await resolveStoreId();
    // TROCO NÃO É RECEITA: limita o valor GRAVADO ao que ainda falta (grand − pago). O excedente
    // que o cliente deu em dinheiro é troco e volta pra ele — não pode inflar caixa/faturamento.
    const full = await getTabFull(b.tabId, sid);
    const serviceFeeCents = b.applyFee ? Math.round(full.consumoCents * 0.1) : 0;
    let coverCents = 0;
    if (b.applyCover !== false) {
      coverCents = full.coverCents;
      if (coverCents === 0) { const ev = await getActiveEvent(sid); if (ev) coverCents = ev.cover_cents * Math.max(1, full.tab.people_count || 1); }
    }
    const grand = full.consumoCents + coverCents + serviceFeeCents;
    const falta = Math.max(0, grand - full.paidCents);
    const recorded = Math.min(b.amountCents, falta);
    const trocoCents = Math.max(0, b.amountCents - falta);
    if (recorded <= 0) return NextResponse.json({ ok: true, recordedCents: 0, trocoCents }); // já quitado; resto é troco
    // #2-caixa: dinheiro recebido SÓ com caixa aberto (uniforme com balcao-venda/vendas). Sem isso,
    // pagamento de mesa com caixa fechado some da conferência da gaveta (λ.reconciliação de caixa).
    if (!(await getOpenSession())) {
      return NextResponse.json({ error: "Abra o caixa antes de receber pagamento" }, { status: 409 });
    }
    // taxa do cartão: máquina escolhida (snapshot) ou flat por método — server-authoritative
    const card = await resolveCardFee(method as PaymentMethod, recorded, sid, { machineId: b.machineId, parcelas: b.parcelas });
    await addPayment(b.tabId, method, recorded, card.feePercent);
    return NextResponse.json({ ok: true, recordedCents: recorded, trocoCents });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
