// Garçons + comissão/gorjeta (bar 2ª onda). Comissão = acordo do patrão (% sobre o que o garçom vende).
// Gorjeta (taxa de serviço) é DOS TRABALHADORES — atribuída por comanda atendida (rateio "por comanda").
// Server-side, por loja. NÃO promete conformidade trabalhista de folha (13º/FGTS = contador).
import { db } from "@/lib/supabase";
import { resolveStoreId } from "@/lib/auth/current";

const num = (v: unknown) => Number(v ?? 0);

export type PayType = "comissao" | "diaria" | "salario";
export type Staff = { id: string; name: string; commission_percent: number; active: boolean; pay_type: PayType; pay_value_cents: number };

const toStaff = (r: Record<string, unknown>): Staff => ({
  id: String(r.id),
  name: String(r.name ?? ""),
  commission_percent: num(r.commission_percent),
  active: Boolean(r.active),
  pay_type: (["comissao", "diaria", "salario"].includes(String(r.pay_type)) ? String(r.pay_type) : "comissao") as PayType,
  pay_value_cents: num(r.pay_value_cents),
});

export async function listStaff(storeId?: string): Promise<Staff[]> {
  const sid = storeId ?? (await resolveStoreId());
  const { data } = await db().from("staff").select("*").eq("store_id", sid).order("name");
  return ((data ?? []) as Record<string, unknown>[]).map(toStaff);
}

export type StaffInput = { name: string; commission_percent?: number; active?: boolean; pay_type?: PayType; pay_value_cents?: number };
export async function createStaff(input: StaffInput, storeId?: string): Promise<Staff> {
  const sid = storeId ?? (await resolveStoreId());
  const { data, error } = await db().from("staff").insert({
    store_id: sid, name: input.name.trim(), commission_percent: Math.max(0, Number(input.commission_percent ?? 0)), active: input.active ?? true,
    pay_type: input.pay_type ?? "comissao", pay_value_cents: Math.max(0, Math.round(Number(input.pay_value_cents ?? 0))),
  }).select("*").single();
  if (error || !data) throw new Error(error?.message ?? "Falha ao criar garçom.");
  return toStaff(data);
}
/** Papel de login que um funcionário-staff pode receber. Food = "waiter" (garçom). Service = "technician"/"reception". */
export type StaffLoginRole = "waiter" | "technician" | "reception";
/** Cria (ou reaproveita) o LOGIN do funcionário: conta de auth + membership ligada ao staff.
 *  `role` decide onde o login cai (garçom vs técnico/recepção). Default "waiter" → food NÃO muda
 *  (a chamada de garçons continua nascendo waiter). O vertical service passa "technician"/"reception". */
export async function createStaffAccess(staffId: string, email: string, senha: string, role: StaffLoginRole = "waiter", storeId?: string): Promise<void> {
  const sid = storeId ?? (await resolveStoreId());
  const sb = db();
  let userId: string | undefined;
  const created = await sb.auth.admin.createUser({ email: email.trim(), password: senha, email_confirm: true });
  if (created.error) {
    if (/already|registered|exists/i.test(created.error.message)) {
      const list = await sb.auth.admin.listUsers({ perPage: 1000 });
      userId = list.data.users.find((x) => x.email?.toLowerCase() === email.trim().toLowerCase())?.id;
      if (!userId) throw created.error;
      await sb.auth.admin.updateUserById(userId, { password: senha, email_confirm: true });
    } else throw created.error;
  } else userId = created.data.user.id;
  const { data: exist } = await sb.from("store_members").select("id").eq("store_id", sid).eq("user_id", userId).maybeSingle();
  if (exist) await sb.from("store_members").update({ role, active: true, staff_id: staffId }).eq("id", (exist as { id: string }).id);
  else await sb.from("store_members").insert({ store_id: sid, user_id: userId, role, active: true, staff_id: staffId });
}
export async function updateStaff(id: string, patch: Partial<StaffInput>, storeId?: string): Promise<void> {
  const sid = storeId ?? (await resolveStoreId());
  await db().from("staff").update(patch).eq("id", id).eq("store_id", sid);
}
export async function deleteStaff(id: string, storeId?: string): Promise<void> {
  const sid = storeId ?? (await resolveStoreId());
  await db().from("staff").delete().eq("id", id).eq("store_id", sid);
}

