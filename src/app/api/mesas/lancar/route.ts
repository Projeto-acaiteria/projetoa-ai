import { NextResponse } from "next/server";
import { resolveStoreId } from "@/lib/auth/current";
import { db } from "@/lib/supabase";
import { resolveOrderItems } from "@/lib/menu-bar-store";
import { getOrCreateTableByNumber, getOrCreateOpenTab, addTabItems, getTabFull, comandaPayload, type Tab } from "@/lib/tables-store";
import { setTabWaiter } from "@/lib/staff-store";
import { withIdempotency, httpError } from "@/lib/idempotency";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Operador lança item do MENU RELACIONAL (bar/grid) na comanda. Preço/estação/mods/recipe resolvidos
// no SERVIDOR (resolveOrderItems). É o endpoint ÚNICO e ~transacional (Verbo P0 #1): resolve PRIMEIRO,
// abre-ou-pega a comanda só depois, e se o lançamento falhar numa comanda RECÉM-criada, faz rollback
// (apaga a comanda) — não deixa nascer mesa-fantasma vazia.
export async function POST(req: Request) {
  let b: { tabId?: number; tableNumber?: number; pax?: number; waiterId?: string; items?: { productId: string; qty: number; modifierIds?: string[]; grams?: number }[]; note?: string; opId?: string; prePrinted?: boolean };
  try { b = await req.json(); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }
  const sel = Array.isArray(b.items) ? b.items : [];
  if (!sel.length) return NextResponse.json({ error: "Nenhum item." }, { status: 400 });
  if (b.tabId == null && (typeof b.tableNumber !== "number" || !Number.isFinite(b.tableNumber))) {
    return NextResponse.json({ error: "tabId ou tableNumber é obrigatório" }, { status: 400 });
  }

  try {
    const storeId = await resolveStoreId();
    // idempotência (offline Fatia 1): sem opId roda igual a hoje; com opId, replay devolve o mesmo tabId
    const { result } = await withIdempotency(b.opId, storeId, "lancar", async () => {
      // 1) RESOLVE O PREÇO PRIMEIRO — se falhar/vazio, nada é criado (sem janela de comanda-fantasma)
      const resolved = await resolveOrderItems(storeId, sel);
      if (!resolved.length) throw httpError(400, "Itens indisponíveis.");
      // obs viaja DENTRO da linha (resolveOrderItems já a carrega de cada sel) — sem casar por índice
      const lines = resolved.map((it) => ({
        productId: it.productId, name: it.name, sizeLabel: it.sizeLabel, qty: it.qty, unitPriceCents: it.unitPriceCents, station: it.station, mods: it.mods, note: it.note ?? null, earnsPoints: it.earnsPoints,
      }));
      const note = (b.note ?? "").trim().slice(0, 200) || undefined;

      // 2) comanda já existe (adicionar item) → lança direto, sem rollback
      if (b.tabId != null) {
        const orders = await addTabItems(b.tabId, lines, storeId, note, !!b.prePrinted);
        return { ok: true, tabId: b.tabId, stations: [...new Set(orders.map((o) => o.station))] };
      }

      // 3) RASCUNHO: abre-ou-pega a comanda da mesa. Marca se NÓS criamos (pra rollback).
      const d = db();
      const tableId = await getOrCreateTableByNumber(Number(b.tableNumber), storeId);
      const { data: existing } = await d.from("tabs").select("*").eq("store_id", storeId).eq("table_id", tableId).eq("status", "aberta").maybeSingle();
      let tab: Tab;
      let createdNow = false;
      if (existing) {
        tab = existing as Tab;
      } else {
        tab = await getOrCreateOpenTab(tableId, `Mesa ${b.tableNumber}`, storeId, b.pax);
        createdNow = true;
        if (b.waiterId) await setTabWaiter(Number(tab.id), b.waiterId, storeId);
      }

      // 4) lança; se falhar e a comanda acabou de nascer, ROLLBACK (apaga) — sem mesa-fantasma
      try {
        const orders = await addTabItems(Number(tab.id), lines, storeId, note, !!b.prePrinted);
        // devolve a comanda já relida do banco (read-after-write no servidor): a tela abre a
        // comanda com o item novo sem uma 2ª chamada. Uma viagem a menos no gesto mais repetido
        // da noite — e é o gesto que o Medellín reclamou de lento.
        return {
          ok: true, tabId: Number(tab.id),
          stations: [...new Set(orders.map((o) => o.station))],
          comanda: comandaPayload(await getTabFull(Number(tab.id), storeId)),
        };
      } catch (e) {
        if (createdNow) { try { await d.from("tabs").delete().eq("id", tab.id).eq("store_id", storeId); } catch {} }
        throw e;
      }
    });
    return NextResponse.json(result);
  } catch (e) {
    const status = (e as { inflight?: boolean }).inflight ? 409 : ((e as { httpStatus?: number }).httpStatus ?? 500);
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
