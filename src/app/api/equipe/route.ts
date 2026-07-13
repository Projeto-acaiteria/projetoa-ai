import { NextResponse } from "next/server";
import { getCurrentStore, getCurrentRole } from "@/lib/auth/store";
import { getStoreConfig } from "@/lib/auth/store-config";
import { familyOf } from "@/config/segments";
import {
  listStaff,
  staffReport,
  createStaff,
  updateStaff,
  deleteStaff,
  createStaffAccess,
  type StaffLoginRole,
} from "@/lib/staff-store";
import { listServiceOrders, osCommissionCents } from "@/lib/service-orders-store";
import {
  listCommissionPayments,
  pendingOSForStaff,
  payCommission,
  reverseCommissionPayment,
} from "@/lib/commission-payments-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// /api/equipe — EQUIPE do vertical SERVICE (Starteq): técnicos (com comissão) e recepção, cada um
// com login próprio. Endpoint DEDICADO (NÃO toca /api/garcons, compartilhada com food).
// Blindado em 3 camadas em TODA operação:
//   1. autenticado (senão 401).
//   2. family==="service" → food (Cantinho/Medellín) recebe 403 e nunca chega ao banco.
//   3. role==="owner" → recepção/técnico não gerenciam a própria equipe.
//   storeId vem SEMPRE da SESSÃO — nunca do body → não vaza tenant.

type Guard = { store: { id: string } } | { error: NextResponse };

async function guard(): Promise<Guard> {
  const store = await getCurrentStore();
  if (!store) return { error: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) };
  const cfg = await getStoreConfig(store.id);
  if (familyOf(cfg?.business_type) !== "service") {
    return { error: NextResponse.json({ error: "Indisponível neste tipo de loja" }, { status: 403 }) };
  }
  const role = await getCurrentRole();
  if (role !== "owner") {
    return { error: NextResponse.json({ error: "Sem permissão" }, { status: 403 }) };
  }
  return { store };
}

// Papéis de login que a tela de Equipe cria (recepção e técnico são de 1ª classe no service).
const LOGIN_ROLES: StaffLoginRole[] = ["technician", "reception"];
const asLoginRole = (v: unknown): StaffLoginRole => (v === "reception" ? "reception" : "technician");

