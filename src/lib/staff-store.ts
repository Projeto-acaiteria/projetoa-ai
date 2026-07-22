// Garçons + comissão/gorjeta (bar 2ª onda). Comissão = acordo do patrão (% sobre o que o garçom vende).
// Gorjeta (taxa de serviço) é DOS TRABALHADORES — atribuída por comanda atendida (rateio "por comanda").
// Server-side, por loja. NÃO promete conformidade trabalhista de folha (13º/FGTS = contador).
import { db } from "@/lib/supabase";
import { resolveStoreId } from "@/lib/auth/current";
import { noiteOperacionalBR } from "@/lib/events-store";

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

  let q = d.from("tabs").select("id, waiter_id, service_fee_cents, closed_at").eq("store_id", sid).eq("status", "fechada").eq("cancelled", false).not("waiter_id", "is", null);
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

// ── PRESENÇA / DIÁRIAS (mt-33) ───────────────────────────────────────────────
// O Medellín paga por DIÁRIA. Como quem paga diária não vincula garçom na comanda, a presença é
// registrada por conta própria: check-in no login + ajuste do Adm. Noite = NOITE OPERACIONAL (6h→6h).

export type Shift = {
  id: number; staffId: string; name: string; noite: string;
  diariaCents: number; bonusCents: number; source: string; checkedInAt: string;
  paymentId?: number | null; // carimbo do pagamento (mt-34): noite paga não entra em novo recibo
};

/** CHECK-IN do garçom na noite operacional atual. Idempotente: 1 linha por garçom por noite
 *  (índice único). É chamado a cada acesso do garçom — grava só na primeira vez da noite.
 *  Snapshota a diária cadastrada: reajuste futuro não reescreve noite já trabalhada.
 *  NUNCA lança: presença não pode derrubar a navegação do garçom. */
export async function checkInStaff(staffId: string, storeId?: string): Promise<void> {
  try {
    const sid = storeId ?? (await resolveStoreId());
    const noite = noiteOperacionalBR();
    const d = db();
    const { data: ex } = await d.from("staff_shifts").select("id").eq("store_id", sid).eq("staff_id", staffId).eq("noite", noite).maybeSingle();
    if (ex) return; // já bateu ponto nesta noite
    const { data: st } = await d.from("staff").select("pay_value_cents").eq("id", staffId).eq("store_id", sid).maybeSingle();
    const { error } = await d.from("staff_shifts").insert({
      store_id: sid, staff_id: staffId, noite,
      diaria_cents: num((st as { pay_value_cents?: number } | null)?.pay_value_cents), source: "login",
    });
    // 23505 = dois acessos simultâneos na virada; o índice único garantiu — não é erro
    if (error && (error as { code?: string }).code !== "23505") console.error("checkInStaff:", error.message);
  } catch (e) {
    console.error("checkInStaff:", e);
  }
}

/** Presenças de um intervalo de NOITES (YYYY-MM-DD, inclusivo), com o nome do garçom. */
export async function listShifts(fromNoite: string, toNoite: string, storeId?: string): Promise<Shift[]> {
  const sid = storeId ?? (await resolveStoreId());
  const d = db();
  const { data } = await d.from("staff_shifts").select("*").eq("store_id", sid)
    .gte("noite", fromNoite).lte("noite", toNoite).order("noite", { ascending: false });
  const rows = (data ?? []) as Array<{ id: number; staff_id: string; noite: string; diaria_cents: number; bonus_cents: number; source: string; checked_in_at: string; payment_id: number | null }>;
  if (!rows.length) return [];
  const nomeById = new Map((await listStaff(sid)).map((s) => [s.id, s.name]));
  return rows.map((r) => ({
    id: num(r.id), staffId: String(r.staff_id), name: nomeById.get(String(r.staff_id)) ?? "—",
    noite: String(r.noite).slice(0, 10), diariaCents: num(r.diaria_cents), bonusCents: num(r.bonus_cents),
    source: r.source, checkedInAt: r.checked_in_at, paymentId: r.payment_id ?? null,
  }));
}

/** Adm ajusta a diária/bônus daquela noite (o valor pago é o desta linha, não o do cadastro). */
export async function updateShift(id: number, patch: { diariaCents?: number; bonusCents?: number }, storeId?: string): Promise<void> {
  const sid = storeId ?? (await resolveStoreId());
  const up: Record<string, number> = {};
  if (patch.diariaCents != null) up.diaria_cents = Math.max(0, Math.round(patch.diariaCents));
  if (patch.bonusCents != null) up.bonus_cents = Math.max(0, Math.round(patch.bonusCents));
  if (!Object.keys(up).length) return;
  await db().from("staff_shifts").update(up).eq("id", id).eq("store_id", sid);
}

