// Controle de estoque · insumos e produtos (arquivo JSON, vira tabela no Supabase).
// Cobre o que os concorrentes (Consumer, Saipos, Sischef) fazem: quantidade,
// estoque mínimo (alerta de baixa), validade (alerta de vencimento / FIFO) e
// movimentação (entrada/saída). Baixa automática por ficha técnica = evolução.
import { db } from "@/lib/supabase";
import { resolveStoreId } from "@/lib/auth/current";
import { getStoreConfig } from "@/lib/auth/store-config";

// Universo multi-segmento (açaí, bar, lanchonete, restaurante), em 3 famílias (a cor da UI vem da família):
export type StockCategory =
  // Produtos à venda (revenda — têm preço de venda)
  | "sorvete" | "picole" | "bebida" | "bebida_alcoolica" | "salgado" | "doce"
  // Insumos de produção (pra montar açaí/lanche/prato)
  | "polpa" | "fruta" | "cereal" | "cobertura" | "adicional"
  | "proteina" | "paes_massas" | "laticinio" | "mercearia"
  // Operação
  | "embalagem" | "limpeza" | "outro"
  // Hardware / informática (loja de PC/games — vertical assistência técnica/varejo)
  | "computadores" | "cpu" | "cooler" | "mobo" | "ram" | "gpu" | "ssd"
  | "gabinete" | "fonte" | "mouse" | "teclado" | "mousepad" | "monitor" | "headset" | "cadeira";

// categoria do movimento (pra relatório de perda/desperdício separar do uso normal)
export type StockMoveKind = "compra" | "uso" | "consumo" | "perda" | "vencido" | "quebra" | "ajuste" | "outro";
export type StockMove = {
  type: "entrada" | "saida";
  qty: number;
  reason: string;
  kind?: StockMoveKind;
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
  supplier?: string; // fornecedor (filtrar compras/perdas por fornecedor)
  purchaseUnit?: string; // unidade de COMPRA (ex: fardo, caixa, saco) — opcional
  purchaseFactor?: number; // 1 unidade de compra = purchaseFactor unidades de uso (ex: 1 caixa = 12 un)
  updatedAt: string;
  history: StockMove[];
  // specs técnicas (hardware: socket, tdp, ram_type, watts, form, length_mm, igpu…) — usado pelo montador de PC
  specs?: Record<string, string | number | boolean | string[]>;
  brand?: string; // marca (hardware) — filtro/exibição
  // vitrine (site headless AT): destaque, selo e foto real do produto
  highlight?: boolean;
  badge?: string; // ex: "Lançamento", "Mais Vendido", "Promo", "OpenBox"
  image?: string; // URL da foto real (Storage) — senão o site usa SVG por categoria
  published?: boolean; // aparece no site (vitrine). default undefined/false = rascunho (não publicado)
  description?: string; // descrição rica pro site/SEO (Markdown). senão o site mostra só as specs
};

// linha da ficha técnica consumida na venda. costCents é o custo CONGELADO no momento da venda
// (snapshot) — sem ele o CMV histórico mudaria toda vez que o custo do insumo fosse editado.
export type Consume = { stockId: string; qty: number; costCents?: number };

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
  // Sem rows (1ª vez): o estoque-demo é de AÇAÍ → só faz sentido em loja template "acai".
  // bar/grid começam VAZIAS (o dono cadastra os próprios insumos). Senão um bar via insumo de
  // açaí, e pior: ficha técnica apontava pra item-seed que SUMIA quando entrava a 1ª row real
  // (vira "insumo removido"). [achado do teste CIC, etapa 3]
  const cfg = await getStoreConfig(sid);
  return cfg?.menu_template === "acai" ? seedClone() : [];
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
  // o item pode ainda não existir no banco (estado seed) — readAll acha o seed e dá a base/existência
  const all = await readAll(sid);
  const cur = all.find((x) => x.id === id);
  if (!cur) return null;
  // baixa ATÔMICA no servidor (RPC move_stock, mt-22): upsert com lock de linha aplica o delta
  // sobre o valor SEMPRE fresco → não perde vendas simultâneas do mesmo insumo (antes era
  // read-modify-write num blob). p_base só é usado se a row ainda não existir (estado seed).
  const { data, error } = await db().rpc("move_stock", {
    p_store_id: sid, p_id: id, p_type: type, p_qty: Math.abs(qty), p_reason: reason, p_at: at, p_base: cur,
  });
  if (error) throw new Error("Falha ao movimentar estoque: " + error.message);
  return data as StockItem;
}

