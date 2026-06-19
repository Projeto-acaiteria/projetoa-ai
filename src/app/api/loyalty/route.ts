import { NextResponse } from "next/server";
import { getLoyalty, setLoyalty } from "@/lib/loyalty-store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ config: await getLoyalty() });
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const config = await setLoyalty(body);
    return NextResponse.json({ ok: true, config });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro ao salvar" }, { status: 400 });
  }
}
