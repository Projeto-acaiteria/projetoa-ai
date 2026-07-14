// Pagamento de equipe SALÁRIO/DIÁRIA (recepção contratada, ajudante por dia). Diferente da comissão:
// não tem OS por trás — é um pagamento fixo do período. Registra como DESPESA (categoria salarios,
// amarrada ao staffId) → entra no Financeiro automático, sem lançar duas vezes. Histórico por funcionário.
import { db } from "@/lib/supabase";
import { resolveStoreId } from "@/lib/auth/current";
import { addExpense, type Expense } from "@/lib/expense-store";

export type FixedPayment = {
  id: string; staffId: string; amountCents: number;
  periodStart: string | null; periodEnd: string | null; description: string; date: string; createdAt: string;
};

const isDate = (v: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? ""));

/** Registra o pagamento fixo do funcionário → vira despesa (salarios) amarrada ao staffId. */
export async function payFixed(
  input: { staffId: string; staffName?: string; amountCents: number; periodStart?: string; periodEnd?: string; note?: string },
  storeId?: string,
): Promise<Expense> {
  await (storeId ?? resolveStoreId()); // valida sessão/loja
  const amount = Math.max(0, Math.round(Number(input.amountCents) || 0));
  if (!input.staffId) throw new Error("Funcionário inválido.");
  if (amount <= 0) throw new Error("Informe o valor do pagamento.");
  const now = new Date().toISOString();
  const periodEnd = isDate(input.periodEnd) ? String(input.periodEnd) : now.slice(0, 10);
  const periodStart = isDate(input.periodStart) ? String(input.periodStart) : undefined;
  const per = periodStart ? ` (${periodStart.split("-").reverse().join("/")}–${periodEnd.split("-").reverse().join("/")})` : "";
  const nome = input.staffName?.trim() || "equipe";
  const desc = `Salário · ${nome}${per}${input.note ? " · " + input.note.trim().slice(0, 80) : ""}`;
  // date da despesa = fim do período (cai no mês certo do fluxo de caixa)
  return addExpense({ description: desc.slice(0, 160), category: "salarios", amountCents: amount, date: periodEnd, staffId: input.staffId, periodStart, periodEnd }, now);
}

/** Histórico de pagamentos fixos de um funcionário (despesas salarios amarradas a ele). */
export async function listFixedPayments(staffId: string, storeId?: string): Promise<FixedPayment[]> {
  const sid = storeId ?? (await resolveStoreId());
  const { data, error } = await db().from("expenses").select("data").eq("store_id", sid);
  if (error) throw new Error("Erro ao ler pagamentos: " + error.message);
  return (data ?? [])
    .map((r) => (r as { data: Expense }).data)
    .filter((e) => e.staffId === staffId && e.category === "salarios")
    .map((e) => ({ id: e.id, staffId: e.staffId as string, amountCents: e.amountCents, periodStart: e.periodStart ?? null, periodEnd: e.periodEnd ?? null, description: e.description, date: e.date, createdAt: e.createdAt }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** Estorna um pagamento fixo (remove a despesa). Só apaga se for do funcionário certo (anti-engano). */
export async function reverseFixedPayment(expenseId: string, staffId: string, storeId?: string): Promise<void> {
  const sid = storeId ?? (await resolveStoreId());
  const { data } = await db().from("expenses").select("data").eq("id", expenseId).eq("store_id", sid).maybeSingle();
  const e = data ? (data as { data: Expense }).data : null;
  if (!e || e.staffId !== staffId) throw new Error("Pagamento não encontrado.");
  const { error } = await db().from("expenses").delete().eq("id", expenseId).eq("store_id", sid);
  if (error) throw new Error("Falha ao estornar: " + error.message);
}
