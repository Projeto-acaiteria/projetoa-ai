import { NextResponse } from "next/server";
import { resolveStoreId } from "@/lib/auth/current";
import { staffReport, createStaff, updateStaff, deleteStaff, createStaffAccess, listShifts, updateShift, addShift, removeShift, taxaServicoPorNoite, payShifts, listStaffPayments, reverseStaffPayment } from "@/lib/staff-store";
import { getCurrentUser } from "@/lib/auth/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Garçons + acerto (comissão/gorjeta). GET = acerto por garçom. POST {action,payload} = CRUD.
const ymdBR = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);

// GET ?from=YYYY-MM-DD&to=YYYY-MM-DD (NOITES operacionais). Acerto + presenças (diárias) + 10% recebido.
export async function GET(req: Request) {
  const storeId = await resolveStoreId();
  const { searchParams } = new URL(req.url);
  const to = searchParams.get("to") || ymdBR(new Date());
  const from = searchParams.get("from") || ymdBR(new Date(Date.now() - 29 * 864e5));
  const [acerto, shifts, taxa, pagamentos] = await Promise.all([
    staffReport(undefined, undefined, storeId),
    listShifts(from, to, storeId),
    taxaServicoPorNoite(from, to, storeId),
    listStaffPayments(storeId),
  ]);
  return NextResponse.json({ acerto, shifts, taxa, pagamentos, from, to });
}

export async function POST(req: Request) {
  const storeId = await resolveStoreId();
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
        const s = await createStaff(p as never, storeId);
        return NextResponse.json({ ok: true, id: s.id });
      }
      case "update":
        await updateStaff(String(p.id), p.patch as never, storeId);
        return NextResponse.json({ ok: true });
      case "delete":
        await deleteStaff(String(p.id), storeId);
        return NextResponse.json({ ok: true });
      // DIÁRIAS (mt-33): o Adm ajusta o valor/bônus da noite, lança presença na mão ou remove.
      case "shiftUpdate":
        await updateShift(Number(p.id), { diariaCents: p.diariaCents as number | undefined, bonusCents: p.bonusCents as number | undefined }, storeId);
        return NextResponse.json({ ok: true });
      case "shiftAdd":
        await addShift(String(p.staffId), String(p.noite), storeId);
        return NextResponse.json({ ok: true });
      case "shiftRemove":
        await removeShift(Number(p.id), storeId);
        return NextResponse.json({ ok: true });
      // PAGAMENTO das diárias (mt-34): total recalculado no servidor + carimbo anti-2x
      case "payShifts": {
        const paidBy = (await getCurrentUser())?.email ?? undefined;
        const pay = await payShifts(String(p.staffId), { shiftIds: p.shiftIds as number[] | undefined, notes: p.notes as string | undefined, paidBy }, storeId);
        return NextResponse.json({ ok: true, pay });
      }
      case "reversePayment":
        await reverseStaffPayment(Number(p.id), storeId);
        return NextResponse.json({ ok: true });
      case "createAccess": {
        const email = String(p.email ?? "").trim();
        const senha = String(p.senha ?? "");
        if (!email || senha.length < 6) return NextResponse.json({ error: "Informe email e senha (mín. 6)." }, { status: 400 });
        await createStaffAccess(String(p.id), email, senha, "waiter", storeId);
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: "ação inválida" }, { status: 400 });
    }
  } catch (e) {
    console.error("garcons:", e);
    return NextResponse.json({ error: (e as Error).message || "Não consegui salvar." }, { status: 500 });
  }
}