// GET — acerto por membro no período. Base = TODA a equipe (listStaff, inclui inativos p/ reativar).
// Comissão real do técnico vem das OS QUITADAS no período (service_value × %; peça nunca entra),
// não das comandas de bar — por isso o service usa service_orders, não o acerto de tabs do garçom.
// staffReport (com os papéis de service) dá quem já tem login. from/to por querystring (por paid_at).
export async function GET(req: Request) {
  const g = await guard();
  if ("error" in g) return g.error;
  const sid = g.store.id;

  const url = new URL(req.url);
  const staffParam = url.searchParams.get("staff");

  // DETALHE de 1 técnico (base do wizard "Registrar Pagamento"): OS pendentes + histórico de pagamentos.
  if (staffParam) {
    const [pending, payments] = await Promise.all([
      pendingOSForStaff(staffParam, sid),
      listCommissionPayments(staffParam, sid),
    ]);
    const pendingOut = pending.map((os) => ({
      id: os.id,
      code: os.code,
      device: os.device,
      customerName: os.customerName,
      paidAt: os.paidAt,
      serviceValueCents: os.serviceValueCents,
      commissionPercent: os.commissionPercent,
      comissaoCents: osCommissionCents(os),
    }));
    return NextResponse.json({ pending: pendingOut, payments });
  }

  const from = url.searchParams.get("from") || undefined;
  const to = url.searchParams.get("to") || undefined;

  const [staff, report, orders] = await Promise.all([
    listStaff(sid),
    staffReport(from, to, sid, LOGIN_ROLES),
    listServiceOrders(undefined, sid),
  ]);

  const withLogin = new Set(report.filter((r) => r.hasLogin).map((r) => r.id));

  // por técnico: comissão gerada no PERÍODO (paid_at) + pendente ALL-TIME (o que ainda se deve pagar).
  type Agg = { osCount: number; comissaoCents: number; servicoCents: number; pendenteCents: number; pendenteCount: number };
  const byStaff = new Map<string, Agg>();
  const bump = (id: string): Agg => {
    const a = byStaff.get(id) ?? { osCount: 0, comissaoCents: 0, servicoCents: 0, pendenteCents: 0, pendenteCount: 0 };
    byStaff.set(id, a);
    return a;
  };
  for (const os of orders) {
    if (os.paymentStatus !== "quitada" || !os.staffId) continue;
    const comm = osCommissionCents(os);
    // pendente = comissão ainda não paga (sem vínculo a um pagamento) — independe do período
    if (!os.commissionPaymentId && comm > 0) {
      const a = bump(os.staffId);
      a.pendenteCents += comm;
      a.pendenteCount += 1;
    }
    // stats do período
    if (from && (!os.paidAt || os.paidAt < from)) continue;
    if (to && (!os.paidAt || os.paidAt > to)) continue;
    const a = bump(os.staffId);
    a.osCount += 1;
    a.comissaoCents += comm;
    a.servicoCents += os.serviceValueCents;
  }

  const acerto = staff.map((s) => {
    const a = byStaff.get(s.id) ?? { osCount: 0, comissaoCents: 0, servicoCents: 0, pendenteCents: 0, pendenteCount: 0 };
    // comissão só quando o modelo é comissão; diária/salário são acertados à parte (fixo).
    const isComissao = s.pay_type === "comissao";
    const comissaoCents = isComissao ? a.comissaoCents : 0;
    const pendenteCents = isComissao ? a.pendenteCents : 0;
    return {
      ...s,
      hasLogin: withLogin.has(s.id),
      osCount: a.osCount,
      servicoCents: a.servicoCents,
      comissaoCents,
      pendenteCents,
      pendenteCount: isComissao ? a.pendenteCount : 0,
      aPagarCents: pendenteCents,
    };
  });

  return NextResponse.json({ acerto });
}

// POST {action, payload} — CRUD da equipe (espelha /api/garcons, mas p/ técnico/recepção).
export async function POST(req: Request) {
  const g = await guard();
  if ("error" in g) return g.error;
  const sid = g.store.id;

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
        const s = await createStaff(p as never, sid);
        return NextResponse.json({ ok: true, id: s.id });
      }
      case "update":
        await updateStaff(String(p.id), p.patch as never, sid);
        return NextResponse.json({ ok: true });
      case "delete":
        await deleteStaff(String(p.id), sid);
        return NextResponse.json({ ok: true });
      case "createAccess": {
        const email = String(p.email ?? "").trim();
        const senha = String(p.senha ?? "");
        const role = asLoginRole(p.role); // "technician" (default) | "reception"
        if (!email || senha.length < 6) return NextResponse.json({ error: "Informe email e senha (mín. 6)." }, { status: 400 });
        await createStaffAccess(String(p.id), email, senha, role, sid);
        return NextResponse.json({ ok: true });
      }
      case "payCommission": {
        const pay = await payCommission(
          {
            staffId: String(p.staffId ?? ""),
            osIds: Array.isArray(p.osIds) ? (p.osIds as unknown[]).map(String) : [],
            paidCents: p.paidCents != null ? Number(p.paidCents) : undefined,
            bonusCents: p.bonusCents != null ? Number(p.bonusCents) : undefined,
            bonusReason: p.bonusReason != null ? String(p.bonusReason) : undefined,
            notes: p.notes != null ? String(p.notes) : undefined,
            paidAt: p.paidAt != null ? String(p.paidAt) : undefined,
          },
          sid,
        );
        return NextResponse.json({ ok: true, id: pay.id });
      }
      case "reverseCommission": {
        await reverseCommissionPayment(String(p.paymentId ?? ""), sid);
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: "ação inválida" }, { status: 400 });
    }
  } catch (e) {
    console.error("equipe:", e);
    return NextResponse.json({ error: (e as Error).message || "Não consegui salvar." }, { status: 500 });
  }
}
