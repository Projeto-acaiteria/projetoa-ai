import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { SEGMENTOS, type BusinessType } from "@/config/segments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cadastro de nova loja (ComandaPRO Fase 4). Espelha o AgendaPRO: admin.createUser → store →
// store_config (defaults do segmento) → subscription trial, com ROLLBACK manual (sem transação
// cross-table). Signup público OFF — só este endpoint server-side cria conta.
const RESERVADOS = ["admin", "api", "cadastro", "login", "app", "www", "cardapio", "bloqueado", "sobre", "checkout"];
const RE_SLUG = /^[a-z0-9-]{3,50}$/;

export async function POST(req: Request) {
  let b: {
    negocio?: string;
    segmento?: BusinessType;
    slug?: string;
    whatsapp?: string;
    nome?: string;
    email?: string;
    senha?: string;
  };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "body inválido" }, { status: 400 });
  }

  const slug = (b.slug ?? "").trim().toLowerCase();
  const email = (b.email ?? "").trim().toLowerCase();
  const seg = b.segmento;

  if (!b.negocio?.trim()) return NextResponse.json({ error: "Informe o nome do negócio." }, { status: 400 });
  if (!seg || !SEGMENTOS[seg]) return NextResponse.json({ error: "Escolha o tipo de negócio." }, { status: 400 });
  if (!RE_SLUG.test(slug) || RESERVADOS.includes(slug))
    return NextResponse.json({ error: "Link inválido (3-50, letras/números/hífen) ou reservado." }, { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
  if (!b.senha || b.senha.length < 8 || !/[A-Z]/.test(b.senha) || !/[0-9]/.test(b.senha))
    return NextResponse.json({ error: "Senha: mínimo 8 caracteres, 1 maiúscula e 1 número." }, { status: 400 });
  if (!b.nome?.trim()) return NextResponse.json({ error: "Informe seu nome." }, { status: 400 });

  const { data: existe } = await db().from("stores").select("id").eq("slug", slug).maybeSingle();
  if (existe) return NextResponse.json({ error: "Esse link já está em uso. Escolha outro." }, { status: 409 });

  // 1. usuário
  const { data: created, error: uErr } = await db().auth.admin.createUser({
    email,
    password: b.senha,
    email_confirm: true,
  });
  if (uErr || !created?.user)
    return NextResponse.json({ error: "Não consegui criar a conta (e-mail já cadastrado?)." }, { status: 400 });
  const userId = created.user.id;
  const rollbackUser = () => db().auth.admin.deleteUser(userId).catch(() => {});

  // 2. loja
  const { data: store, error: sErr } = await db()
    .from("stores")
    .insert({ slug, name: b.negocio.trim(), owner_id: userId })
    .select("id")
    .single();
  if (sErr || !store) {
    await rollbackUser();
    return NextResponse.json({ error: "Falha ao criar a loja." }, { status: 500 });
  }
  const storeId = store.id as string;
  const rollbackStore = async () => {
    await db().from("stores").delete().eq("id", storeId).catch(() => {});
    await rollbackUser();
  };

  // 3. store_config com os defaults do segmento
  const f = SEGMENTOS[seg].features;
  const { error: cErr } = await db().from("store_config").insert({
    store_id: storeId,
    business_type: seg,
    sells_by_weight: f.sellsByWeight,
    has_balcao: f.hasBalcao,
    has_tables: f.hasTables,
    has_delivery: f.hasDelivery,
    cover_enabled: f.coverEnabled,
    stock_dose: f.stockDose,
    has_stations: f.hasStations,
    loyalty_enabled: f.loyaltyEnabled,
  });
  if (cErr) {
    await rollbackStore();
    return NextResponse.json({ error: "Falha na configuração da loja." }, { status: 500 });
  }

  // 4. subscription em trial (7 dias — o cron expira; o gate manda pra /bloqueado depois)
  const { error: subErr } = await db().from("subscriptions").insert({ store_id: storeId, status: "trial" });
  if (subErr) {
    await rollbackStore();
    return NextResponse.json({ error: "Falha ao iniciar o teste grátis." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, slug, storeId });
}
