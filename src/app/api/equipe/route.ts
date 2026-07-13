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
  const from = url.searchParams.get("from") || undefined;
  const to = url.searchParams.get("to") || undefined;

  const [staff, report, orders] = await Promise.all([
    listStaff(sid),
    staffReport(from, to, sid, LOGIN_ROLES),
    listServiceOrders(undefined, sid),
  ]);

  const withLogin = new Set(report.filter((r) => r.hasLogin).map((r) => r.id));

  // agrega comissão/serviço por técnico sobre OS quitadas no período (paid_at)
  const byStaff = new Map<string, { osCount: number; comissaoCents: number; servicoCents: number }>();
  for (const os of orders) {
    if (os.paymentStatus !== "quitada" || !os.staffId) continue;
    if (from && (!os.paidAt || os.paidAt < from)) continue;
    if (to && (!os.paidAt || os.paidAt > to)) continue;
    const a = byStaff.get(os.staffId) ?? { osCount: 0, comissaoCents: 0, servicoCents: 0 };
    a.osCount += 1;
    a.comissaoCents += osCommissionCents(os);
    a.servicoCents += os.serviceValueCents;
    byStaff.set(os.staffId, a);
  }

  const acerto = staff.map((s) => {
    const a = byStaff.get(s.id) ?? { osCount: 0, comissaoCents: 0, servicoCents: 0 };
    // comissão só quando o modelo é comissão; diária/salário são acertados à parte (fixo).
    const comissaoCents = s.pay_type === "comissao" ? a.comissaoCents : 0;
    return {
      ...s,
      hasLogin: withLogin.has(s.id),
      osCount: a.osCount,
      servicoCents: a.servicoCents,
      comissaoCents,
      aPagarCents: comissaoCents,
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
      default:
        return NextResponse.json({ error: "ação inválida" }, { status: 400 });
    }
  } catch (e) {
    console.error("equipe:", e);
    return NextResponse.json({ error: (e as Error).message || "Não consegui salvar." }, { status: 500 });
  }
}
