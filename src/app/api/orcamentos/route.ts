import { NextResponse } from "next/server";
import { getCurrentStore, getCurrentRole } from "@/lib/auth/store";
import { getStoreConfig } from "@/lib/auth/store-config";
import { familyOf } from "@/config/segments";
import { listBudgets, createBudget, updateBudget, setBudgetStatus, deleteBudget, getBudget, budgetTotals, linkBudgetToOS } from "@/lib/budgets-store";
import { createOSFromBudget } from "@/lib/service-orders-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// /api/orcamentos — orçamentos do vertical SERVICE. Guard 3 camadas: autenticado + family service +
// papel owner OU reception (a recepção faz orçamento no balcão; técnico não). storeId sempre da sessão.
type Guard = { store: { id: string } } | { error: NextResponse };
async function guard(): Promise<Guard> {
  const store = await getCurrentStore();
  if (!store) return { error: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) };
  const cfg = await getStoreConfig(store.id);
  if (familyOf(cfg?.business_type) !== "service") return { error: NextResponse.json({ error: "Indisponível neste tipo de loja" }, { status: 403 }) };
  const role = await getCurrentRole();
  if (role !== "owner" && role !== "reception") return { error: NextResponse.json({ error: "Sem permissão" }, { status: 403 }) };
  return { store };
}

export async function GET() {
  const g = await guard();
  if ("error" in g) return g.error;
  return NextResponse.json({ budgets: await listBudgets(g.store.id) });
}

export async function POST(req: Request) {
  const g = await guard();
  if ("error" in g) return g.error;
  const sid = g.store.id;
  let b: { action?: string; payload?: Record<string, unknown> };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "body inválido" }, { status: 400 });
  }
  const p = b.payload ?? {};
  try {
    switch (b.action) {
      case "create": {
        const budget = await createBudget(p as never, sid);
        return NextResponse.json({ ok: true, id: budget.id, code: budget.code });
      }
      case "update": {
        const budget = await updateBudget(String(p.id), p as never, sid);
        return NextResponse.json({ ok: true, code: budget.code });
      }
      case "status":
        await setBudgetStatus(String(p.id), String(p.status), sid);
        return NextResponse.json({ ok: true });
      case "aprovar": {
        // aprova + gera a OS automaticamente (idempotente: se já gerou, devolve a mesma)
        const budget = await getBudget(String(p.id), sid);
        if (!budget) return NextResponse.json({ error: "Orçamento não encontrado." }, { status: 404 });
        if (budget.osId) return NextResponse.json({ ok: true, osId: budget.osId, osCode: budget.osCode, already: true });
        const t = budgetTotals(budget);
        const parts = budget.items.filter((i) => i.kind === "produto").map((i) => ({ name: i.name, qty: i.qty, unitCents: i.unitCents }));
        const os = await createOSFromBudget({
          customerName: budget.customerName,
          customerPhone: budget.customerPhone || undefined,
          cpf: budget.cpf || undefined,
          budgetCode: budget.code,
          serviceValueCents: t.servicosCents,
          partsValueCents: t.produtosCents + t.freteCents + t.outrosCents,
          discountCents: t.descontoCents,
          parts,
          observacao: budget.observacao || undefined,
        }, sid);
        await linkBudgetToOS(budget.id, os.id, os.code ?? "", sid);
        return NextResponse.json({ ok: true, osId: os.id, osCode: os.code });
      }
      case "delete":
        await deleteBudget(String(p.id), sid);
        return NextResponse.json({ ok: true });
      default:
        return NextResponse.json({ error: "ação inválida" }, { status: 400 });
    }
  } catch (e) {
    console.error("orcamentos:", e);
    return NextResponse.json({ error: (e as Error).message || "Não consegui salvar." }, { status: 500 });
  }
}
