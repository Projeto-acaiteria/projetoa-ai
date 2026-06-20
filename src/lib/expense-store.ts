// Despesas (saídas) · fluxo de caixa. JSON → tabela Supabase.
import { db } from "@/lib/supabase";
import { resolveStoreId } from "@/lib/auth/current";

export type ExpenseCategory =
  | "insumos" | "aluguel" | "salarios" | "utilidades" | "embalagens" | "marketing" | "manutencao" | "impostos" | "outros";

export type Expense = {
  id: string;
  description: string;
  category: ExpenseCategory;
  amountCents: number;
  date: string; // YYYY-MM-DD (data da despesa)
  createdAt: string;
};

export const EXPENSE_CATS: ExpenseCategory[] = [
  "insumos", "aluguel", "salarios", "utilidades", "embalagens", "marketing", "manutencao", "impostos", "outros",
];

async function readAll(storeId?: string): Promise<Expense[]> {
  const sid = storeId ?? (await resolveStoreId());
  const { data, error } = await db().from("expenses").select("data").eq("store_id", sid);
  if (error) throw new Error("Erro ao ler despesas: " + error.message); // nunca tratar erro como vazio
  return (data ?? []).map((r) => (r as { data: Expense }).data);
}

export async function listExpenses(): Promise<Expense[]> {
  return (await readAll()).sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function addExpense(input: Omit<Expense, "id" | "createdAt">, nowIso: string): Promise<Expense> {
  const e: Expense = { ...input, id: "e" + Math.random().toString(36).slice(2, 9), createdAt: nowIso };
  const sid = await resolveStoreId();
  const { error } = await db().from("expenses").insert({ id: e.id, store_id: sid, data: e }); // insert de 1 row
  if (error) throw new Error("Falha ao lançar despesa: " + error.message);
  return e;
}

export async function removeExpense(id: string): Promise<void> {
  const { error } = await db().from("expenses").delete().eq("id", id); // delete por-id pontual é OK
  if (error) throw new Error("Falha ao remover despesa: " + error.message);
}

// ---- Despesas FIXAS (templates recorrentes mensais) ----
export type FixedExpense = { id: string; description: string; category: ExpenseCategory; amountCents: number };

async function readFixed(storeId?: string): Promise<FixedExpense[]> {
  const sid = storeId ?? (await resolveStoreId());
  const { data, error } = await db().from("fixed_expenses").select("data").eq("store_id", sid);
  if (error) throw new Error("Erro ao ler despesas fixas: " + error.message); // nunca tratar erro como vazio
  return (data ?? []).map((r) => (r as { data: FixedExpense }).data);
}

export async function listFixed(): Promise<FixedExpense[]> {
  return (await readFixed()).sort((a, b) => b.amountCents - a.amountCents);
}
export async function addFixed(input: Omit<FixedExpense, "id">): Promise<FixedExpense> {
  const f: FixedExpense = { ...input, id: "f" + Math.random().toString(36).slice(2, 9) };
  const sid = await resolveStoreId();
  const { error } = await db().from("fixed_expenses").insert({ id: f.id, store_id: sid, data: f }); // insert de 1 row
  if (error) throw new Error("Falha ao criar despesa fixa: " + error.message);
  return f;
}
export async function removeFixed(id: string): Promise<void> {
  const { error } = await db().from("fixed_expenses").delete().eq("id", id); // delete por-id pontual é OK
  if (error) throw new Error("Falha ao remover despesa fixa: " + error.message);
}

/** Lança no mês corrente as despesas fixas que ainda não foram lançadas. Idempotente. */
export async function launchFixedForMonth(nowIso: string): Promise<number> {
  const fixed = await readFixed();
  const all = await readAll();
  const month = nowIso.slice(0, 7); // YYYY-MM
  const toInsert: Expense[] = [];
  for (const f of fixed) {
    const already = all.some((e) => e.date.slice(0, 7) === month && e.description === f.description && e.category === f.category);
    if (already) continue;
    toInsert.push({
      id: "e" + Math.random().toString(36).slice(2, 9),
      description: f.description, category: f.category, amountCents: f.amountCents,
      date: nowIso.slice(0, 10), createdAt: nowIso,
    });
  }
  if (toInsert.length) {
    const sid = await resolveStoreId();
    const { error } = await db().from("expenses").insert(toInsert.map((e) => ({ id: e.id, store_id: sid, data: e }))); // insert das novas só (sem delete-all)
    if (error) throw new Error("Falha ao lançar despesas fixas do mês: " + error.message);
  }
  return toInsert.length;
}
