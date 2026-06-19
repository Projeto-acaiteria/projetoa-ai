import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cliente Supabase com a SESSÃO do usuário (login via cookies). Pros DADOS continua
// o db() de @/lib/supabase — aqui é só auth. — ComandaPRO Fase 2 (espelha AgendaPRO).
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component não pode escrever cookie — ok, o middleware renova a sessão.
          }
        },
      },
    },
  );
}
