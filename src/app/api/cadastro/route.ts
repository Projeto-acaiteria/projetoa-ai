import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { SEGMENTOS, type BusinessType } from "@/config/segments";
import { setStore, waMsgsForSegment } from "@/lib/settings-store";
import { seedStarterMenu } from "@/lib/seed-menu";
import { ensureTables } from "@/lib/tables-store";

const MESAS_DEFAULT = 10, MESAS_MAX = 200; // nº de mesas do salão vem do cadastro; o dono ajusta depois

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
    mesas?: number;
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
  // WhatsApp é o canal do delivery/cliente — obrigatório (mínimo DDD + número = 10 dígitos)
  if ((b.whatsapp ?? "").replace(/\D+/g, "").length < 10) return NextResponse.json({ error: "Informe um WhatsApp válido (com DDD)." }, { status: 400 });

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
  const rollbackUser = async () => {
    try {
      // hard-delete (shouldSoftDelete=false) — senão o e-mail fica "preso" e a 2ª tentativa falha
      await db().auth.admin.deleteUser(userId, false);
    } catch {}
  };

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
    try {
      await db().from("stores").delete().eq("id", storeId);
    } catch {}
    await rollbackUser();
  };

  // 3. store_config com os defaults do segmento
  const f = SEGMENTOS[seg].features;
  const { error: cErr } = await db().from("store_config").insert({
    store_id: storeId,
    business_type: seg,
    menu_template: SEGMENTOS[seg].menuTemplate,
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

  // 5. config inicial da loja: NOME + WhatsApp já valem no cardápio/cupom desde o 1º acesso
  //    (senão getStore cai no DEFAULT "Açaí do Vidal"/zap placeholder até o dono configurar).
  try {
    await setStore({ name: b.negocio.trim(), whatsapp: (b.whatsapp ?? "").replace(/\D+/g, ""), waMsgs: waMsgsForSegment(seg) }, storeId);
  } catch { /* não bloqueia o cadastro — o dono ajusta em Configurações */ }

  // 6. cardápio-semente do segmento (só bar/grid; acai já tem default) — o dono não encara tela
  //    em branco, vê a estrutura pronta e edita. Não bloqueia o cadastro se falhar.
  try {
    await seedStarterMenu(storeId, seg);
  } catch { /* segue sem seed — o dono cadastra do zero em Cardápio */ }

  // 6b. MESAS + QR pros negócios de SALÃO (mesa é âncora: cliente pede da mesa, o sistema
  //     identifica qual). Gate = has_tables && has_stations → bar/restaurante/pizza/sushi/burguer/
  //     petiscaria. Balcão/delivery (açaí/sorvete/marmita) NÃO semeia — lá a mesa é opcional.
  //     Nasce com SEED_MESAS mesas; o dono ajusta no /admin/mesas. Não bloqueia o cadastro.
  try {
    if (f.hasTables && f.hasStations) {
      const nMesas = Math.min(MESAS_MAX, Math.max(1, Math.floor(Number(b.mesas) || MESAS_DEFAULT)));
      await ensureTables(nMesas, storeId);
    }
  } catch { /* segue sem mesas — o dono cria no /admin/mesas */ }

  // 7. se esse WhatsApp veio de um lead capturado no modal, marca como convertido + vincula a loja.
  //    Não bloqueia o cadastro — é só telemetria de funil pro follow-up.
  try {
    const waDigits = (b.whatsapp ?? "").replace(/\D+/g, "");
    if (waDigits.length >= 10) {
      await db().from("leads")
        .update({ status: "convertido", store_id: storeId, updated_at: new Date().toISOString() })
        .eq("whatsapp", waDigits).eq("status", "novo");
    }
  } catch { /* segue: lead não capturado ou update falhou não deve derrubar o cadastro */ }

  return NextResponse.json({ ok: true, slug, storeId });
}
