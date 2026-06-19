import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Assina os requests do QZ Tray com a chave privada (par do QZ_CERT).
// Com o override.crt na máquina do caixa, o QZ confia e NÃO pede "Allow".
export async function GET(req: Request) {
  const data = new URL(req.url).searchParams.get("request") ?? "";
  const key = process.env.QZ_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!key) return new Response("", { status: 500 });
  const s = crypto.createSign("SHA512");
  s.update(data);
  s.end();
  return new Response(s.sign(key, "base64"), { headers: { "content-type": "text/plain" } });
}
