// ComandaPRO — vertical de ASSISTÊNCIA TÉCNICA: ordens de serviço (OS). Server-side, por loja, em centavos.
// Técnico reusa staff (staff_id). Comissão = service_value da OS QUITADA (peça nunca entra na base).
import { db } from "@/lib/supabase";
import { resolveStoreId } from "@/lib/auth/current";

const num = (v: unknown) => Number(v ?? 0);
const str = (v: unknown) => (v == null ? null : String(v));

export type OSStatus = "aguardando" | "em_reparo" | "pronto" | "entregue" | "cancelado";
export type OSPaymentStatus = "aberta" | "parcial" | "quitada";

export type OSPart = { id: string; sku: string | null; name: string; qty: number; unitCostCents: number };

// Foto do aparelho anexada pelo técnico (antes/depois do reparo). url = pública do Storage.
export type OSPhoto = { url: string; label: string; at: string };

export type ServiceOrder = {
  id: string;
  code: string | null;
  customerName: string;
  customerPhone: string;
  device: string;
  imei: string | null;
  problem: string;
  diagnosis: string | null;
  status: OSStatus;
  staffId: string | null;
  commissionPercent: number;
  serviceValueCents: number;
  partsValueCents: number;
  discountCents: number;
  totalCents: number;
  paymentStatus: OSPaymentStatus;
  paidAt: string | null;
  paymentMethod: string | null;
  photos: OSPhoto[];
  devicePassword: string | null; // senha p/ destravar o aparelho (recepção captura, técnico usa)
  notes: string | null; // anotações de bancada do técnico (separado do laudo oficial)
  estimatedAt: string | null; // prazo estimado de conclusão (o técnico define) — ISO fim-do-dia BR
  createdAt: string;
};

const STATUSES: OSStatus[] = ["aguardando", "em_reparo", "pronto", "entregue", "cancelado"];
const asStatus = (v: unknown): OSStatus => (STATUSES.includes(v as OSStatus) ? (v as OSStatus) : "aguardando");
const asPay = (v: unknown): OSPaymentStatus => (v === "quitada" ? "quitada" : v === "parcial" ? "parcial" : "aberta");

const toOS = (r: Record<string, unknown>): ServiceOrder => ({
  id: String(r.id),
  code: str(r.code),
  customerName: String(r.customer_name ?? ""),
  customerPhone: String(r.customer_phone ?? ""),
  device: String(r.device ?? ""),
  imei: str(r.imei),
  problem: String(r.problem ?? ""),
  diagnosis: str(r.diagnosis),
  status: asStatus(r.status),
  staffId: str(r.staff_id),
  commissionPercent: num(r.commission_percent),
  serviceValueCents: num(r.service_value_cents),
  partsValueCents: num(r.parts_value_cents),
  discountCents: num(r.discount_cents),
  totalCents: num(r.total_cents),
  paymentStatus: asPay(r.payment_status),
  paidAt: str(r.paid_at),
  paymentMethod: str(r.payment_method),
  photos: Array.isArray(r.photos) ? (r.photos as OSPhoto[]) : [],
  devicePassword: str(r.device_password),
  notes: str(r.notes),
  estimatedAt: str(r.estimated_at),
  createdAt: String(r.created_at ?? ""),
});

/** Comissão da OS em centavos: só nasce quando QUITADA; sempre sobre service_value (nunca peça). */
export function osCommissionCents(os: ServiceOrder): number {
  if (os.paymentStatus !== "quitada") return 0;
  return Math.round((os.serviceValueCents * os.commissionPercent) / 100);
}

export async function listServiceOrders(
  opts?: { status?: OSStatus; staffId?: string },
  storeId?: string,
): Promise<ServiceOrder[]> {
  const sid = storeId ?? (await resolveStoreId());
  let q = db().from("service_orders").select("*").eq("store_id", sid);
  if (opts?.status) q = q.eq("status", opts.status);
  if (opts?.staffId) q = q.eq("staff_id", opts.staffId);
  const { data } = await q.order("created_at", { ascending: false });
  return ((data ?? []) as Record<string, unknown>[]).map(toOS);
}

/** OS de um técnico (a "agenda dele"). */
/** Busca de balcão: acha OS por código, nome do cliente ou telefone. Store-scoped, top 12. */
export async function searchServiceOrders(query: string, storeId?: string): Promise<ServiceOrder[]> {
  const sid = storeId ?? (await resolveStoreId());
  // sanitiza: o filtro .or() do PostgREST quebra com vírgula/parênteses — deixa só alfanumérico e espaço
  const q = query.trim().replace(/[^\p{L}\p{N}\s@.-]/gu, "").slice(0, 40);
  if (q.length < 2) return [];
  const { data } = await db().from("service_orders").select("*").eq("store_id", sid)
    .or(`code.ilike.%${q}%,customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%`)
    .order("created_at", { ascending: false })
    .limit(12);
  return ((data ?? []) as Record<string, unknown>[]).map(toOS);
}

