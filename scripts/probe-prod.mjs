// Probe read-only: entra em PROD como dono e busca o HTML da tela pra provar o que está no ar.
// uso: node --env-file=.env.local scripts/probe-prod.mjs <email> <path> [regex]
import { createClient } from "@supabase/supabase-js";

const EMAIL = process.argv[2];
const PATH = process.argv[3] ?? "/admin";
const PROD = "https://comandapro.net.br";

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const REF = URL_SB.match(/https:\/\/([a-z0-9]+)\./)[1];

const admin = createClient(URL_SB, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: link, error: e1 } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
if (e1) { console.error("generateLink:", e1.message); process.exit(1); }

const anon = createClient(URL_SB, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: v, error: e2 } = await anon.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
if (e2) { console.error("verifyOtp:", e2.message); process.exit(1); }

const s = v.session;
const raw = "base64-" + Buffer.from(JSON.stringify({
  access_token: s.access_token, refresh_token: s.refresh_token,
  expires_at: s.expires_at, expires_in: s.expires_in, token_type: s.token_type, user: s.user,
})).toString("base64");
const parts = [];
for (let i = 0; i < raw.length; i += 3180) parts.push(raw.slice(i, i + 3180));
const cookie = parts.length === 1
  ? `sb-${REF}-auth-token=${raw}`
  : parts.map((p, i) => `sb-${REF}-auth-token.${i}=${p}`).join("; ");

const res = await fetch(PROD + PATH, { headers: { cookie }, redirect: "manual" });
console.log("STATUS", res.status, res.headers.get("location") ?? "");
const html = await res.text();
console.log("BYTES", html.length);

const alvo = process.argv[4];
if (alvo) {
  const hits = [...html.matchAll(new RegExp(alvo, "gi"))];
  console.log(`MATCH "${alvo}": ${hits.length}`);
  for (const h of hits.slice(0, 3)) {
    console.log("  …" + html.slice(Math.max(0, h.index - 240), h.index + 240).replace(/\s+/g, " ") + "…");
  }
}
