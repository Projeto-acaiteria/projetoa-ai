// Migration ADITIVA (clientes service): tabela service_customers (base de clientes por CPF,
// alimentada pela importação do GestãoClick) + garante a coluna cpf na OS. Idempotente + read-after-write.
// service_customers é service-only; food (Cantinho/Medellín) não toca nela.
// Uso: node scripts/migrate-clientes-starteq.mjs
import { readFileSync } from "node:fs";
import pg from "pg";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = (env.match(/DATABASE_URL=(.+)/) || [])[1]?.trim();
const m = url.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^:/]+):(\d+)\/(.+)$/);
const [, user, password, host, port, database] = m;
const client = new pg.Client({ user, password, host, port: +port, database, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query(`ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS cpf text`);
  await client.query(`CREATE TABLE IF NOT EXISTS service_customers (
    store_id uuid NOT NULL,
    cpf text NOT NULL,
    data jsonb NOT NULL,
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (store_id, cpf)
  )`);
  await client.query(`ALTER TABLE service_customers ENABLE ROW LEVEL SECURITY`);

  const col = await client.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name='service_orders' AND column_name='cpf'`,
  );
  const tbl = await client.query(`SELECT to_regclass('public.service_customers') AS t`);
  console.log("coluna service_orders.cpf:", col.rowCount === 1 ? "OK ✓" : "FALTOU ✗");
  console.log("tabela service_customers:", tbl.rows[0].t ? "OK ✓" : "FALTOU ✗");
} finally {
  await client.end();
}
