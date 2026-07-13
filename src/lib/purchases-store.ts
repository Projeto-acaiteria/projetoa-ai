// Compras / reposição de estoque (vertical SERVICE). Pedido de compra → ao RECEBER, dá entrada no
// estoque (itens ligados a um produto) e gera uma despesa (contas a pagar simples). Service-only.
import { db } from "@/lib/supabase";
import { resolveStoreId } from "@/lib/auth/current";
import { moveStock, updateItem } from "@/lib/stock-store";
import { addExpense } from "@/lib/expense-store";

export type PurchaseItem = {
  stockId?: string | null; // SKU do produto no estoque (vazio = item avulso, não mexe no estoque)
  name: string;
  qty: number;
  unitCostCents: number;
};
export type PurchaseStatus = "pendente" | "recebida";
export type Purchase = {
  id: string;
  code: string;
  fornecedor: string;
  nfNumber: string | null;
  items: PurchaseItem[];
  freteCents: number;
  notes: string | null;
  date: string; // YYYY-MM-DD
  status: PurchaseStatus;
  receivedAt: string | null;
  createdAt: string;
};

const num = (v: unknown) => Math.max(0, Math.round(Number(v ?? 0)));

export function purchaseTotalCents(p: Pick<Purchase, "items" | "freteCents">): number {
  const itens = (p.items ?? []).reduce((s, it) => s + num(it.qty) * num(it.unitCostCents), 0);
  return itens + num(p.freteCents);
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function genCode(): string {
  let s = "PC";
  for (let i = 0; i < 6; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return s;
}

const sanitizeItems = (raw: unknown): PurchaseItem[] =>
  (Array.isArray(raw) ? raw : [])
    .map((r) => {
      const o = (r ?? {}) as Record<string, unknown>;
      return {
        stockId: o.stockId ? String(o.stockId) : null,
        name: String(o.name ?? "").trim().slice(0, 120),
        qty: Math.max(1, Math.round(Number(o.qty ?? 1))),
        unitCostCents: num(o.unitCostCents),
      } as PurchaseItem;
    })
    .filter((it) => it.name);

export async function listPurchases(storeId?: string): Promise<Purchase[]> {
  const sid = storeId ?? (await resolveStoreId());
  const { data, error } = await db().from("purchases").select("data").eq("store_id", sid);
  if (error) throw new Error("Erro ao ler compras: " + error.message);
  return ((data ?? []) as { data: Purchase }[]).map((r) => r.data).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getPurchase(id: string, storeId?: string): Promise<Purchase | null> {
  const sid = storeId ?? (await resolveStoreId());
  const { data } = await db().from("purchases").select("data").eq("store_id", sid).eq("id", id).maybeSingle();
  return data ? (data as { data: Purchase }).data : null;
}

export type NewPurchaseInput = {
  fornecedor?: string;
  nfNumber?: string;
  items: unknown;
  freteCents?: number;
  notes?: string;
  date?: string;
};

export async function createPurchase(input: NewPurchaseInput, storeId?: string): Promise<Purchase> {
  const sid = storeId ?? (await resolveStoreId());
  const now = new Date().toISOString();
  const p: Purchase = {
    id: "pc" + Math.random().toString(36).slice(2, 10),
    code: genCode(),
    fornecedor: input.fornecedor?.trim() || "Fornecedor",
    nfNumber: input.nfNumber?.trim() || null,
    items: sanitizeItems(input.items),
    freteCents: num(input.freteCents),
    notes: input.notes?.trim() || null,
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(input.date ?? "")) ? String(input.date) : now.slice(0, 10),
    status: "pendente",
    receivedAt: null,
    createdAt: now,
  };
  const { error } = await db().from("purchases").insert({ id: p.id, store_id: sid, data: p });
  if (error) throw new Error("Falha ao criar compra: " + error.message);
  return p;
}

export async function updatePurchase(id: string, input: NewPurchaseInput, storeId?: string): Promise<Purchase> {
  const sid = storeId ?? (await resolveStoreId());
  const cur = await getPurchase(id, sid);
  if (!cur) throw new Error("Compra não encontrada.");
  if (cur.status === "recebida") throw new Error("Compra já recebida não pode ser editada.");
  const p: Purchase = {
    ...cur,
    fornecedor: input.fornecedor?.trim() || cur.fornecedor,
    nfNumber: input.nfNumber?.trim() || null,
    items: sanitizeItems(input.items),
    freteCents: num(input.freteCents),
    notes: input.notes?.trim() || null,
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(input.date ?? "")) ? String(input.date) : cur.date,
  };
  const { error } = await db().from("purchases").update({ data: p }).eq("id", id).eq("store_id", sid);
  if (error) throw new Error("Falha ao salvar compra: " + error.message);
  return p;
}

/** Recebe a compra: entrada no estoque (itens com SKU) + atualiza custo + gera despesa. Idempotente. */
export async function receivePurchase(id: string, storeId?: string): Promise<void> {
  const sid = storeId ?? (await resolveStoreId());
  const p = await getPurchase(id, sid);
  if (!p) throw new Error("Compra não encontrada.");
  if (p.status === "recebida") return; // já recebida (trava anti-duplo)
  const now = new Date().toISOString();
  // entrada no estoque dos itens ligados a um produto (best-effort; item avulso não mexe no estoque)
  for (const it of p.items) {
    if (!it.stockId || !(it.qty > 0)) continue;
    try {
      await moveStock(it.stockId, "entrada", it.qty, `Compra ${p.code}`, now, sid);
      if (it.unitCostCents > 0) await updateItem(it.stockId, { costCents: it.unitCostCents }, now); // custo da última compra
    } catch { /* item sumiu do estoque — não trava o recebimento */ }
  }
  // despesa (conta a pagar simples) pelo total
  try {
    await addExpense({ description: `Compra ${p.code}${p.fornecedor ? " · " + p.fornecedor : ""}`, category: "pecas" as never, amountCents: purchaseTotalCents(p), date: p.date }, now);
  } catch { /* despesa best-effort */ }
  const upd: Purchase = { ...p, status: "recebida", receivedAt: now };
  await db().from("purchases").update({ data: upd }).eq("id", id).eq("store_id", sid);
}

export async function deletePurchase(id: string, storeId?: string): Promise<void> {
  const sid = storeId ?? (await resolveStoreId());
  const { error } = await db().from("purchases").delete().eq("id", id).eq("store_id", sid);
  if (error) throw new Error("Falha ao excluir compra: " + error.message);
}
