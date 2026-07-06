import { NextResponse } from "next/server";
import { resolveStoreId } from "@/lib/auth/current";
import { listCoupons, createCoupon, setCouponActive, deleteCoupon, getCouponByCode, computeCouponDiscount } from "@/lib/coupons-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cupom de DESCONTO (core). GET = lista. POST {action,payload} = CRUD.
export async function GET() {
  const storeId = await resolveStoreId();
  const coupons = await listCoupons(storeId);
  return NextResponse.json({ coupons });
}

export async function POST(req: Request) {
  const storeId = await resolveStoreId();
  let b: { action?: string; payload?: Record<string, unknown> };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "body inválido" }, { status: 400 });
  }
  const p = b.payload ?? {};
  try {
    switch (b.action) {
      case "create": {
        const c = await createCoupon(p as never, storeId);
        return NextResponse.json({ ok: true, id: c.id });
      }
      case "toggle":
        await setCouponActive(String(p.id), Boolean(p.active), storeId);
        return NextResponse.json({ ok: true });
      case "delete":
        await deleteCoupon(String(p.id), storeId);
        return NextResponse.json({ ok: true });
      case "validate": {
        // aplicar cupom no PDV/Balcão: valida o código + calcula o desconto pro subtotal informado.
        const coupon = await getCouponByCode(String(p.code ?? ""), storeId);
        if (!coupon) return NextResponse.json({ ok: false, reason: "Cupom não encontrado" });
        const res = computeCouponDiscount(coupon, Math.max(0, Math.round(Number(p.subtotalCents ?? 0))));
        if (!res.ok) return NextResponse.json({ ok: false, reason: res.reason });
        return NextResponse.json({ ok: true, couponId: coupon.id, code: coupon.code, discountCents: res.discountCents });
      }
      default:
        return NextResponse.json({ error: "ação inválida" }, { status: 400 });
    }
  } catch (e) {
    console.error("cupons:", e);
    return NextResponse.json({ error: "Não consegui salvar." }, { status: 500 });
  }
}