/** Baixa NÃO-FATAL de estoque pela ficha técnica. A venda/comanda já está commitada quando isto
 *  roda, então uma falha de baixa NUNCA pode derrubar nem duplicar a venda: cada item é isolado
 *  (um erro não aborta os outros), `moveStock`=null (insumo inexistente) também vira falha (não
 *  some em silêncio), e tudo é logado com contexto. O `consumes[]` do pedido é a fonte da verdade
 *  e o inventário concilia a deriva. NUNCA lança. storeId explícito é obrigatório no caminho público. */
export async function applyConsumes(
  consumes: { stockId: string; qty: number }[],
  reason: string,
  at: string,
  storeId?: string,
): Promise<{ applied: number; failed: { stockId: string; qty: number; error: string }[] }> {
  const failed: { stockId: string; qty: number; error: string }[] = [];
  let applied = 0;
  for (const c of consumes) {
    if (!c.stockId || !(c.qty > 0)) continue;
    try {
      const item = await moveStock(c.stockId, "saida", c.qty, reason, at, storeId);
      if (item) applied++;
      else failed.push({ stockId: c.stockId, qty: c.qty, error: "item de estoque não encontrado" });
    } catch (e) {
      failed.push({ stockId: c.stockId, qty: c.qty, error: e instanceof Error ? e.message : String(e) });
    }
  }
  if (failed.length) console.error(`applyConsumes: ${failed.length} baixa(s) falharam (${reason}):`, JSON.stringify(failed));
  return { applied, failed };
}

/** Congela o custo unitário de cada insumo no `consumes`, no momento da venda. Assim o CMV
 *  histórico NÃO muda quando o custo do insumo é editado depois (snapshot). Lê o estoque 1x. */
export async function snapshotConsumes(consumes: { stockId: string; qty: number }[], storeId?: string): Promise<Consume[]> {
  const clean = (consumes ?? []).filter((c) => c?.stockId && c.qty > 0).map((c) => ({ stockId: c.stockId, qty: c.qty }));
  if (!clean.length) return [];
  // NÃO-LANÇANTE: roda no caminho de venda. Se o estoque falhar de ler, devolve o consumes
  // SEM custo (cmv-store cai no custo atual) — nunca deixa o snapshot derrubar uma venda.
  try {
    const stock = await listStock(storeId);
    const costById = new Map(stock.map((s) => [s.id, unitCostCents(s)]));
    return clean.map((c) => ({ ...c, costCents: costById.get(c.stockId) ?? 0 }));
  } catch (e) {
    console.error("snapshotConsumes: falha ao congelar custo (segue sem custo):", e instanceof Error ? e.message : e);
    return clean;
  }
}

/** Custo médio ponderado: ao dar ENTRADA de `inQty` a `inUnitCostCents`, recalcula o custo unitário
 *  misturando com o saldo antigo. (newQty já inclui a entrada — qty velha = newQty − inQty.) */
export async function reweightCost(id: string, newQty: number, inQty: number, inUnitCostCents: number, at: string, storeId?: string): Promise<StockItem | null> {
  if (!(inUnitCostCents > 0) || !(inQty > 0)) return null;
  const sid = storeId ?? (await resolveStoreId());
  const all = await readAll(sid);
  const cur = all.find((x) => x.id === id);
  if (!cur) return null;
  const oldQty = Math.max(0, +(newQty - inQty).toFixed(3));
  const oldCost = unitCostCents(cur);
  const total = oldQty + inQty;
  const avg = total > 0 ? Math.round((oldQty * oldCost + inQty * inUnitCostCents) / total) : inUnitCostCents;
  // dose/garrafa guarda custo por garrafa; senão custo por unidade
  const patch = cur.dosesPerBottle && cur.dosesPerBottle > 0
    ? { costPerBottleCents: avg * cur.dosesPerBottle }
    : { costCents: avg };
  return updateItem(id, patch, at);
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
