import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Renova a sessão a cada request. CRÍTICO (lição AgendaPRO/Olímpio): o getUser() abaixo
// refresca o token — sem ele o usuário desloga sozinho em ~1h. — ComandaPRO Fase 2.
export async function updateSession(request: NextRequest): Promise<{ response: NextResponse; userId: string | null }> {
  let supabaseResponse = NextResponse.next({ request });

  // VISITANTE não tem o que renovar: sem cookie de sessão do Supabase (`sb-...-auth-token`), o
  // getUser() abaixo só gastaria CPU e uma ida ao Auth à toa. O cardápio público, a página do
  // garçom e o QR de mesa passam por aqui a cada acesso — e nenhum deles tem sessão.
  // Quem TEM cookie segue o caminho completo: o refresh de token continua intacto (sem ele o
  // operador desloga sozinho em ~1h).
  const temSessao = request.cookies.getAll().some((c) => c.name.startsWith("sb-"));
  if (!temSessao) return { response: supabaseResponse, userId: null };

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // NÃO remover: refresca o token de sessão. Sem isso = deslogar-sozinho-em-1h.
  const { data } = await supabase.auth.getUser();

  return { response: supabaseResponse, userId: data.user?.id ?? null };
}
