// Cria um login de GARÇOM (role waiter) num tenant. Uso:
//   node scripts/create-garcom.mjs <slug> <email> <senha> "<Nome>"
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const [slug, email, senha, nome = "Garçom"] = process.argv.slice(2);
if (!slug || !email || !senha) { console.error('uso: node scripts/create-garcom.mjs <slug> <email> <senha> "<Nome>"'); process.exit(1); }

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const get = (k) => (env.match(new RegExp(`${k}=(.+)`)) || [])[1]?.trim();
const url = get("NEXT_PUBLIC_SUPABASE_URL");
const serviceKey = get("SUPABASE_SERVICE_ROLE_KEY");
const dbUrl = get("DATABASE_URL");
const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

// 1) store_id pelo slug (via pg, direto)
const m = dbUrl.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^:/]+):(\d+)\/(.+)$/);
const [, u, pw, h, po, database] = m;
const c = new pg.Client({ user: u, password: pw, host: h, port: +po, database, ssl: { rejectUnauthorized: false } });
await c.connect();
try {
  const store = (await c.query("select id, name from stores where slug=$1", [slug])).rows[0];
  if (!store) throw new Error(`loja '${slug}' não encontrada`);

  // 2) cria (ou acha) o usuário de auth
  let userId;
  const created = await sb.auth.admin.createUser({ email, password: senha, email_confirm: true });
  if (created.error) {
    if (/already been registered|already exists/i.test(created.error.message)) {
      const list = await sb.auth.admin.listUsers({ perPage: 1000 });
      userId = list.data.users.find((x) => x.email?.toLowerCase() === email.toLowerCase())?.id;
      if (!userId) throw created.error;
      await sb.auth.admin.updateUserById(userId, { password: senha, email_confirm: true }); // reseta a senha
      console.log("usuário já existia → senha atualizada:", email);
    } else throw created.error;
  } else {
    userId = created.data.user.id;
    console.log("usuário criado:", email);
  }

  // 3) membership waiter (idempotente)
  const existing = (await c.query("select id from store_members where store_id=$1 and user_id=$2", [store.id, userId])).rows[0];
  if (existing) {
    await c.query("update store_members set role='waiter', active=true where id=$1", [existing.id]);
    console.log("membership atualizada → waiter");
  } else {
    await c.query("insert into store_members (store_id, user_id, role, active) values ($1,$2,'waiter',true)", [store.id, userId]);
    console.log("membership criada → waiter");
  }
  console.log(`\n✅ Garçom "${nome}" pronto em ${store.name}\n   login: ${email}\n   senha: ${senha}\n   acessa: comandapro.net.br (cai em Mesas)`);
} finally { await c.end(); }
