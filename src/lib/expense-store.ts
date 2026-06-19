// Despesas (saídas) · fluxo de caixa. JSON → tabela Supabase.
import { db } from "@/lib/supabase";

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

async function readAll(): Promise<Expense[]> {
  const { data } = await db().from("expenses").select("data");
  return (data ?? []).map((r) => (r as { data: Expense }).data);
}
async function writeAll(e: Expense[]) {
  const d = db();
  await d.from("expenses").delete().neq("id", " "); // limpa tudo
  if (e.length) await d.from("expenses").insert(e.map((x) => ({ id: x.id, data: x })));
}

export async function listExpenses(): Promise<Expense[]> {
  return (await readAll()).sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function addExpense(input: Omit<Expense, "id" | "createdAt">, nowIso: string): Promise<Expense> {
  const all = await readAll();
  const e: Expense = { ...input, id: "e" + Math.random().toString(36).slice(2, 9), createdAt: nowIso };
  all.push(e);
  await writeAll(all);
  return e;
}

export async function removeExpense(id: string): Promise<void> {
  const all = await readAll();
  await writeAll(all.filter((x) => x.id !== id));
}

// ---- Despesas FIXAS (templates recorrentes mensais) ----
export type FixedExpense = { id: string; description: string; category: ExpenseCategory; amountCents: number };

async function readFixed(): Promise<FixedExpense[]> {
  const { data } = await db().from("fixed_expenses").select("data");
  return (data ?? []).map((r) => (r as { data: FixedExpense }).data);
}
async function writeFixed(f: FixedExpense[]) {
  const d = db();
  await d.from("fixed_expenses").delete().neq("id", " "); // limpa tudo
  if (f.length) await d.from("fixed_expenses").insert(f.map((x) => ({ id: x.id, data: x })));
}

export async function listFixed(): Promise<FixedExpense[]> {
  return (await readFixed()).sort((a, b) => b.amountCents - a.amountCents);
}
export async function addFixed(input: Omit<FixedExpense, "id">): Promise<FixedExpense> {
  const all = await readFixed();
  const f: FixedExpense = { ...input, id: "f" + Math.random().toString(36).slice(2, 9) };
  all.push(f);
  await writeFixed(all);
  return f;
}
export async function removeFixed(id: string): Promise<void> {
  await writeFixed((await readFixed()).filter((x) => x.id !== id));
}

/** Lança no mês corrente as despesas fixas que ainda não foram lançadas. Idempotente. */
export async function launchFixedForMonth(nowIso: string): Promise<number> {
  const fixed = await readFixed();
  const all = await readAll();
  const month = nowIso.slice(0, 7); // YYYY-MM
  let count = 0;
  for (const f of fixed) {
    const already = all.some((e) => e.date.slice(0, 7) === month && e.description === f.description && e.category === f.category);
    if (already) continue;
    all.push({
      id: "e" + Math.random().toString(36).slice(2, 9),
      description: f.description, category: f.category, amountCents: f.amountCents,
      date: nowIso.slice(0, 10), createdAt: nowIso,
    });
    count++;
  }
  if (count) await writeAll(all);
  return count;
}
