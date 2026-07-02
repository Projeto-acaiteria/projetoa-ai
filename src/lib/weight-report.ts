// Relatório de venda do insumo-base vendido por peso (açaí = polpa). Responde "quantos kg de
// açaí vendi hoje" (Vidal): soma a polpa consumida nas vendas da sessão — copo (pela ficha) + peso.
// Product-wide: usa WEIGHT_BASE_STOCK_ID; só acende pra loja que realmente vende isso (totalKg>0).
import { db } from "@/lib/supabase";
import { resolveStoreId } from "@/lib/auth/current";
import { listOrders, type Order } from "@/lib/orders-store";
import { WEIGHT_BASE_STOCK_ID } from "@/lib/menu";

export type WeightSoldReport = {
  totalKg: number; // kg do insumo-base vendido (copo + peso)
  pesoKg: number; // kg vendido POR PESO
  copoKg: number; // kg vendido EM COPO (total − peso)
  copoCount: number; // nº de copos vendidos
  pesoCount: number; // nº de vendas por peso
};

const num = (v: unknown) => Number(v ?? 0);
const isPeso = (name: string) => /\d+\s*g\b/i.test(name || ""); // "Açaí 350g"
const isCopo = (name: string) => /copo/i.test(name || ""); // "Copo 500ml"
const gramsOf = (name: string) => { const m = /(\d+)\s*g\b/i.exec(name || ""); return m ? Number(m[1]) : 0; };
const polpaOf = (consumes: unknown): number => {
  const arr = Array.isArray(consumes) ? (consumes as { stockId?: string; qty?: number }[]) : [];
  const p = arr.find((c) => String(c.stockId) === WEIGHT_BASE_STOCK_ID);
  return p ? num(p.qty) : 0;
};

/** Vendas do insumo-base desde `sinceISO`. Balcão: order.consumes é o TOTAL do pedido (já × qty).
 *  Mesa: tab_order_items.consumes é POR-UNIDADE → × qty. Split copo/peso pelo nome do item. */
export async function weightSoldSince(sinceISO: string, storeId?: string, balcaoOrders?: Order[]): Promise<WeightSoldReport> {
  const sid = storeId ?? (await resolveStoreId());
  let totalKg = 0, pesoKg = 0, copoCount = 0, pesoCount = 0;

  // BALCÃO / PDV — reusa os pedidos já carregados pelo resumo (evita reler tudo)
  const orders = balcaoOrders ?? (await listOrders(sid)).filter((o) => o.mode === "balcao" && o.createdAt >= sinceISO);
  for (const o of orders) {
    totalKg += polpaOf(o.consumes);
    for (const it of o.items ?? []) {
      if (isPeso(it.name)) { pesoKg += (gramsOf(it.name) / 1000) * num(it.qty); pesoCount += num(it.qty); }
      else if (isCopo(it.name)) copoCount += num(it.qty);
    }
  }

  // MESA
  const d = db();
  const { data: tabOrders } = await d.from("tab_orders").select("id").eq("store_id", sid).gte("created_at", sinceISO);
  const ids = (tabOrders ?? []).map((t) => (t as { id: number }).id);
  if (ids.length) {
    const { data: items } = await d.from("tab_order_items").select("name, qty, consumes").in("tab_order_id", ids);
    for (const it of (items ?? []) as { name: string; qty: number; consumes: unknown }[]) {
      totalKg += polpaOf(it.consumes) * num(it.qty);
      if (isPeso(it.name)) { pesoKg += (gramsOf(it.name) / 1000) * num(it.qty); pesoCount += num(it.qty); }
      else if (isCopo(it.name)) copoCount += num(it.qty);
    }
  }

  const copoKg = Math.max(0, +(totalKg - pesoKg).toFixed(3));
  return { totalKg: +totalKg.toFixed(3), pesoKg: +pesoKg.toFixed(3), copoKg, copoCount, pesoCount };
}
