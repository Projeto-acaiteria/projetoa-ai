import { NextResponse } from "next/server";
import { getTabFull } from "@/lib/tables-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/mesas/comanda?tabId=N — comanda completa
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tabIdRaw = searchParams.get("tabId");
  const tabId = Number(tabIdRaw);
  if (!tabIdRaw || !Number.isFinite(tabId)) {
    return NextResponse.json({ error: "tabId inválido" }, { status: 400 });
  }

  try {
    const full = await getTabFull(tabId);
    return NextResponse.json(full);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
