// ComandaPRO — CORE: cupom de DESCONTO (≠ cupom de impressão/recibo térmico). Governa o desconto que
// já existe (orders.discountCents): aplica um código com regra em vez de % / R$ solto do operador.
// Server-side, por loja, em CENTAVOS. Split serviço/peça NÃO entra aqui (é do vertical de assistência técnica).
import { db } from "@/lib/supabase";
import { resolveStoreId } from "@/lib/auth/current";

const num = (v: unknown) => Number(v ?? 0);
const nOrNull = (v: unknown) => (v == null ? null : Number(v));

export type CouponKind = "percentual" | "valor";

export type Coupon = {
  id: string;
  code: string;
  description: string;
  kind: CouponKind;
  percent: number | null;             // kind=percentual
  value_cents: number | null;         // kind=valor
  min_subtotal_cents: number | null;
  max_discount_cents: number | null;
  valid_from: string | null;
  valid_until: string | null;
  usage_limit: number | null;
  used_count: number;
  active: boolean;
};

const toCoupon = (r: Record<string, unknown>): Coupon => ({
  id: String(r.id),
  code: String(r.code ?? ""),
  description: String(r.description ?? ""),
  kind: r.kind === "valor" ? "valor" : "percentual",
  percent: nOrNull(r.percent),
  value_cents: nOrNull(r.value_cents),
  min_subtotal_cents: nOrNull(r.min_subtotal_cents),
  max_discount_cents: nOrNull(r.max_discount_cents),
  valid_from: r.valid_from ? String(r.valid_from) : null,
  valid_until: r.valid_until ? String(r.valid_until) : null,
  usage_limit: nOrNull(r.usage_limit),
  used_count: num(r.used_count),
  active: Boolean(r.active),
});

export async function listCoupons(storeId?: string): Promise<Coupon[]> {
  const sid = storeId ?? (await resolveStoreId());
  const { data } = await db().from("coupons").select("*").eq("store_id", sid).order("created_at", { ascending: false });
  return ((data ?? []) as Record<string, unknown>[]).map(toCoupon);
}

/** Busca por código (case-insensitive). null se não existe. */
export async function getCouponByCode(code: string, storeId?: string): Promise<Coupon | null> {
  const sid = storeId ?? (await resolveStoreId());
  const { data } = await db().from("coupons").select("*").eq("store_id", sid).ilike("code", code.trim()).maybeSingle();
  return data ? toCoupon(data as Record<string, unknown>) : null;
}

export type CouponInput = {
  code: string;
  description?: string;
  kind: CouponKind;
  percent?: number | null;
  value_cents?: number | null;
  min_subtotal_cents?: number | null;
  max_discount_cents?: number | null;
  valid_from?: string | null;
  valid_until?: string | null;
  usage_limit?: number | null;
  active?: boolean;
};

export async function createCoupon(input: CouponInput, storeId?: string): Promise<Coupon> {
  const sid = storeId ?? (await resolveStoreId());
  const { data, error } = await db().from("coupons").insert({
    store_id: sid,
    code: input.code.trim().toUpperCase(),
    description: input.description?.trim() ?? "",
    kind: input.kind,
    percent: input.kind === "percentual" ? Math.max(0, Number(input.percent ?? 0)) : null,
    value_cents: input.kind === "valor" ? Math.max(0, Math.round(Number(input.value_cents ?? 0))) : null,
    min_subtotal_cents: input.min_subtotal_cents ?? null,
    max_discount_cents: input.max_discount_cents ?? null,
    valid_from: input.valid_from ?? null,
    valid_until: input.valid_until ?? null,
    usage_limit: input.usage_limit ?? null,
    active: input.active ?? true,
  }).select("*").single();
  if (error || !data) throw new Error(error?.message ?? "Falha ao criar cupom.");
  return toCoupon(data);
}

export async function setCouponActive(id: string, active: boolean, storeId?: string): Promise<void> {
  const sid = storeId ?? (await resolveStoreId());
  await db().from("coupons").update({ active }).eq("id", id).eq("store_id", sid);
}

export async function deleteCoupon(id: string, storeId?: string): Promise<void> {
  const sid = storeId ?? (await resolveStoreId());
  await db().from("coupons").delete().eq("id", id).eq("store_id", sid);
}

/** Incrementa o uso — chamar quando a venda com o cupom é confirmada. Best-effort (não trava a venda). */
export async function incrementCouponUsage(id: string, storeId?: string): Promise<void> {
  const sid = storeId ?? (await resolveStoreId());
  const { data } = await db().from("coupons").select("used_count").eq("id", id).eq("store_id", sid).maybeSingle();
  const current = data ? num((data as Record<string, unknown>).used_count) : 0;
  await db().from("coupons").update({ used_count: current + 1 }).eq("id", id).eq("store_id", sid);
}

/**
 * Valida + calcula o desconto em CENTAVOS sobre um subtotal. É o que alimenta orders.discountCents.
 * `now` injetável pra teste. NÃO faz split serviço/peça (core food = um bucket só); o vertical de AT
 * estende isso depois. Nunca desconta mais que o subtotal nem menos que zero.
 */
export function computeCouponDiscount(
  coupon: Coupon,
  subtotalCents: number,
  now: Date = new Date(),
): { ok: true; discountCents: number } | { ok: false; reason: string } {
  if (!coupon.active) return { ok: false, reason: "Cupom inativo" };
  if (coupon.valid_from && new Date(coupon.valid_from) > now) return { ok: false, reason: "Cupom ainda não vigente" };
  if (coupon.valid_until && new Date(coupon.valid_until) < now) return { ok: false, reason: "Cupom expirado" };
  if (coupon.usage_limit != null && coupon.used_count >= coupon.usage_limit) return { ok: false, reason: "Cupom esgotado" };
  if (coupon.min_subtotal_cents != null && subtotalCents < coupon.min_subtotal_cents)
    return { ok: false, reason: `Exige mínimo de ${brl(coupon.min_subtotal_cents)}` };
  if (subtotalCents <= 0) return { ok: false, reason: "Sem valor pra descontar" };

  let discount = coupon.kind === "percentual"
    ? Math.round(subtotalCents * (num(coupon.percent) / 100))
    : Math.round(num(coupon.value_cents));
  if (coupon.max_discount_cents != null) discount = Math.min(discount, coupon.max_discount_cents);
  discount = Math.max(0, Math.min(discount, subtotalCents)); // clampa em [0, subtotal]
  return { ok: true, discountCents: discount };
}

function brl(cents: number) {
  return `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
