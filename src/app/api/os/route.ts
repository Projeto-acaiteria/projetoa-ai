import { NextResponse } from "next/server";
import { resolveStoreId } from "@/lib/auth/current";
import { createServiceOrder, updateOSStatus, createMontagemOS, quitarOS, assignTechnician, type OSStatus, type MontagemPart } from "@/lib/service-orders-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Ordens de serviço (assistência técnica). POST {action,payload}: create (check-in) | status.
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
        const name = String(p.customerName ?? "").trim();
        const device = String(p.device ?? "").trim();
        if (!name || !device) return NextResponse.json({ error: "Informe cliente e aparelho." }, { status: 400 });
        const os = await createServiceOrder({
          customerName: name,
          customerPhone: p.customerPhone ? String(p.customerPhone) : undefined,
          device,
          imei: p.imei ? String(p.imei) : undefined,
          problem: p.problem ? String(p.problem) : undefined,
          serviceValueCents: p.serviceValueCents != null ? Number(p.serviceValueCents) : undefined,
        }, storeId);
        return NextResponse.json({ ok: true, id: os.id });
      }
      case "status":
        await updateOSStatus(String(p.id), String(p.status) as OSStatus, storeId);
        return NextResponse.json({ ok: true });
      case "quitar":
        await quitarOS(String(p.id), p.paymentMethod ? String(p.paymentMethod) : undefined, storeId);
        return NextResponse.json({ ok: true });
      case "assign":
        await assignTechnician(String(p.id), String(p.staffId), storeId);
        return NextResponse.json({ ok: true });
      case "montagem": {
        const parts = Array.isArray(p.parts) ? (p.parts as MontagemPart[]) : [];
        if (!parts.length) return NextResponse.json({ error: "Nenhuma peça na montagem." }, { status: 400 });
        const os = await createMontagemOS({
          customerName: String(p.customerName ?? "").trim() || "Cliente",
          customerPhone: p.customerPhone ? String(p.customerPhone) : undefined,
          parts,
          montagemFeeCents: p.montagemFeeCents != null ? Number(p.montagemFeeCents) : undefined,
        }, storeId);
        return NextResponse.json({ ok: true, id: os.id });
      }
      default:
        return NextResponse.json({ error: "ação inválida" }, { status: 400 });
    }
  } catch (e) {
    console.error("os:", e);
    return NextResponse.json({ error: "Não consegui salvar a OS." }, { status: 500 });
  }
}
