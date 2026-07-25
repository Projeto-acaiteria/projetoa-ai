import { NextResponse } from "next/server";
import { getTables } from "@/lib/tables-store";
import { resolveStoreId } from "@/lib/auth/current";
import { getStoreConfig } from "@/lib/auth/store-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/mesas — mesas com estado da comanda aberta + flag offline (FRESCO, cache:no-store no
// cliente). O flag vem por AQUI e não só pelo prop da página, porque o RSC da página pode ficar
// velho no cache do PWA e mandar offline_enabled desatualizado — esta rota autocorrige a cada 5s.
export async function GET() {
  try {
    const [tables, sid] = await Promise.all([getTables(), resolveStoreId()]);
    const cfg = await getStoreConfig(sid);
    return NextResponse.json({ tables, offlineEnabled: !!cfg?.offline_enabled });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
