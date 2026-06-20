// CMV (Custo da Mercadoria Vendida) · cruza o que foi VENDIDO (tab_order_items) com o CUSTO
// dos insumos consumidos (ficha técnica gravada em consumes) × custo unitário do estoque.
// É a contrapartida da baixa automática: receita − custo dos insumos = margem bruta.
import { db } from "@/lib/supabase";
import { resolveStoreId } from "@/lib/auth/current";
import { listStock, unitCostCents } from "@/lib/stock-store";

const num = (v: unknown) => Number(v ?? 0);

export type CmvLine = { name: string; qty: number; revenueCents: number; cmvCents: number; marginCents: number };
export type CmvReport = {
  revenueCents: number;
  cmvCents: number;
  marginCents: number;
  marginPct: number; // margem / receita (0 se sem receita)
  cmvPct: number; // CMV / receita
  lines: CmvLine[]; // por produto, maior custo primeiro
};

/** Relatório de CMV no período (por data do pedido). Sem datas = tudo. */
export async function cmvReport(fromISO?: string, toISO?: string, storeId?: string): Promise<CmvReport> {
  const sid = storeId ?? (await resolveStoreId());
  const d = db();

  // custo unitário de cada insumo (dose = custo/garrafa ÷ doses; senão costCents)
  const stock = await listStock(sid);
  const costById = new Map(stock.map((s) => [s.id, unitCostCents(s)]));

  // pedidos do período
  let q = d.from("tab_orders").select("id, created_at").eq("store_id", sid);
  if (fromISO) q = q.gte("created_at", fromISO);
  if (toISO) q = q.lte("created_at", toISO);
  const { data: orders, error } = await q;
  if (error) throw new Error("Erro ao ler pedidos (CMV): " + error.message);
  const orderIds = (orders ?? []).map((o) => num((o as { id: number }).id));
  if (!orderIds.length) return { revenueCents: 0, cmvCents: 0, marginCents: 0, marginPct: 0, cmvPct: 0, lines: [] };

  // itens vendidos (com a ficha técnica consumida snapshot em consumes)
  const { data: items, error: e2 } = await d
    .from("tab_order_items")
    .select("name, qty, unit_price_cents, consumes")
    .in("tab_order_id", orderIds);
  if (e2) throw new Error("Erro ao ler itens (CMV): " + e2.message);

  const byName = new Map<string, CmvLine>();
  let revenueCents = 0;
  let cmvCents = 0;
  for (const it of (items ?? []) as { name: string; qty: number; unit_price_cents: number; consumes: unknown }[]) {
    const qty = num(it.qty);
    const rev = qty * num(it.unit_price_cents);
    const consumes = Array.isArray(it.consumes) ? (it.consumes as { stockId: string; qty: number }[]) : [];
    const unitCost = consumes.reduce((s, c) => s + num(c.qty) * (costById.get(String(c.stockId)) ?? 0), 0);
    const cmv = qty * unitCost;
    revenueCents += rev;
    cmvCents += cmv;
    const name = it.name || "—";
    const cur = byName.get(name) ?? { name, qty: 0, revenueCents: 0, cmvCents: 0, marginCents: 0 };
    cur.qty += qty;
    cur.revenueCents += rev;
    cur.cmvCents += cmv;
    cur.marginCents = cur.revenueCents - cur.cmvCents;
    byName.set(name, cur);
  }

  const marginCents = revenueCents - cmvCents;
  return {
    revenueCents,
    cmvCents,
    marginCents,
    marginPct: revenueCents ? Math.round((marginCents / revenueCents) * 100) : 0,
    cmvPct: revenueCents ? Math.round((cmvCents / revenueCents) * 100) : 0,
    lines: [...byName.values()].sort((a, b) => b.cmvCents - a.cmvCents),
  };
}
