import { NextResponse } from "next/server";
import { getTables } from "@/lib/tables-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/mesas — mesas com estado da comanda aberta
export async function GET() {
  try {
    const tables = await getTables();
    return NextResponse.json({ tables });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
