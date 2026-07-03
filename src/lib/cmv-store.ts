// CMV (Custo da Mercadoria Vendida) · cruza o que foi VENDIDO (tab_order_items) com o CUSTO
// dos insumos consumidos (ficha técnica gravada em consumes) × custo unitário do estoque.
// É a contrapartida da baixa automática: receita − custo dos insumos = margem bruta.
import { db } from "@/lib/supabase";
import { resolveStoreId } from "@/lib/auth/current";
import { listStock, unitCostCents } from "@/lib/stock-store";
import { listOrders } from "@/lib/orders-store";

const num = (v: unknown) => Number(v ?? 0);

// Venda por PESO entra com o nome embutindo as gramas exatas ("Açaí 559g") → cada pesagem vira
// um nome único e polui o relatório com dezenas de linhas QTD 1, todas na mesma margem. Agrupa
// todas numa linha só. Copo fixo/delivery têm nome próprio ("Copo 350ml") e seguem separados.
const PESO_NAME_RE = /^a[çc]a[íi]\s+\d+\s*g$/i;
const cmvGroupName = (raw?: string): string => {
  const n = (raw ?? "").trim();
  return PESO_NAME_RE.test(n) ? "Açaí (por peso)" : n || "—";
};

export type CmvLine = { name: string; qty: number; revenueCents: number; cmvCents: number; marginCents: number };
export type CmvReport = {
  revenueCents: number;
  cmvCents: number;
  marginCents: number;
  marginPct: number; // margem / receita (0 se sem receita)
  cmvPct: number; // CMV / receita
  lines: CmvLine[]; // por produto, maior custo primeiro
  missingCostItems: string[]; // insumos consumidos no período SEM custo cadastrado (margem fica falsa/cheia)
};

