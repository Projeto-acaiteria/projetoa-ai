import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { resolveStoreId } from "@/lib/auth/current";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Upload de foto de produto pro Supabase Storage (bucket público menu-photos). Foto namespaceada
// por loja (<storeId>/...). A loja vem do dono logado. Retorna a URL pública pra gravar em img.
const MAX = 5 * 1024 * 1024;
const OK: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function POST(req: Request) {
  const storeId = await resolveStoreId();
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "envio inválido" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "arquivo ausente" }, { status: 400 });
  const ext = OK[file.type];
  if (!ext) return NextResponse.json({ error: "formato inválido (use JPG, PNG ou WEBP)" }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: "imagem muito grande (máx 5MB)" }, { status: 400 });

  const path = `${storeId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error } = await db().storage.from("menu-photos").upload(path, buf, { contentType: file.type, upsert: false });
  if (error) {
    console.error("upload-foto:", error);
    return NextResponse.json({ error: "falha ao subir a foto" }, { status: 500 });
  }
  const { data } = db().storage.from("menu-photos").getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
