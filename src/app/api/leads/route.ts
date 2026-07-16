import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Captura de lead (ComandaPRO). O modal de captura POSTa aqui ANTES de mandar o lead pro
// wizard — assim, mesmo que ele abandone o cadastro, o contato fica salvo pra follow-up.
// Dedupe: se já existe lead 'novo' com o mesmo WhatsApp, atualiza em vez de duplicar
// (refresh / reenvio na mesma sessão não polui a lista). Read-after-write (λ.prova-na-fonte).
export async function POST(req: Request) {
  let b: { nome?: string; whatsapp?: string; negocio?: string; source?: string };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "body inválido" }, { status: 400 });
  }

  const name = (b.nome ?? "").trim();
  const business = (b.negocio ?? "").trim();
  const whatsapp = (b.whatsapp ?? "").replace(/\D+/g, "");
  const source = (b.source ?? "home").trim().slice(0, 40) || "home";

  if (name.length < 2) return NextResponse.json({ error: "nome" }, { status: 400 });
  if (business.length < 2) return NextResponse.json({ error: "negócio" }, { status: 400 });
  if (whatsapp.length < 10) return NextResponse.json({ error: "whatsapp" }, { status: 400 });

  // dedupe: reusa lead 'novo' do mesmo WhatsApp (não cria duplicata a cada refresh)
  const { data: existing } = await db()
    .from("leads")
    .select("id")
    .eq("whatsapp", whatsapp)
    .eq("status", "novo")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let id: string | undefined;
  if (existing?.id) {
    const { data, error } = await db()
      .from("leads")
      .update({ name, business_name: business, source, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: "falha ao salvar" }, { status: 500 });
    id = data.id;
  } else {
    const { data, error } = await db()
      .from("leads")
      .insert({ name, business_name: business, whatsapp, source })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: "falha ao salvar" }, { status: 500 });
    id = data.id;
  }

  return NextResponse.json({ ok: true, id });
}
