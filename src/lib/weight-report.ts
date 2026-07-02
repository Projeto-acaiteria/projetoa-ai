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

type Acc = { totalKg: number; pesoKg: number; copoCount: number; pesoCount: number };
const zero = (): Acc => ({ totalKg: 0, pesoKg: 0, copoCount: 0, pesoCount: 0 });
const fin = (b: Acc): WeightSoldReport => ({
  totalKg: +b.totalKg.toFixed(3), pesoKg: +b.pesoKg.toFixed(3),
  copoKg: Math.max(0, +(b.totalKg - b.pesoKg).toFixed(3)), copoCount: b.copoCount, pesoCount: b.pesoCount,
});

/** Açaí vendido em 3 janelas de uma vez (HOJE, últimos 7 DIAS, este MÊS) — o Vidal só quer o kg.
 *  Lê pedidos/itens UMA vez (desde a janela mais antiga) e distribui em cada balde. */
export async function weightSoldPeriods(storeId?: string): Promise<{ hoje: WeightSoldReport; semana: WeightSoldReport; mes: WeightSoldReport }> {
  const sid = storeId ?? (await resolveStoreId());
  const now = new Date();
  const diaISO = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const semanaISO = new Date(now.getTime() - 7 * 86400000).toISOString();
  const mesISO = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const earliest = [diaISO, semanaISO, mesISO].sort()[0];

  const b = { hoje: zero(), semana: zero(), mes: zero() };
  const addTo = (at: string, add: (acc: Acc) => void) => {
    if (at >= diaISO) add(b.hoje);
    if (at >= semanaISO) add(b.semana);
    if (at >= mesISO) add(b.mes);
  };
  const tallyItem = (acc: Acc, name: string, qty: number) => {
    if (isPeso(name)) { acc.pesoKg += (gramsOf(name) / 1000) * qty; acc.pesoCount += qty; }
    else if (isCopo(name)) acc.copoCount += qty;
  };

  // BALCÃO
  const orders = (await listOrders(sid)).filter((o) => o.mode === "balcao" && o.createdAt >= earliest);
  for (const o of orders) addTo(o.createdAt, (acc) => {
    acc.totalKg += polpaOf(o.consumes);
    for (const it of o.items ?? []) tallyItem(acc, it.name, num(it.qty));
  });

  // MESA
  const d = db();
  const { data: tabOrders } = await d.from("tab_orders").select("id, created_at").eq("store_id", sid).gte("created_at", earliest);
  const atById = new Map((tabOrders ?? []).map((t) => [(t as { id: number }).id, (t as { created_at: string }).created_at]));
  const ids = [...atById.keys()];
  if (ids.length) {
    const { data: items } = await d.from("tab_order_items").select("tab_order_id, name, qty, consumes").in("tab_order_id", ids);
    for (const it of (items ?? []) as { tab_order_id: number; name: string; qty: number; consumes: unknown }[]) {
      const at = atById.get(it.tab_order_id);
      if (!at) continue;
      addTo(at, (acc) => { acc.totalKg += polpaOf(it.consumes) * num(it.qty); tallyItem(acc, it.name, num(it.qty)); });
    }
  }

  return { hoje: fin(b.hoje), semana: fin(b.semana), mes: fin(b.mes) };
}