/** Adm lança presença na mão (garçom trabalhou mas não logou). Idempotente por noite. */
export async function addShift(staffId: string, noite: string, storeId?: string): Promise<void> {
  const sid = storeId ?? (await resolveStoreId());
  const d = db();
  const { data: ex } = await d.from("staff_shifts").select("id").eq("store_id", sid).eq("staff_id", staffId).eq("noite", noite).maybeSingle();
  if (ex) return;
  const { data: st } = await d.from("staff").select("pay_value_cents").eq("id", staffId).eq("store_id", sid).maybeSingle();
  const { error } = await d.from("staff_shifts").insert({
    store_id: sid, staff_id: staffId, noite,
    diaria_cents: num((st as { pay_value_cents?: number } | null)?.pay_value_cents), source: "manual",
  });
  if (error && (error as { code?: string }).code !== "23505") throw error;
}

export async function removeShift(id: number, storeId?: string): Promise<void> {
  const sid = storeId ?? (await resolveStoreId());
  await db().from("staff_shifts").delete().eq("id", id).eq("store_id", sid);
}

/** Quanto a casa RECEBEU de taxa de serviço (10%) por noite. A gorjeta fica no financeiro do bar
 *  (decisão interna do Medellín); esta visão existe pra saberem quanto entrou antes de decidir
 *  quanto repassar. Só comanda FECHADA e não cancelada. */
export async function taxaServicoPorNoite(fromNoite: string, toNoite: string, storeId?: string): Promise<{ totalCents: number; porNoite: { noite: string; cents: number }[] }> {
  const sid = storeId ?? (await resolveStoreId());
  // janela em timestamp: 6h da 1ª noite até 6h do dia seguinte ao fim
  const ini = new Date(`${fromNoite}T06:00:00-03:00`).toISOString();
  const fim = new Date(new Date(`${toNoite}T06:00:00-03:00`).getTime() + 24 * 60 * 60 * 1000).toISOString();
  const { data } = await db().from("tabs").select("service_fee_cents, closed_at")
    .eq("store_id", sid).eq("status", "fechada").eq("cancelled", false)
    .gte("closed_at", ini).lt("closed_at", fim);
  const map = new Map<string, number>();
  let totalCents = 0;
  for (const t of (data ?? []) as Array<{ service_fee_cents: number; closed_at: string }>) {
    const cents = num(t.service_fee_cents);
    if (!cents) continue;
    // noite operacional do fechamento = data de (closed_at − 6h) no fuso BR
    const noite = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" })
      .format(new Date(new Date(t.closed_at).getTime() - 6 * 60 * 60 * 1000));
    map.set(noite, (map.get(noite) ?? 0) + cents);
    totalCents += cents;
  }
  return { totalCents, porNoite: [...map.entries()].map(([noite, cents]) => ({ noite, cents })).sort((a, b) => b.noite.localeCompare(a.noite)) };
}

// ── PAGAMENTO das diárias (mt-34) ────────────────────────────────────────────

export type StaffPayment = {
  id: number; staffId: string; name: string; totalCents: number; noites: number;
  periodStart: string | null; periodEnd: string | null; notes: string | null;
  paidBy: string | null; paidAt: string;
};

/** Noites AINDA NÃO PAGAS de um garçom (o que entra no próximo pagamento). */
export async function shiftsAPagar(staffId: string, storeId?: string): Promise<Shift[]> {
  const sid = storeId ?? (await resolveStoreId());
  const { data } = await db().from("staff_shifts").select("*")
    .eq("store_id", sid).eq("staff_id", staffId).is("payment_id", null).order("noite");
  const rows = (data ?? []) as Array<{ id: number; staff_id: string; noite: string; diaria_cents: number; bonus_cents: number; source: string; checked_in_at: string }>;
  const nome = (await listStaff(sid)).find((s) => s.id === staffId)?.name ?? "—";
  return rows.map((r) => ({
    id: num(r.id), staffId: String(r.staff_id), name: nome, noite: String(r.noite).slice(0, 10),
    diariaCents: num(r.diaria_cents), bonusCents: num(r.bonus_cents), source: r.source, checkedInAt: r.checked_in_at,
  }));
}

