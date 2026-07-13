import { NextResponse } from "next/server";
import { getFees, setFees, getStore, setStore, getCardMachines, setCardMachines, hasCashPin, setCashPin, getFiscalStatus, setFiscalIntegracao, type PaymentFees, type StoreSettings, type CardMachine, type FiscalIntegracao } from "@/lib/settings-store";
import { getStoreConfig, setStoreConfig, type StoreConfig } from "@/lib/auth/store-config";
import { resolveStoreId } from "@/lib/auth/current";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sid = await resolveStoreId();
  const [fees, store, config, machines, cashPinSet, fiscalStatus] = await Promise.all([getFees(sid), getStore(sid), getStoreConfig(sid), getCardMachines(sid), hasCashPin(sid), getFiscalStatus(sid)]);
  // cashPinSet e fiscalStatus são mascarados — nem o PIN nem os TOKENS da Focus saem do servidor
  return NextResponse.json({ fees, store, config, machines, hasCashPin: cashPinSet, fiscal: fiscalStatus });
}

export async function PUT(req: Request) {
  let b: { fees?: Partial<PaymentFees>; store?: Partial<StoreSettings>; config?: Partial<StoreConfig>; machines?: Partial<CardMachine>[]; cashPin?: string; fiscal?: Partial<FiscalIntegracao> };
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
  // PIN do caixa: só grava se o campo veio (string vazia/<4 dígitos limpa o PIN)
  const cashPinSet = b.cashPin !== undefined ? await setCashPin(b.cashPin, sid) : await hasCashPin(sid);
  // integração fiscal: tokens só gravam quando vierem no patch (senão preserva); resposta é mascarada
  const fiscal = b.fiscal ? await setFiscalIntegracao(b.fiscal, sid) : await getFiscalStatus(sid);
  return NextResponse.json({ ok: true, fees, store, config, machines, hasCashPin: cashPinSet, fiscal });
}
