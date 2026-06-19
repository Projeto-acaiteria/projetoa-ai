import { NextResponse } from "next/server";
import {
  getPendingCalls,
  createServiceCall,
  markCallAttended,
  type ServiceCallType,
} from "@/lib/tables-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES: ServiceCallType[] = ["conta", "atendente"];

// GET /api/mesas/chamados — chamados pendentes
export async function GET() {
  try {
    const calls = await getPendingCalls();
    return NextResponse.json({ calls });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// POST /api/mesas/chamados — criar ou atender um chamado
export async function POST(req: Request) {
  let b: {
    action?: "criar" | "atender";
    tableNumber?: number;
    type?: ServiceCallType;
    tabId?: number | null;
    id?: number;
  };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  try {
    if (b.action === "criar") {
      if (typeof b.tableNumber !== "number" || !Number.isFinite(b.tableNumber)) {
        return NextResponse.json({ error: "tableNumber é obrigatório" }, { status: 400 });
      }
      if (!b.type || !TYPES.includes(b.type)) {
        return NextResponse.json({ error: "type inválido" }, { status: 400 });
      }
      await createServiceCall(b.tableNumber, b.type, b.tabId ?? null);
      return NextResponse.json({ ok: true });
    }

    if (b.action === "atender") {
      if (typeof b.id !== "number" || !Number.isFinite(b.id)) {
        return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });
      }
      await markCallAttended(b.id);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "action inválida" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
