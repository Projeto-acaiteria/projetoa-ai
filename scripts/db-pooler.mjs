// Roda SQL pelo POOLER do Supabase (IPv4). Use quando `db.mjs`/`query.mjs` derem ENOTFOUND: o host
// direto `db.<ref>.supabase.co` só publica AAAA, então máquina/rede sem IPv6 não conecta. O pooler
// (aws-0-<região>.pooler.supabase.com) responde em IPv4 e aceita DDL na porta 5432 (session mode).
//
// Uso:  node scripts/db-pooler.mjs "select 1"
//       node scripts/db-pooler.mjs --file supabase/migration-mt-38-staff-invites.sql
import { readFileSync } from "node:fs";
import pg from "pg";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = (env.match(/DATABASE_URL=(.+)/) || [])[1]?.trim();
const [, , password, host] = url.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^:/]+):(\d+)\/(.+)$/);
const ref = host.replace(/^db\./, "").replace(/\.supabase\.co$/, "");

const args = process.argv.slice(2);
const sql = args[0] === "--file" ? readFileSync(args[1], "utf8") : args[0];

// o prefixo do cluster varia por projeto (aws-0 nos antigos, aws-1 nos novos) e a região não está
// em lugar nenhum do .env — então varre as combinações até uma aceitar o tenant.
const REGIOES = ["sa-east-1", "us-east-1", "us-east-2", "us-west-1", "eu-central-1"]
  .flatMap((r) => [`aws-1-${r}`, `aws-0-${r}`]);
let client, regiao = "";
for (const r of REGIOES) {
  const c = new pg.Client({
    host: `${r}.pooler.supabase.com`, port: 5432,
    user: `postgres.${ref}`, password, database: "postgres",
    ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000,
  });
  try { await c.connect(); client = c; regiao = r; break; }
  catch (e) { console.error(`  ${r}: ${e.message}`); try { await c.end(); } catch { /* tenta a próxima */ } }
}
if (!client) { console.error("não conectei em nenhuma região do pooler"); process.exit(1); }
console.error(`(pooler ${regiao})`);

try {
  const r = await client.query(sql);
  if (Array.isArray(r)) r.forEach((x) => x.rows?.length && console.table(x.rows));
  else if (r.rows?.length) console.table(r.rows);
  else console.log("ok — sem linhas de retorno");
} finally { await client.end(); }
