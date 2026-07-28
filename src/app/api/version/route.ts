import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Versão do deploy ATUAL no servidor. O cliente compara com o seu NEXT_PUBLIC_BUILD_ID carimbado no
// bundle; se diferente, há versão nova → recarrega (auto-update do PWA, sem reabrir o app na mão).
export function GET() {
  const build = process.env.NEXT_PUBLIC_BUILD_ID || process.env.VERCEL_GIT_COMMIT_SHA || "dev";
  return NextResponse.json({ build }, { headers: { "cache-control": "no-store" } });
}