/** Registra o PAGAMENTO das noites em aberto: gera o recibo e carimba as noites (anti-2x).
 *  Recalcula o total NO SERVIDOR (a tela é só preview). Se o carimbo falhar, apaga o recibo
 *  — não deixa pagamento órfão. `shiftIds` vazio = paga todas as noites em aberto. */
export async function payShifts(
  staffId: string,
  opts: { shiftIds?: number[]; notes?: string; paidBy?: string } = {},
  storeId?: string,
): Promise<StaffPayment> {
  const sid = storeId ?? (await resolveStoreId());
  const d = db();
  const abertas = await shiftsAPagar(staffId, sid);
  const alvo = opts.shiftIds?.length ? abertas.filter((s) => opts.shiftIds!.includes(s.id)) : abertas;
  if (!alvo.length) throw new Error("Nenhuma noite em aberto pra pagar.");

  const totalCents = alvo.reduce((s, x) => s + x.diariaCents + x.bonusCents, 0);
  if (totalCents <= 0) throw new Error("O total a pagar está zerado — confira a diária das noites.");
  const noites = alvo.map((s) => s.noite).sort();

  const { data: pay, error } = await d.from("staff_payments").insert({
    store_id: sid, staff_id: staffId, total_cents: totalCents, noites: alvo.length,
    period_start: noites[0], period_end: noites[noites.length - 1],
    notes: opts.notes?.trim() || null, paid_by: opts.paidBy ?? null,
  }).select("*").single();
  if (error || !pay) throw new Error("Falha ao registrar o pagamento: " + (error?.message ?? ""));
  const payId = num((pay as { id: number }).id);

  // carimba SÓ as que ainda estão em aberto (.is null) — se outra sessão pagou em paralelo,
  // o número não bate e o recibo é desfeito (mesmo padrão anti-corrida da comissão de OS).
  const { data: carimbadas, error: upErr } = await d.from("staff_shifts")
    .update({ payment_id: payId }).eq("store_id", sid).in("id", alvo.map((s) => s.id)).is("payment_id", null).select("id");
  if (upErr || (carimbadas ?? []).length !== alvo.length) {
    await d.from("staff_shifts").update({ payment_id: null }).eq("store_id", sid).eq("payment_id", payId);
    await d.from("staff_payments").delete().eq("id", payId).eq("store_id", sid);
    throw new Error("Uma das noites foi paga em paralelo — pagamento cancelado, tente de novo.");
  }

  return {
    id: payId, staffId, name: alvo[0].name, totalCents, noites: alvo.length,
    periodStart: noites[0], periodEnd: noites[noites.length - 1],
    notes: opts.notes?.trim() || null, paidBy: opts.paidBy ?? null,
    paidAt: String((pay as { paid_at: string }).paid_at),
  };
}

/** Histórico de pagamentos (recibos) — vira despesa sintética no Financeiro. */
export async function listStaffPayments(storeId?: string): Promise<StaffPayment[]> {
  const sid = storeId ?? (await resolveStoreId());
  const { data } = await db().from("staff_payments").select("*").eq("store_id", sid).order("paid_at", { ascending: false });
  const rows = (data ?? []) as Array<{ id: number; staff_id: string; total_cents: number; noites: number; period_start: string | null; period_end: string | null; notes: string | null; paid_by: string | null; paid_at: string }>;
  if (!rows.length) return [];
  const nomeById = new Map((await listStaff(sid)).map((s) => [s.id, s.name]));
  return rows.map((r) => ({
    id: num(r.id), staffId: String(r.staff_id), name: nomeById.get(String(r.staff_id)) ?? "—",
    totalCents: num(r.total_cents), noites: num(r.noites),
    periodStart: r.period_start ? String(r.period_start).slice(0, 10) : null,
    periodEnd: r.period_end ? String(r.period_end).slice(0, 10) : null,
    notes: r.notes, paidBy: r.paid_by, paidAt: r.paid_at,
  }));
}

/** Estorna o recibo: devolve as noites pra "a pagar" e apaga o pagamento. */
export async function reverseStaffPayment(paymentId: number, storeId?: string): Promise<void> {
  const sid = storeId ?? (await resolveStoreId());
  const d = db();
  await d.from("staff_shifts").update({ payment_id: null }).eq("store_id", sid).eq("payment_id", paymentId);
  await d.from("staff_payments").delete().eq("id", paymentId).eq("store_id", sid);
}
