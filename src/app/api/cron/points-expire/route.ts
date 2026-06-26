import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { getLoyalty } from "@/lib/loyalty-store";
import { validBalance } from "@/lib/loyalty";
import type { Customer } from "@/lib/customers-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cron de EXPIRAÇÃO de pontos (fidelidade) — roda 1x/dia (Vercel Cron). Auth: Bearer CRON_SECRET.
// Materializa a validade (validityDays por loja) no saldo: quando o saldo guardado supera o saldo
// VÁLIDO (FIFO), posta um lançamento 'expire' (rastro no histórico) e sincroniza c.points = válido.
// Idempotente: validBalance ignora os 'expire', então recomputa o mesmo alvo — re-rodar não dobra.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });

  const now = new Date();
  const nowIso = now.toISOString();
  const d = db();
  const { data: rows, error } = await d.from("customers").select("store_id, phone, data");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const validityByStore = new Map<string, number>();
  const vdOf = async (storeId: string): Promise<number> => {
    if (!validityByStore.has(storeId)) validityByStore.set(storeId, (await getLoyalty(storeId)).validityDays);
    return validityByStore.get(storeId)!;
  };

  let scanned = 0, expiredCustomers = 0, expiredPoints = 0;
  for (const row of rows ?? []) {
    scanned++;
    const storeId = (row as { store_id: string }).store_id;
    const phone = (row as { phone: string }).phone;
    const c = (row as { data: Customer }).data;
    if (!c?.history?.length || (c.points ?? 0) <= 0) continue;
    const vd = await vdOf(storeId);
    const target = validBalance(c.history, vd, now);
    if (target >= (c.points ?? 0)) continue; // nada a expirar
    const diff = c.points - target;
    c.history.unshift({ type: "expire", points: -diff, ref: `Expiração ${vd} dias`, at: nowIso });
    c.points = target;
    const { error: e2 } = await d.from("customers").upsert({ store_id: storeId, phone, data: c });
    if (e2) continue; // não-fatal: tenta o próximo cliente
    expiredCustomers++;
    expiredPoints += diff;
  }

  return NextResponse.json({ ok: true, scanned, expiredCustomers, expiredPoints });
}