export async function listByTechnician(staffId: string, storeId?: string): Promise<ServiceOrder[]> {
  return listServiceOrders({ staffId }, storeId);
}

export async function getServiceOrder(id: string, storeId?: string): Promise<{ os: ServiceOrder; parts: OSPart[] } | null> {
  const sid = storeId ?? (await resolveStoreId());
  const { data } = await db().from("service_orders").select("*").eq("id", id).eq("store_id", sid).maybeSingle();
  if (!data) return null;
  const { data: p } = await db().from("os_parts").select("*").eq("os_id", id).eq("store_id", sid);
  const parts: OSPart[] = ((p ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id), sku: str(r.sku), name: String(r.name ?? ""), qty: num(r.qty), unitCostCents: num(r.unit_cost_cents),
  }));
  return { os: toOS(data as Record<string, unknown>), parts };
}

export type NewOSInput = {
  customerName: string;
  customerPhone?: string;
  device: string;
  imei?: string;
  devicePassword?: string;
  problem?: string;
  staffId?: string;
  commissionPercent?: number;
  serviceValueCents?: number;
  partsValueCents?: number;
};

// código curto rastreável da OS (mesmo espírito do pedido) — sem O/0/I/1/L pra não confundir ao ditar
const OS_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function genOSCode(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += OS_CODE_ALPHABET[Math.floor(Math.random() * OS_CODE_ALPHABET.length)];
  return s;
}

export async function createServiceOrder(input: NewOSInput, storeId?: string): Promise<ServiceOrder> {
  const sid = storeId ?? (await resolveStoreId());
  const service = Math.max(0, Math.round(input.serviceValueCents ?? 0));
  const parts = Math.max(0, Math.round(input.partsValueCents ?? 0));
  const { data, error } = await db().from("service_orders").insert({
    store_id: sid,
    code: genOSCode(),
    customer_name: input.customerName.trim(),
    customer_phone: (input.customerPhone ?? "").trim(),
    device: input.device.trim(),
    imei: input.imei?.trim() || null,
    device_password: input.devicePassword?.trim() || null,
    problem: (input.problem ?? "").trim(),
    staff_id: input.staffId ?? null,
    commission_percent: Math.max(0, Number(input.commissionPercent ?? 0)),
    service_value_cents: service,
    parts_value_cents: parts,
    total_cents: service + parts,
    status: "aguardando",
    payment_status: "aberta",
  }).select("*").single();
  if (error || !data) throw new Error(error?.message ?? "Falha ao abrir OS.");
  return toOS(data);
}

export async function updateOSStatus(id: string, status: OSStatus, storeId?: string): Promise<void> {
  const sid = storeId ?? (await resolveStoreId());
  await db().from("service_orders").update({ status, updated_at: new Date().toISOString() }).eq("id", id).eq("store_id", sid);
}

/** Laudo técnico (diagnosis) — o que o técnico achou/fez. Texto livre. */
export async function updateOSDiagnosis(id: string, diagnosis: string, storeId?: string): Promise<void> {
  const sid = storeId ?? (await resolveStoreId());
  await db().from("service_orders").update({ diagnosis: diagnosis.trim() || null, updated_at: new Date().toISOString() }).eq("id", id).eq("store_id", sid);
}

/** Anotações de bancada do técnico (notes) — rascunho de trabalho, não o laudo oficial. */
export async function updateOSNotes(id: string, notes: string, storeId?: string): Promise<void> {
  const sid = storeId ?? (await resolveStoreId());
  await db().from("service_orders").update({ notes: notes.trim() || null, updated_at: new Date().toISOString() }).eq("id", id).eq("store_id", sid);
}

/** Prazo estimado de conclusão. Recebe YYYY-MM-DD (ou vazio pra limpar). Guarda no FIM do dia BR
 *  (23:59:59-03:00) — só fica "atrasada" depois que o dia passa de verdade (λ.fuso-vercel-utc). */
export async function updateOSEstimate(id: string, ymd: string, storeId?: string): Promise<void> {
  const sid = storeId ?? (await resolveStoreId());
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(ymd.trim()) ? new Date(`${ymd.trim()}T23:59:59-03:00`).toISOString() : null;
  await db().from("service_orders").update({ estimated_at: iso, updated_at: new Date().toISOString() }).eq("id", id).eq("store_id", sid);
}

/** Anexa 1 foto do aparelho (antes/depois). Lê o array atual e faz append (patch por-linha). */
export async function addOSPhoto(id: string, photo: OSPhoto, storeId?: string): Promise<void> {
  const sid = storeId ?? (await resolveStoreId());
  const { data: row } = await db().from("service_orders").select("photos").eq("id", id).eq("store_id", sid).maybeSingle();
  const cur = Array.isArray((row as { photos?: unknown })?.photos) ? ((row as { photos: OSPhoto[] }).photos) : [];
  await db().from("service_orders").update({ photos: [...cur, photo], updated_at: new Date().toISOString() }).eq("id", id).eq("store_id", sid);
}

