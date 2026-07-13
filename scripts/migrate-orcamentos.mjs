// Migration ADITIVA: tabela budgets (orçamentos do vertical service) + coluna public_code na OS
// (código público estável p/ o link A4 do WhatsApp). Idempotente + read-after-write. Service-only.
// Uso: node scripts/migrate-orcamentos.mjs
import { readFileSync } from "node:fs";
import pg from "pg";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = (env.match(/DATABASE_URL=(.+)/) || [])[1]?.trim();
const m = url.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^:/]+):(\d+)\/(.+)$/);
const [, user, password, host, port, database] = m;
const client = new pg.Client({ user, password, host, port: +port, database, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query(`CREATE TABLE IF NOT EXISTS budgets (
    id text PRIMARY KEY,
    store_id uuid NOT NULL,
    data jsonb NOT NULL,
    created_at timestamptz DEFAULT now()
  )`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_budgets_store ON budgets(store_id)`);
  // busca por código público (link A4) — code fica em data->>'code'
  await client.query(`CREATE INDEX IF NOT EXISTS idx_budgets_code ON budgets((data->>'code'))`);
  await client.query(`ALTER TABLE budgets ENABLE ROW LEVEL SECURITY`);

  const tbl = await client.query(`SELECT to_regclass('public.budgets') AS t`);
  console.log("tabela budgets:", tbl.rows[0].t ? "OK ✓" : "FALTOU ✗");
} finally {
  await client.end();
}
