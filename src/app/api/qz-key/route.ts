import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Entrega a chave privada do QZ em PKCS#8 (PEM) pro CLIENTE assinar OFFLINE (Web Crypto). É a mesma
// cert-mãe compartilhada — trade-off aceito (opção 1 do offline): a impressão de estação roteada
// precisa assinar, e sem net o /api/qz-sign não responde. Gate: só usuário LOGADO (não é público).
// Risco = spam de impressão, não dado. O cliente cacheia localmente e assina os prints durante a queda.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  const raw = process.env.QZ_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!raw) return NextResponse.json({ error: "sem chave" }, { status: 500 });
  try {
    // normaliza pra PKCS#8 (o Web Crypto importa pkcs8; a env pode estar em PKCS#1 "RSA PRIVATE KEY")
    const pkcs8 = crypto.createPrivateKey(raw).export({ type: "pkcs8", format: "pem" }) as string;
    return new Response(pkcs8, { headers: { "content-type": "text/plain" } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
