import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/auth/middleware";

// Roda em todas as rotas (menos assets estáticos) só pra renovar a sessão do usuário.
// NÃO bloqueia nada ainda — o gate de billing/login entra depois, no layout protegido.
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
