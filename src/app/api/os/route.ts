import { NextResponse } from "next/server";
import { getCurrentMembership } from "@/lib/auth/store";
import { createServiceOrder, updateOSStatus, updateOSDiagnosis, updateOSNotes, updateOSEstimate, addOSPhoto, removeOSPhoto, createMontagemOS, quitarOS, assignTechnician, getServiceOrder, searchServiceOrders, type OSStatus, type MontagemPart } from "@/lib/service-orders-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Ações que o TÉCNICO pode fazer (só na OS DELE): trabalhar a bancada, nunca cobrar/atribuir.
const TEC_ACTIONS = new Set(["status", "diagnosis", "notes", "estimate", "photo-add", "photo-remove"]);
// Status que o técnico pode setar (fluxo de bancada; entregue/cancelado são da recepção).
const TEC_STATUSES = new Set(["aguardando", "em_reparo", "pronto"]);

// Busca de balcão (recepção): GET ?q= → OS por código/nome/telefone. Técnico só vê as dele.
export async function GET(req: Request) {
  const m = await getCurrentMembership();
  if (!m) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const q = new URL(req.url).searchParams.get("q") ?? "";
  let results = await searchServiceOrders(q, m.store.id);
  if (m.role === "technician") results = results.filter((o) => o.staffId === m.technicianId);
  return NextResponse.json({
    results: results.map((o) => ({ id: o.id, code: o.code, customerName: o.customerName, device: o.device, status: o.status, paymentStatus: o.paymentStatus })),
  });
}

// Ordens de serviço (assistência técnica). POST {action,payload}.
// GUARD DE PAPEL (server-side): owner/recepção = full; técnico só status/laudo/foto na PRÓPRIA OS.
export async function POST(req: Request) {
  const m = await getCurrentMembership();
  if (!m) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const storeId = m.store.id;
  let b: { action?: string; payload?: Record<string, unknown> };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "body inválido" }, { status: 400 });
  }
  const p = b.payload ?? {};

  // Cerca do técnico: só ações de bancada, só na OS atribuída a ele, status só de bancada.
  if (m.role === "technician") {
    if (!b.action || !TEC_ACTIONS.has(b.action)) return NextResponse.json({ error: "Sem permissão para esta ação." }, { status: 403 });
    const res = await getServiceOrder(String(p.id ?? ""), storeId);
    if (!res || !m.technicianId || res.os.staffId !== m.technicianId) return NextResponse.json({ error: "Essa OS não é sua." }, { status: 403 });
    if (b.action === "status" && !TEC_STATUSES.has(String(p.status))) return NextResponse.json({ error: "Você não pode definir esse status." }, { status: 403 });
  }

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
          devicePassword: p.devicePassword ? String(p.devicePassword) : undefined,
          problem: p.problem ? String(p.problem) : undefined,
          serviceValueCents: p.serviceValueCents != null ? Number(p.serviceValueCents) : undefined,
        }, storeId);
        return NextResponse.json({ ok: true, id: os.id });
      }
      case "status":
        await updateOSStatus(String(p.id), String(p.status) as OSStatus, storeId);
        return NextResponse.json({ ok: true });
      case "diagnosis":
        await updateOSDiagnosis(String(p.id), String(p.diagnosis ?? ""), storeId);
        return NextResponse.json({ ok: true });
      case "notes":
        await updateOSNotes(String(p.id), String(p.notes ?? ""), storeId);
        return NextResponse.json({ ok: true });
      case "estimate":
        await updateOSEstimate(String(p.id), String(p.date ?? ""), storeId);
        return NextResponse.json({ ok: true });
      case "photo-add": {
        const url = String(p.url ?? "").trim();
        if (!url) return NextResponse.json({ error: "URL da foto ausente." }, { status: 400 });
        await addOSPhoto(String(p.id), { url, label: String(p.label ?? "").trim(), at: new Date().toISOString() }, storeId);
        return NextResponse.json({ ok: true });
      }
      case "photo-remove":
        await removeOSPhoto(String(p.id), String(p.url ?? ""), storeId);
        return NextResponse.json({ ok: true });
      case "quitar":
        await quitarOS(String(p.id), p.paymentMethod ? String(p.paymentMethod) : undefined, storeId);
        return NextResponse.json({ ok: true });
      case "entregar": {
        // Recepção entrega a OS pronta: se ainda não quitou, cobra agora (precisa da forma) e
        // dá baixa; depois marca entregue. OS já quitada só marca entregue. (não é ação do técnico)
        const osId = String(p.id);
        const cur = await getServiceOrder(osId, storeId);
        if (!cur) return NextResponse.json({ error: "OS não encontrada" }, { status: 404 });
        if (cur.os.paymentStatus !== "quitada") {
          const pm = p.paymentMethod ? String(p.paymentMethod) : "";
          if (!pm) return NextResponse.json({ error: "Informe a forma de pagamento pra entregar." }, { status: 400 });
          await quitarOS(osId, pm, storeId);
        }
        await updateOSStatus(osId, "entregue", storeId);
        return NextResponse.json({ ok: true });
      }
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
