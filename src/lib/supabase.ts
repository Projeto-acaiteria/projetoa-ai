// Cliente Supabase. Lazy: só falha quando usado sem as env vars (não quebra o
// build enquanto o .env.local não está configurado).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _admin: SupabaseClient | null = null;
let _browser: SupabaseClient | null = null;

/** Server-side: service_role (bypassa RLS). Use só em rotas/server. */
export function db(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Exige service-role: NÃO cair no anon. Com RLS ligada, anon não enxerga nada → o server
  // falharia em silêncio. Melhor explodir com erro claro do que degradar invisível.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service-role não configurado — defina SUPABASE_SERVICE_ROLE_KEY (.env.local / envs da Vercel)");
  _admin = createClient(url, key, { auth: { persistSession: false } });
  return _admin;
}

/** Browser/client: anon key (sujeito a RLS) — pra realtime no front. */
export function supabaseBrowser(): SupabaseClient {
  if (_browser) return _browser;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase não configurado — defina as chaves no .env.local");
  _browser = createClient(url, key);
  return _browser;
}

export function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
