import { NextResponse } from "next/server";
import { ensureTables } from "@/lib/tables-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/mesas/adicionar — garante as mesas 1..n (idempotente)
export async function POST(req: Request) {
  let b: { n?: number };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (typeof b.n !== "number" || !Number.isFinite(b.n) || b.n < 1) {
    return NextResponse.json({ error: "n inválido" }, { status: 400 });
  }

  try {
    await ensureTables(Math.floor(b.n));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
