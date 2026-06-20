import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Checagem leve de disponibilidade do link (slug) pro wizard de cadastro (feedback ao vivo).
const RESERVADOS = ["admin", "api", "cadastro", "login", "app", "www", "cardapio", "bloqueado", "sobre", "checkout"];
const RE_SLUG = /^[a-z0-9-]{3,50}$/;

export async function GET(req: Request) {
  const slug = (new URL(req.url).searchParams.get("slug") ?? "").trim().toLowerCase();
  if (!RE_SLUG.test(slug)) return NextResponse.json({ available: false, reason: "formato" });
  if (RESERVADOS.includes(slug)) return NextResponse.json({ available: false, reason: "reservado" });
  const { data } = await db().from("stores").select("id").eq("slug", slug).maybeSingle();
  return NextResponse.json({ available: !data });
}
