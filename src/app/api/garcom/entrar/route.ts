import { NextResponse } from "next/server";
import { consumeInvite } from "@/lib/staff-invite-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ENTRADA DO GARÇOM POR CÓDIGO (mt-38) — rota PÚBLICA (sem sessão, é ela que cria a sessão).
// Recebe os 6 dígitos, queima o convite e devolve a credencial efêmera que o app usa pra logar.
// A credencial é sorteada na hora e trocada a cada convite: ninguém digita, ninguém decora, e o
// celular antigo do garçom perde o acesso quando ele reentra em outro aparelho.
//
// Resposta é sempre a mesma pra código errado, usado ou vencido — não entrega pista pra quem chuta.
export async function POST(req: Request) {
  let b: { code?: string };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Código inválido." }, { status: 400 });
  }

  try {
    const cred = await consumeInvite(String(b.code ?? ""));
    if (!cred) {
      return NextResponse.json({ error: "Código inválido ou vencido. Peça um novo pro gerente." }, { status: 401 });
    }
    return NextResponse.json({ ok: true, ...cred });
  } catch (e) {
    console.error("garcom/entrar:", e);
    return NextResponse.json({ error: "Não consegui te conectar agora. Tente de novo." }, { status: 500 });
  }
}
