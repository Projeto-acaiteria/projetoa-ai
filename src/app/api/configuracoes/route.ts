import { NextResponse } from "next/server";
import { getFees, setFees, getStore, setStore, type PaymentFees, type StoreSettings } from "@/lib/settings-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ fees: await getFees(), store: await getStore() });
}

export async function PUT(req: Request) {
  let b: { fees?: Partial<PaymentFees>; store?: Partial<StoreSettings> };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const fees = b.fees ? await setFees(b.fees) : await getFees();
  const store = b.store ? await setStore(b.store) : await getStore();
  return NextResponse.json({ ok: true, fees, store });
}