/** Relatório de CMV no período (por data do pedido). Sem datas = tudo. */
export async function cmvReport(fromISO?: string, toISO?: string, storeId?: string): Promise<CmvReport> {
  const sid = storeId ?? (await resolveStoreId());
  const d = db();

  // custo unitário ATUAL de cada insumo (fallback p/ vendas antigas sem custo congelado)
  const stock = await listStock(sid);
  const costById = new Map(stock.map((s) => [s.id, unitCostCents(s)]));
  const nameById = new Map(stock.map((s) => [s.id, s.name]));
  const missingCost = new Set<string>(); // ids de insumo vendidos sem custo (congelado nem atual)

  // Complementos de montagem (frutas, cremes/caldas, crocantes, doces, adicionais, sabor da polpa) vão
  // EMBUTIDOS no peso/copo do açaí — não são produtos avulsos. Ficam fora do "por produto" pra não poluir
  // a lista (regra do Vidal 03/07). Classifica pela categoria do estoque → vale pra qualquer loja.
  const SKIP_CATS = new Set(["fruta", "cereal", "cobertura", "doce", "adicional", "polpa"]);
  const catByName = new Map(stock.map((s) => [s.name.trim().toLowerCase(), s.category]));
  const isComplemento = (raw?: string): boolean => {
    const cat = catByName.get((raw ?? "").trim().toLowerCase());
    return cat != null && SKIP_CATS.has(cat);
  };

  // pedidos do período
  let q = d.from("tab_orders").select("id, created_at").eq("store_id", sid);
  if (fromISO) q = q.gte("created_at", fromISO);
  if (toISO) q = q.lte("created_at", toISO);
  const { data: orders, error } = await q;
  if (error) throw new Error("Erro ao ler pedidos (CMV): " + error.message);
  const orderIds = (orders ?? []).map((o) => num((o as { id: number }).id));

  const byName = new Map<string, CmvLine>();
  let revenueCents = 0;
  let cmvCents = 0;

  // MESA (tab_order_items): só processa se houver comanda de mesa no período.
  // NÃO retornar cedo aqui — loja só-balcão (sem mesa) tem as vendas no `orders` (bloco abaixo).
  // (bug corrigido 03/07: o early-return zerava o CMV de quem não usa mesa)
  if (orderIds.length) {
    const { data: items, error: e2 } = await d
      .from("tab_order_items")
      .select("name, qty, unit_price_cents, consumes")
      .in("tab_order_id", orderIds);
    if (e2) throw new Error("Erro ao ler itens (CMV): " + e2.message);
    for (const it of (items ?? []) as { name: string; qty: number; unit_price_cents: number; consumes: unknown }[]) {
      if (isComplemento(it.name)) continue; // complemento de montagem: não é linha de produto
      const qty = num(it.qty);
      const rev = qty * num(it.unit_price_cents);
      const consumes = Array.isArray(it.consumes) ? (it.consumes as { stockId: string; qty: number; costCents?: number }[]) : [];
      const unitCost = consumes.reduce((s, c) => {
        // custo CONGELADO na venda (snapshot); ausente OU zero (base sem custo na hora) → cai no custo atual
        const cc = c.costCents != null && c.costCents > 0 ? c.costCents : (costById.get(String(c.stockId)) ?? 0);
        if (!(cc > 0) && num(c.qty) > 0) missingCost.add(String(c.stockId));
        return s + num(c.qty) * cc;
      }, 0);
      const cmv = qty * unitCost;
      revenueCents += rev;
      cmvCents += cmv;
      const name = cmvGroupName(it.name);
      const cur = byName.get(name) ?? { name, qty: 0, revenueCents: 0, cmvCents: 0, marginCents: 0 };
      cur.qty += qty;
      cur.revenueCents += rev;
      cur.cmvCents += cmv;
      cur.marginCents = cur.revenueCents - cur.cmvCents;
      byName.set(name, cur);
    }
  }

  // Balcão / PDV / delivery (orders-store) — o CMV de mesa (tab_order_items acima) NÃO os cobre.
  // O consumes é agregado por PEDIDO; distribui o custo entre os itens por participação na receita.
  const storeOrders = (await listOrders(sid)).filter((o) => {
    const at = o.createdAt || "";
    if (fromISO && at < fromISO) return false;
    if (toISO && at > toISO) return false;
    return true;
  });
  for (const o of storeOrders) {
    const cons = Array.isArray(o.consumes) ? (o.consumes as { stockId: string; qty: number; costCents?: number }[]) : [];
    const orderCmv = cons.reduce((s, c) => {
      const cc = c.costCents != null && c.costCents > 0 ? c.costCents : (costById.get(String(c.stockId)) ?? 0);
      if (!(cc > 0) && num(c.qty) > 0) missingCost.add(String(c.stockId));
      return s + num(c.qty) * cc;
    }, 0);
    const rawIts = Array.isArray(o.items) ? o.items : [];
    const its = rawIts.filter((it) => !isComplemento((it as { name?: string }).name));
    if (rawIts.length && !its.length) continue; // pedido só de complementos (ex: copo teste sem base): ignora
    const orderRev = its.reduce((s, it) => s + num(it.paidCents), 0);
    if (!its.length) { cmvCents += orderCmv; continue; } // pedido sem itens detalhados: só soma o custo
    for (const it of its) {
      const rev = num(it.paidCents);
      const lineCmv = orderRev > 0 ? Math.round(orderCmv * (rev / orderRev)) : 0;
      revenueCents += rev;
      cmvCents += lineCmv;
      const name = cmvGroupName(it.name);
      const cur = byName.get(name) ?? { name, qty: 0, revenueCents: 0, cmvCents: 0, marginCents: 0 };
      cur.qty += num(it.qty);
      cur.revenueCents += rev;
      cur.cmvCents += lineCmv;
      cur.marginCents = cur.revenueCents - cur.cmvCents;
      byName.set(name, cur);
    }
  }

  const marginCents = revenueCents - cmvCents;
  return {
    revenueCents,
    cmvCents,
    marginCents,
    marginPct: revenueCents ? Math.round((marginCents / revenueCents) * 100) : 0,
    cmvPct: revenueCents ? Math.round((cmvCents / revenueCents) * 100) : 0,
    lines: [...byName.values()].sort((a, b) => b.cmvCents - a.cmvCents),
    missingCostItems: [...missingCost].map((id) => nameById.get(id) ?? id).sort((a, b) => a.localeCompare(b)),
  };
}
