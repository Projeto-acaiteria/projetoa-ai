import { NextResponse } from "next/server";
import { resolveStoreId } from "@/lib/auth/current";
import { coverReport, createEvent, updateEvent, deleteEvent } from "@/lib/events-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Agenda de shows / cover artístico (admin). GET = eventos + cover arrecadado vs repasse.
export async function GET() {
  const storeId = await resolveStoreId();
  const eventos = await coverReport(storeId);
  return NextResponse.json({ eventos });
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
        const e = await createEvent(p as never, storeId);
        return NextResponse.json({ ok: true, id: e.id });
      }
      case "update":
        await updateEvent(String(p.id), p.patch as never, storeId);
        return NextResponse.json({ ok: true });
      case "delete":
        await deleteEvent(String(p.id), storeId);
        return NextResponse.json({ ok: true });
      default:
        return NextResponse.json({ error: "ação inválida" }, { status: 400 });
    }
  } catch (e) {
    console.error("eventos:", e);
    return NextResponse.json({ error: "Não consegui salvar o show." }, { status: 500 });
  }
}
