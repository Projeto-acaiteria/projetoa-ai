// Controle de estoque · insumos e produtos (arquivo JSON, vira tabela no Supabase).
// Cobre o que os concorrentes (Consumer, Saipos, Sischef) fazem: quantidade,
// estoque mínimo (alerta de baixa), validade (alerta de vencimento / FIFO) e
// movimentação (entrada/saída). Baixa automática por ficha técnica = evolução.
import { db } from "@/lib/supabase";
import { resolveStoreId } from "@/lib/auth/current";

// Universo de uma açaiteria, em 3 famílias (a cor da UI vem da família):
export type StockCategory =
  // Produtos à venda (revenda — têm preço de venda)
  | "sorvete" | "picole" | "bebida" | "salgado" | "doce"
  // Insumos de produção (pra montar açaí/sorvete)
  | "polpa" | "fruta" | "cereal" | "cobertura" | "adicional"
  // Operação
  | "embalagem" | "limpeza" | "outro";

export type StockMove = {
  type: "entrada" | "saida";
  qty: number;
  reason: string;
  at: string;
};

export type StockItem = {
  id: string;
  name: string;
  category: StockCategory;
  qty: number;
  unit: string; // kg, g, L, un... (com dose/garrafa, qty = nº de DOSES)
  minQty: number; // alerta de estoque baixo
  expiry?: string; // YYYY-MM-DD (validade do lote atual)
  sellPriceCents?: number; // preço de venda (só p/ produtos de revenda)
  // bar (opt-in): destilado controlado em DOSE/GARRAFA. qty fica em doses; entrada por garrafa
  // soma dosesPerBottle. garrafas = qty / dosesPerBottle. custoPorGarrafa pro CMV.
  dosesPerBottle?: number;
  costPerBottleCents?: number;
  costCents?: number; // custo por UNIDADE do insumo (kg/un/L...) — base do CMV (ficha técnica)
  updatedAt: string;
  history: StockMove[];
};

/** Custo de UMA unidade consumida (a mesma unidade da ficha técnica). Dose = custo/garrafa ÷ doses. */
export function unitCostCents(item: Pick<StockItem, "dosesPerBottle" | "costPerBottleCents" | "costCents">): number {
  if (item.dosesPerBottle && item.dosesPerBottle > 0 && item.costPerBottleCents) {
    return Math.round(item.costPerBottleCents / item.dosesPerBottle);
  }
  return Math.max(0, Math.round(item.costCents ?? 0));
}

// Seed de exemplo (demonstra os 3 grupos + alertas: vencendo, baixo, normal)
const SEED: StockItem[] = [
  // Produtos à venda
  { id: "sorvetepote", name: "Sorvete pote 2L (creme)", category: "sorvete", qty: 6, unit: "un", minQty: 3, expiry: "2026-10-01", sellPriceCents: 2500, updatedAt: "2026-06-11", history: [] },
  { id: "picole", name: "Picolé de açaí", category: "picole", qty: 18, unit: "un", minQty: 10, expiry: "2026-09-15", sellPriceCents: 600, updatedAt: "2026-06-11", history: [] },
  { id: "refri", name: "Refrigerante lata", category: "bebida", qty: 30, unit: "un", minQty: 12, expiry: "2027-02-01", sellPriceCents: 600, updatedAt: "2026-06-11", history: [] },
  { id: "agua", name: "Água mineral", category: "bebida", qty: 24, unit: "un", minQty: 12, expiry: "2027-05-01", sellPriceCents: 300, updatedAt: "2026-06-11", history: [] },
  // Insumos de produção
  { id: "polpa", name: "Polpa de açaí", category: "polpa", qty: 12, unit: "kg", minQty: 5, expiry: "2026-06-20", updatedAt: "2026-06-11", history: [] },
  { id: "banana", name: "Banana", category: "fruta", qty: 2, unit: "kg", minQty: 3, expiry: "2026-06-13", updatedAt: "2026-06-11", history: [] },
  { id: "granola", name: "Granola", category: "cereal", qty: 3, unit: "kg", minQty: 2, expiry: "2026-09-01", updatedAt: "2026-06-11", history: [] },
  { id: "leitecond", name: "Leite condensado", category: "cobertura", qty: 8, unit: "un", minQty: 4, expiry: "2027-01-10", updatedAt: "2026-06-11", history: [] },
  { id: "ninho", name: "Leite Ninho", category: "adicional", qty: 1.5, unit: "kg", minQty: 1, expiry: "2026-12-01", updatedAt: "2026-06-11", history: [] },
  // Operação
  { id: "copo500", name: "Copo 500ml", category: "embalagem", qty: 220, unit: "un", minQty: 100, updatedAt: "2026-06-11", history: [] },
  { id: "colher", name: "Colher descartável", category: "embalagem", qty: 80, unit: "un", minQty: 100, updatedAt: "2026-06-11", history: [] },
];