/** Remove 1 foto da OS pela url. */
export async function removeOSPhoto(id: string, url: string, storeId?: string): Promise<void> {
  const sid = storeId ?? (await resolveStoreId());
  const { data: row } = await db().from("service_orders").select("photos").eq("id", id).eq("store_id", sid).maybeSingle();
  const cur = Array.isArray((row as { photos?: unknown })?.photos) ? ((row as { photos: OSPhoto[] }).photos) : [];
  await db().from("service_orders").update({ photos: cur.filter((p) => p.url !== url), updated_at: new Date().toISOString() }).eq("id", id).eq("store_id", sid);
}

/** Quita a OS: marca paga (nasce a comissão, via osCommissionCents) e dá BAIXA no estoque das peças.
 *  A baixa é best-effort (peça sem SKU no estoque não trava a quitação). */
export async function quitarOS(id: string, paymentMethod?: string, storeId?: string): Promise<void> {
  const sid = storeId ?? (await resolveStoreId());
  const now = new Date().toISOString();
  await db().from("service_orders").update({
    payment_status: "quitada", paid_at: now, payment_method: paymentMethod ?? null, updated_at: now,
  }).eq("id", id).eq("store_id", sid);
  try {
    const { data: parts } = await db().from("os_parts").select("sku, qty").eq("os_id", id).eq("store_id", sid);
    for (const p of (parts ?? []) as { sku: string | null; qty: number }[]) {
      if (!p.sku) continue;
      const { data: item } = await db().from("stock_items").select("data").eq("store_id", sid).eq("id", p.sku).maybeSingle();
      if (!item) continue;
      const d = (item as { data: Record<string, unknown> }).data ?? {};
      const newQty = Math.max(0, Number(d.qty ?? 0) - Number(p.qty ?? 0));
      await db().from("stock_items").update({ data: { ...d, qty: newQty, updatedAt: now.slice(0, 10) } }).eq("store_id", sid).eq("id", p.sku);
    }
  } catch { /* baixa não-fatal */ }
}

/** Atribui um técnico (staff) à OS e puxa o % de comissão dele. */
export async function assignTechnician(osId: string, staffId: string, storeId?: string): Promise<void> {
  const sid = storeId ?? (await resolveStoreId());
  const { data: st } = await db().from("staff").select("commission_percent").eq("id", staffId).eq("store_id", sid).maybeSingle();
  const pct = st ? Number((st as { commission_percent: number }).commission_percent) : 0;
  await db().from("service_orders").update({ staff_id: staffId, commission_percent: pct, updated_at: new Date().toISOString() }).eq("id", osId).eq("store_id", sid);
}

// Peça de uma montagem (componente escolhido no montador). priceCents = preço de venda cobrado.
export type MontagemPart = { sku: string; name: string; priceCents: number };

/** Gera uma OS de MONTAGEM: cria a service_order + os_parts de cada componente.
 *  parts_value = soma das peças; service_value = taxa de montagem (mão-de-obra). */
export async function createMontagemOS(
  input: { customerName: string; customerPhone?: string; parts: MontagemPart[]; montagemFeeCents?: number; staffId?: string; commissionPercent?: number },
  storeId?: string,
): Promise<ServiceOrder> {
  const sid = storeId ?? (await resolveStoreId());
  const partsValue = input.parts.reduce((s, p) => s + Math.max(0, Math.round(p.priceCents)), 0);
  const service = Math.max(0, Math.round(input.montagemFeeCents ?? 0));
  const { data, error } = await db().from("service_orders").insert({
    store_id: sid,
    code: genOSCode(),
    customer_name: input.customerName.trim(),
    customer_phone: (input.customerPhone ?? "").trim(),
    device: `Montagem de PC (${input.parts.length} peças)`,
    problem: "Montagem de PC / setup",
    staff_id: input.staffId ?? null,
    commission_percent: Math.max(0, Number(input.commissionPercent ?? 0)),
    service_value_cents: service,
    parts_value_cents: partsValue,
    total_cents: service + partsValue,
    status: "aguardando",
    payment_status: "aberta",
  }).select("*").single();
  if (error || !data) throw new Error(error?.message ?? "Falha ao gerar a OS de montagem.");
  const osId = String((data as Record<string, unknown>).id);
  if (input.parts.length) {
    const partRows = input.parts.map((p) => ({
      store_id: sid, os_id: osId, sku: p.sku, name: p.name, qty: 1, unit_cost_cents: Math.max(0, Math.round(p.priceCents)),
    }));
    await db().from("os_parts").insert(partRows);
  }
  return toOS(data);
}

export const OS_STATUS_LABEL: Record<OSStatus, string> = {
  aguardando: "Aguardando",
  em_reparo: "Em reparo",
  pronto: "Pronto p/ retirada",
  entregue: "Entregue",
  cancelado: "Cancelado",
};
