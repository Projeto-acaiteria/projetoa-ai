import { NextResponse } from "next/server";
import { getFees, setFees, getStore, setStore, getCardMachines, setCardMachines, type PaymentFees, type StoreSettings, type CardMachine } from "@/lib/settings-store";
import { getStoreConfig, setStoreConfig, type StoreConfig } from "@/lib/auth/store-config";
import { resolveStoreId } from "@/lib/auth/current";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sid = await resolveStoreId();
  const [fees, store, config, machines] = await Promise.all([getFees(sid), getStore(sid), getStoreConfig(sid), getCardMachines(sid)]);
  return NextResponse.json({ fees, store, config, machines });
}

export async function PUT(req: Request) {
  let b: { fees?: Partial<PaymentFees>; store?: Partial<StoreSettings>; config?: Partial<StoreConfig>; machines?: Partial<CardMachine>[] };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const sid = await resolveStoreId();
  const fees = b.fees ? await setFees(b.fees, sid) : await getFees(sid);
  const store = b.store ? await setStore(b.store, sid) : await getStore(sid);
  if (b.config) await setStoreConfig(b.config, sid);
  const config = await getStoreConfig(sid);
  const machines = b.machines ? await setCardMachines(b.machines, sid) : await getCardMachines(sid);
  return NextResponse.json({ ok: true, fees, store, config, machines });
}
