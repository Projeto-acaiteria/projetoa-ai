import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/auth/middleware";

// Rotas /api PÚBLICAS (cliente final / signup / webhooks / cron / impressão). Tudo o mais sob
// /api exige login. As rotas MISTAS (público + admin) ficam aqui e gateiam o lado admin DENTRO
// da própria rota (pedidos: POST público/GET admin; pontos: GET?phone público/listar+POST admin).
const API_PUBLICAS = [
  "/api/mesa-pedido", "/api/delivery-pedido", "/api/cadastro", "/api/cadastro/check",
  "/api/webhooks/asaas", "/api/cron/billing-check", "/api/qz-sign",
  "/api/pedidos", "/api/pontos",
  "/api/loja", // vitrine headless: catálogo/montagem/pedido do site (público por slug)
];

export async function middleware(request: NextRequest) {
  const { response, userId } = await updateSession(request);
  const path = request.nextUrl.pathname;
  if (path.startsWith("/api/") && !API_PUBLICAS.some((p) => path === p || path.startsWith(p + "/"))) {
    if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
