// Controle de estoque · insumos e produtos (arquivo JSON, vira tabela no Supabase).
// Cobre o que os concorrentes (Consumer, Saipos, Sischef) fazem: quantidade,
// estoque mínimo (alerta de baixa), validade (alerta de vencimento / FIFO) e
// movimentação (entrada/saída). Baixa automática por ficha técnica = evolução.
import { db } from "@/lib/supabase";

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
  unit: string; // kg, g, L, un...
  minQty: number; // alerta de estoque baixo
  expiry?: string; // YYYY-MM-DD (validade do lote atual)
  sellPriceCents?: number; // preço de venda (só p/ produtos de revenda)
  updatedAt: string;
  history: StockMove[];
};

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

async function readAll(): Promise<StockItem[]> {
  const { data, error } = await db().from("stock_items").select("data");
  if (error) throw new Error("Erro ao ler estoque: " + error.message); // nunca tratar erro como vazio
  const list = (data ?? []).map((r) => (r as { data: StockItem }).data);
  if (list.length) return list;
  // query OK e vazia → primeira vez: devolve o seed clonado (comportamento de SEED preservado)
  return seedClone();
}

export async function listStock(): Promise<StockItem[]> {
  return (await readAll()).sort((a, b) => a.name.localeCompare(b.name));
}

export type NewStockItem = Omit<StockItem, "id" | "updatedAt" | "history">;

export async function addItem(input: NewStockItem, at: string): Promise<StockItem> {
  const item: StockItem = {
    ...input,
    id: "s" + Math.random().toString(36).slice(2, 9),
    updatedAt: at,
    history: [],
  };
  const { error } = await db().from("stock_items").upsert({ id: item.id, data: item });
  if (error) throw new Error("Falha ao criar item: " + error.message);
  return item;
}

export async function updateItem(id: string, patch: Partial<StockItem>, at: string): Promise<StockItem | null> {
  // o item pode ainda não existir no banco (estado seed) — usa readAll p/ achar o seed também
  const all = await readAll();
  const cur = all.find((x) => x.id === id);
  if (!cur) return null;
  const item: StockItem = { ...cur, ...patch, id, updatedAt: at };
  const { error } = await db().from("stock_items").upsert({ id, data: item });
  if (error) throw new Error("Falha ao atualizar item: " + error.message);
  return item;
}

export async function moveStock(id: string, type: "entrada" | "saida", qty: number, reason: string, at: string): Promise<StockItem | null> {
  // o item pode ainda não existir no banco (estado seed) — usa readAll p/ achar o seed também
  const all = await readAll();
  const cur = all.find((x) => x.id === id);
  if (!cur) return null;
  const delta = type === "entrada" ? Math.abs(qty) : -Math.abs(qty);
  const item: StockItem = {
    ...cur,
    qty: Math.max(0, +(cur.qty + delta).toFixed(3)),
    updatedAt: at,
    history: [{ type, qty: Math.abs(qty), reason, at }, ...cur.history],
  };
  const { error } = await db().from("stock_items").upsert({ id, data: item });
  if (error) throw new Error("Falha ao movimentar estoque: " + error.message);
  return item;
}

export async function removeItem(id: string): Promise<void> {
  const { error } = await db().from("stock_items").delete().eq("id", id); // delete por-id pontual é OK
  if (error) throw new Error("Falha ao remover item: " + error.message);
}