function seedClone(): StockItem[] {
  // clone do seed — nunca retornar a referência da constante (mutações
  // em moveStock/addItem corromperiam o default em memória)
  return JSON.parse(JSON.stringify(SEED)) as StockItem[];
}

async function readAll(storeId?: string): Promise<StockItem[]> {
  const sid = storeId ?? (await resolveStoreId());
  const { data, error } = await db().from("stock_items").select("data").eq("store_id", sid);
  if (error) throw new Error("Erro ao ler estoque: " + error.message); // nunca tratar erro como vazio
  const list = (data ?? []).map((r) => (r as { data: StockItem }).data);
  if (list.length) return list;
  // query OK e vazia → primeira vez: devolve o seed clonado (comportamento de SEED preservado)
  return seedClone();
}

export async function listStock(storeId?: string): Promise<StockItem[]> {
  return (await readAll(storeId)).sort((a, b) => a.name.localeCompare(b.name));
}

export type NewStockItem = Omit<StockItem, "id" | "updatedAt" | "history">;

export async function addItem(input: NewStockItem, at: string): Promise<StockItem> {
  const item: StockItem = {
    ...input,
    id: "s" + Math.random().toString(36).slice(2, 9),
    updatedAt: at,
    history: [],
  };
  const sid = await resolveStoreId();
  const { error } = await db().from("stock_items").upsert({ store_id: sid, id: item.id, data: item });
  if (error) throw new Error("Falha ao criar item: " + error.message);
  return item;
}

export async function updateItem(id: string, patch: Partial<StockItem>, at: string): Promise<StockItem | null> {
  // o item pode ainda não existir no banco (estado seed) — usa readAll p/ achar o seed também
  const all = await readAll();
  const cur = all.find((x) => x.id === id);
  if (!cur) return null;
  const item: StockItem = { ...cur, ...patch, id, updatedAt: at };
  const sid = await resolveStoreId();
  const { error } = await db().from("stock_items").upsert({ store_id: sid, id, data: item });
  if (error) throw new Error("Falha ao atualizar item: " + error.message);
  return item;
}

export async function moveStock(id: string, type: "entrada" | "saida", qty: number, reason: string, at: string, storeId?: string): Promise<StockItem | null> {
  // storeId explícito é OBRIGATÓRIO no caminho público (pedido pela mesa, sem auth) — senão
  // resolveStoreId cai na loja errada, o item não é achado e a baixa falha em silêncio.
  const sid = storeId ?? (await resolveStoreId());
  // o item pode ainda não existir no banco (estado seed) — usa readAll p/ achar o seed também
  const all = await readAll(sid);
  const cur = all.find((x) => x.id === id);
  if (!cur) return null;
  const delta = type === "entrada" ? Math.abs(qty) : -Math.abs(qty);
  const item: StockItem = {
    ...cur,
    qty: Math.max(0, +(cur.qty + delta).toFixed(3)),
    updatedAt: at,
    history: [{ type, qty: Math.abs(qty), reason, at }, ...cur.history],
  };
  const { error } = await db().from("stock_items").upsert({ store_id: sid, id, data: item });
  if (error) throw new Error("Falha ao movimentar estoque: " + error.message);
  return item;
}