/** Liga o garçom à comanda (quem atende a mesa). */
export async function setTabWaiter(tabId: number, waiterId: string | null, storeId?: string): Promise<void> {
  const sid = storeId ?? (await resolveStoreId());
  await db().from("tabs").update({ waiter_id: waiterId }).eq("id", tabId).eq("store_id", sid);
}

export type StaffAcerto = Staff & { comandas: number; vendidoCents: number; comissaoCents: number; gorjetaCents: number; aPagarCents: number; hasLogin: boolean };

/** Acerto por garçom (comandas FECHADAS no período): vendido (consumo) + comissão (% sobre vendido)
 *  + gorjeta (taxa das comandas que atendeu) = a pagar. fromISO/toISO opcionais (por closed_at). */
export async function staffReport(fromISO?: string, toISO?: string, storeId?: string, loginRoles: StaffLoginRole[] = ["waiter"]): Promise<StaffAcerto[]> {
  const sid = storeId ?? (await resolveStoreId());
  const d = db();
  const staff = await listStaff(sid);
  // quem já tem login (membership ligada ao staff). loginRoles default ["waiter"] → food inalterado;
  // o vertical service passa ["technician","reception"] pra detectar o login do técnico/recepção.
  const { data: mem } = await d.from("store_members").select("staff_id").eq("store_id", sid).in("role", loginRoles).eq("active", true).not("staff_id", "is", null);
  const withLogin = new Set(((mem ?? []) as { staff_id: string }[]).map((m) => String(m.staff_id)));

  let q = d.from("tabs").select("id, waiter_id, service_fee_cents, closed_at").eq("store_id", sid).eq("status", "fechada").not("waiter_id", "is", null);
  if (fromISO) q = q.gte("closed_at", fromISO);
  if (toISO) q = q.lte("closed_at", toISO);
  const { data: tabs } = await q;
  const tabRows = (tabs ?? []) as { id: number; waiter_id: string; service_fee_cents: number }[];
  if (!tabRows.length) return staff.map((s) => ({ ...s, comandas: 0, vendidoCents: 0, comissaoCents: 0, gorjetaCents: 0, aPagarCents: 0, hasLogin: withLogin.has(s.id) }));

  const tabIds = tabRows.map((t) => t.id);
  const { data: orders } = await d.from("tab_orders").select("id, tab_id").in("tab_id", tabIds);
  const orderToTab = new Map<number, number>();
  for (const o of (orders ?? []) as { id: number; tab_id: number }[]) orderToTab.set(o.id, o.tab_id);
  const orderIds = [...orderToTab.keys()];
  const { data: items } = orderIds.length ? await d.from("tab_order_items").select("tab_order_id, qty, unit_price_cents").in("tab_order_id", orderIds) : { data: [] };
  // consumo por tab
  const consumoByTab = new Map<number, number>();
  for (const it of (items ?? []) as { tab_order_id: number; qty: number; unit_price_cents: number }[]) {
    const tabId = orderToTab.get(it.tab_order_id);
    if (tabId == null) continue;
    consumoByTab.set(tabId, (consumoByTab.get(tabId) ?? 0) + num(it.qty) * num(it.unit_price_cents));
  }

  // agrega por garçom
  const acc = new Map<string, { comandas: number; vendido: number; gorjeta: number }>();
  for (const t of tabRows) {
    const a = acc.get(t.waiter_id) ?? { comandas: 0, vendido: 0, gorjeta: 0 };
    a.comandas += 1;
    a.vendido += consumoByTab.get(t.id) ?? 0;
    a.gorjeta += num(t.service_fee_cents);
    acc.set(t.waiter_id, a);
  }

  return staff.map((s) => {
    const a = acc.get(s.id) ?? { comandas: 0, vendido: 0, gorjeta: 0 };
    // comissão só quando o modelo é comissão; diária/salário não somam % (o fixo é acertado à parte)
    const comissao = s.pay_type === "comissao" ? Math.round((a.vendido * s.commission_percent) / 100) : 0;
    return { ...s, comandas: a.comandas, vendidoCents: a.vendido, comissaoCents: comissao, gorjetaCents: a.gorjeta, aPagarCents: comissao + a.gorjeta, hasLogin: withLogin.has(s.id) };
  }).filter((r) => r.active || r.comandas > 0);
}
