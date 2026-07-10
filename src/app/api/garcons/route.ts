import { NextResponse } from "next/server";
import { resolveStoreId } from "@/lib/auth/current";
import { staffReport, createStaff, updateStaff, deleteStaff, createStaffAccess } from "@/lib/staff-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Garçons + acerto (comissão/gorjeta). GET = acerto por garçom. POST {action,payload} = CRUD.
export async function GET() {
  const storeId = await resolveStoreId();
  const acerto = await staffReport(undefined, undefined, storeId);
  return NextResponse.json({ acerto });
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
      case "createAccess": {
        const email = String(p.email ?? "").trim();
        const senha = String(p.senha ?? "");
        if (!email || senha.length < 6) return NextResponse.json({ error: "Informe email e senha (mín. 6)." }, { status: 400 });
        await createStaffAccess(String(p.id), email, senha, storeId);
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
