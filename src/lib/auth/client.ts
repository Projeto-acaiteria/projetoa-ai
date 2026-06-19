import { createBrowserClient } from "@supabase/ssr";

// Cliente Supabase de auth no browser (login/logout client-side). — ComandaPRO Fase 2.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