/** Entrada por GARRAFA (item dose/garrafa): soma bottles × dosesPerBottle ao estoque em doses. */
export async function addBottles(id: string, bottles: number, at: string): Promise<StockItem | null> {
  const all = await readAll();
  const cur = all.find((x) => x.id === id);
  if (!cur || !cur.dosesPerBottle) return null;
  const doses = Math.round(Math.abs(bottles) * cur.dosesPerBottle);
  return moveStock(id, "entrada", doses, `Entrada ${bottles} garrafa(s)`, at);
}

/** Ajuste por CONTAGEM (inventário): seta o estoque ao valor REAL contado e loga a diferença
 *  (sobra = entrada, falta = saída) como "Ajuste inventário". Retorna o delta aplicado (real − teórico). */
export async function adjustToCount(id: string, realQty: number, at: string, storeId?: string): Promise<{ item: StockItem; deltaQty: number } | null> {
  const sid = storeId ?? (await resolveStoreId());
  const all = await readAll(sid);
  const cur = all.find((x) => x.id === id);
  if (!cur) return null;
  const real = Math.max(0, +Number(realQty).toFixed(3));
  const deltaQty = +(real - cur.qty).toFixed(3);
  if (deltaQty === 0) return { item: cur, deltaQty: 0 };
  const type = deltaQty > 0 ? "entrada" : "saida";
  const item = await moveStock(id, type, Math.abs(deltaQty), "Ajuste inventário", at, sid);
  return item ? { item, deltaQty } : null;
}

/** Foto do desvio (descasamento) de inventário: teórico × real × diferença, com valor em R$ pelo custo.
 *  counts = {id: realQty}. Só itens contados entram. faltaCents/sobraCents pra fechar a quebra. */
export type InventoryDiffLine = {
  id: string; name: string; unit: string;
  theoreticalQty: number; realQty: number; deltaQty: number;
  unitCostCents: number; deltaValueCents: number; // negativo = falta (perda), positivo = sobra
};
export type InventoryDiff = {
  lines: InventoryDiffLine[];
  faltaCents: number; // perda total (|deltas negativos| × custo)
  sobraCents: number; // sobra total
  liquidoCents: number; // sobra − falta
};

export async function inventoryDiff(counts: Record<string, number>, storeId?: string): Promise<InventoryDiff> {
  const sid = storeId ?? (await resolveStoreId());
  const all = await readAll(sid);
  const byId = new Map(all.map((x) => [x.id, x]));
  const lines: InventoryDiffLine[] = [];
  let faltaCents = 0, sobraCents = 0;
  for (const [id, raw] of Object.entries(counts)) {
    const cur = byId.get(id);
    if (!cur) continue;
    const real = Math.max(0, +Number(raw).toFixed(3));
    const deltaQty = +(real - cur.qty).toFixed(3);
    const uc = unitCostCents(cur);
    const deltaValueCents = Math.round(deltaQty * uc);
    if (deltaValueCents < 0) faltaCents += -deltaValueCents;
    else sobraCents += deltaValueCents;
    lines.push({ id, name: cur.name, unit: cur.unit, theoreticalQty: cur.qty, realQty: real, deltaQty, unitCostCents: uc, deltaValueCents });
  }
  lines.sort((a, b) => a.deltaValueCents - b.deltaValueCents); // maiores perdas primeiro
  return { lines, faltaCents, sobraCents, liquidoCents: sobraCents - faltaCents };
}

export async function removeItem(id: string): Promise<void> {
  const sid = await resolveStoreId();
  const { error } = await db().from("stock_items").delete().eq("store_id", sid).eq("id", id);
  if (error) throw new Error("Falha ao remover item: " + error.message);
}
