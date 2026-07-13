// Pagamento/repasse de comissão do técnico (vertical SERVICE). Server-side, por loja, em centavos.
// Modelo espelhado do Palace: cada OS carrega commission_payment_id (NULL = pendente; preenchido = paga)
// — trava anti-pagar-2x. commission_payments = o "recibo" (jsonb data), com pago parcial + bônus + estorno.
// O valor é SEMPRE recalculado no server (osCommissionCents) — nunca confia no número do cliente.
import { db } from "@/lib/supabase";
import { resolveStoreId } from "@/lib/auth/current";
import { listServiceOrders, osCommissionCents, type ServiceOrder } from "@/lib/service-orders-store";

export type CommissionPayment = {
  id: string;
  staffId: string;
  periodStart: string | null; // YYYY-MM-DD (informativo — 1ª OS coberta)
  periodEnd: string | null; // YYYY-MM-DD (última OS coberta)
  totalCents: number; // comissão devida (recalculada no server)
  paidCents: number; // o que foi de fato pago (permite parcial)
  bonusCents: number; // bônus/mérito, À PARTE da comissão
  bonusReason: string | null;
  notes: string | null;
  osIds: string[]; // OS quitadas cobertas por este pagamento
  paidAt: string; // data do pagamento (ISO)
  createdAt: string;
};

export async function listCommissionPayments(staffId?: string, storeId?: string): Promise<CommissionPayment[]> {
  const sid = storeId ?? (await resolveStoreId());
  const { data, error } = await db().from("commission_payments").select("data").eq("store_id", sid);
  if (error) throw new Error("Erro ao ler pagamentos de comissão: " + error.message); // nunca tratar erro como vazio
  const rows = ((data ?? []) as { data: CommissionPayment }[]).map((r) => r.data);
  return (staffId ? rows.filter((p) => p.staffId === staffId) : rows).sort((a, b) => (a.paidAt < b.paidAt ? 1 : -1));
}

/** OS QUITADAS com comissão pendente (commission_payment_id NULL) de um técnico. Base do wizard. */
export async function pendingOSForStaff(staffId: string, storeId?: string): Promise<ServiceOrder[]> {
  const sid = storeId ?? (await resolveStoreId());
  const orders = await listServiceOrders({ staffId }, sid);
  return orders.filter((os) => os.paymentStatus === "quitada" && !os.commissionPaymentId && osCommissionCents(os) > 0);
}

export type PayCommissionInput = {
  staffId: string;
  osIds: string[];
  paidCents?: number; // default = total devido
  bonusCents?: number;
  bonusReason?: string;
  notes?: string;
  paidAt?: string; // ISO; default = agora
};

/** Registra o pagamento: recalcula no server, trava anti-2x, vincula as OS e faz rollback se falhar. */
export async function payCommission(input: PayCommissionInput, storeId?: string): Promise<CommissionPayment> {
  const sid = storeId ?? (await resolveStoreId());
  const staffId = String(input.staffId);
  const ids = [...new Set((input.osIds ?? []).map(String))];

  // valida OS uma a uma: existe, é do técnico, quitada e AINDA pendente (trava)
  const orders = await listServiceOrders({ staffId }, sid);
  const byId = new Map(orders.map((o) => [o.id, o] as const));
  const selected: ServiceOrder[] = [];
  for (const id of ids) {
    const os = byId.get(id);
    if (!os) throw new Error("OS não encontrada ou de outro técnico.");
    if (os.paymentStatus !== "quitada") throw new Error("OS não quitada não gera comissão.");
    if (os.commissionPaymentId) throw new Error("Uma das OS já teve a comissão paga.");
    selected.push(os);
  }

  const bonusCents = Math.max(0, Math.round(input.bonusCents ?? 0));
  const totalCents = selected.reduce((s, o) => s + osCommissionCents(o), 0);
  if (totalCents <= 0 && bonusCents <= 0) throw new Error("Nada a pagar.");
  const paidCents = input.paidCents != null ? Math.max(0, Math.round(input.paidCents)) : totalCents;

  const nowIso = new Date().toISOString();
  const dates = (selected.map((o) => o.paidAt).filter(Boolean) as string[]).sort();
  const pay: CommissionPayment = {
    id: "cp" + Math.random().toString(36).slice(2, 10),
    staffId,
    periodStart: dates[0]?.slice(0, 10) ?? null,
    periodEnd: dates[dates.length - 1]?.slice(0, 10) ?? null,
    totalCents,
    paidCents,
    bonusCents,
    bonusReason: input.bonusReason?.trim() || null,
    notes: input.notes?.trim() || null,
    osIds: selected.map((o) => o.id),
    paidAt: input.paidAt || nowIso,
    createdAt: nowIso,
  };

  const { error: insErr } = await db().from("commission_payments").insert({ id: pay.id, store_id: sid, data: pay });
  if (insErr) throw new Error("Falha ao registrar pagamento: " + insErr.message);

  // vincula as OS — SÓ as ainda pendentes (.is null). Se nem todas vincularam (corrida), rollback total.
  if (pay.osIds.length) {
    const { data: linked, error: upErr } = await db()
      .from("service_orders")
      .update({ commission_payment_id: pay.id, updated_at: nowIso })
      .eq("store_id", sid)
      .in("id", pay.osIds)
      .is("commission_payment_id", null)
      .select("id");
    const linkedIds = ((linked ?? []) as { id: string }[]).map((r) => r.id);
    if (upErr || linkedIds.length !== pay.osIds.length) {
      if (linkedIds.length) {
        await db().from("service_orders").update({ commission_payment_id: null }).eq("store_id", sid).in("id", linkedIds);
      }
      await db().from("commission_payments").delete().eq("id", pay.id).eq("store_id", sid);
      throw new Error("Uma das OS já foi paga em paralelo — pagamento cancelado, tente de novo.");
    }
  }
  return pay;
}

/** Estorna: apaga o recibo e devolve as OS pra pendente (único jeito de reabrir). */
export async function reverseCommissionPayment(paymentId: string, storeId?: string): Promise<void> {
  const sid = storeId ?? (await resolveStoreId());
  const { data } = await db().from("commission_payments").select("data").eq("id", paymentId).eq("store_id", sid).maybeSingle();
  const pay = data ? (data as { data: CommissionPayment }).data : null;
  if (pay?.osIds?.length) {
    await db()
      .from("service_orders")
      .update({ commission_payment_id: null })
      .eq("store_id", sid)
      .in("id", pay.osIds)
      .eq("commission_payment_id", paymentId);
  }
  await db().from("commission_payments").delete().eq("id", paymentId).eq("store_id", sid);
}
