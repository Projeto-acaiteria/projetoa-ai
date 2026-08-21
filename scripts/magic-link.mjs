// Gera um link de entrada (magiclink) pra abrir o painel na conta de um dono — suporte.
// Uso único, expira, e NÃO derruba a sessão que o cliente já tem (não mexe em senha).
// uso: node --env-file=.env.local scripts/magic-link.mjs <email> [caminho-destino]
import { createClient } from "@supabase/supabase-js";

const EMAIL = process.argv[2];
const DESTINO = process.argv[3] ?? "/admin";
const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://comandapro.net.br";

if (!EMAIL) { console.error("uso: node --env-file=.env.local scripts/magic-link.mjs <email> [destino]"); process.exit(1); }

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
if (error) { console.error("falhou:", error.message); process.exit(1); }

const url = `${BASE}/entrar/link?token_hash=${data.properties.hashed_token}&next=${encodeURIComponent(DESTINO)}`;
console.log(url);
