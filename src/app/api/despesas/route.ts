import { NextResponse } from "next/server";
import { listExpenses, addExpense, EXPENSE_CATS, type ExpenseCategory } from "@/lib/expense-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ expenses: await listExpenses() });
}

export async function POST(req: Request) {
  let b: { description?: string; category?: string; amountCents?: number; date?: string };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!b.description?.trim()) return NextResponse.json({ error: "Descrição obrigatória" }, { status: 400 });
  if (!b.amountCents || b.amountCents <= 0) return NextResponse.json({ error: "Valor inválido" }, { status: 400 });

  const expense = await addExpense(
    {
      description: b.description.trim(),
      category: EXPENSE_CATS.includes(b.category as ExpenseCategory) ? (b.category as ExpenseCategory) : "outros",
      amountCents: Math.round(b.amountCents),
      date: b.date || new Date().toISOString().slice(0, 10),
    },
    new Date().toISOString(),
  );
  return NextResponse.json({ ok: true, expense }, { status: 201 });
}
