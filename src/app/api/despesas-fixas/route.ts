import { NextResponse } from "next/server";
import { listFixed, addFixed, launchFixedForMonth, EXPENSE_CATS, type ExpenseCategory } from "@/lib/expense-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ fixed: await listFixed() });
}

export async function POST(req: Request) {
  let b: { action?: string; description?: string; category?: string; amountCents?: number };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (b.action === "lancar") {
    const count = await launchFixedForMonth(new Date().toISOString());
    return NextResponse.json({ ok: true, launched: count });
  }

  if (!b.description?.trim() || !b.amountCents || b.amountCents <= 0) {
    return NextResponse.json({ error: "Descrição e valor obrigatórios" }, { status: 400 });
  }
  const fixed = await addFixed({
    description: b.description.trim(),
    category: EXPENSE_CATS.includes(b.category as ExpenseCategory) ? (b.category as ExpenseCategory) : "outros",
    amountCents: Math.round(b.amountCents),
  });
  return NextResponse.json({ ok: true, fixed }, { status: 201 });
}
