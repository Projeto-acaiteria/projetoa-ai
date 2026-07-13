// Migration ADITIVA (comissão + caixa). Idempotente, com read-after-write.
// - service_orders.commission_payment_id: NULL = comissão pendente; preenchido = já paga (trava anti-2x).
// - commission_payments: recibo de cada repasse (jsonb data, padrão dos outros stores).
// NÃO toca food: service_orders é tabela só do vertical service; commission_payments é nova.
// Uso: node scripts/migrate-commission-caixa.mjs
import { readFileSync } from "node:fs";
import pg from "pg";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = (env.match(/DATABASE_URL=(.+)/) || [])[1]?.trim();
const m = url.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^:/]+):(\d+)\/(.+)$/);
const [, user, password, host, port, database] = m;
const client = new pg.Client({ user, password, host, port: +port, database, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query(`ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS commission_payment_id text`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_so_commission_payment ON service_orders(store_id, commission_payment_id)`);
  await client.query(`CREATE TABLE IF NOT EXISTS commission_payments (
    id text PRIMARY KEY,
    store_id uuid NOT NULL,
    data jsonb NOT NULL,
    created_at timestamptz DEFAULT now()
  )`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_commission_payments_store ON commission_payments(store_id)`);
  // RLS ligada sem policy: anon/authenticated não enxergam (o app usa service-role, que bypassa).
  await client.query(`ALTER TABLE commission_payments ENABLE ROW LEVEL SECURITY`);

  // read-after-write (prova na fonte)
  const col = await client.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name='service_orders' AND column_name='commission_payment_id'`,
  );
  const tbl = await client.query(`SELECT to_regclass('public.commission_payments') AS t`);
  console.log("coluna service_orders.commission_payment_id:", col.rowCount === 1 ? "OK ✓" : "FALTOU ✗");
  console.log("tabela commission_payments:", tbl.rows[0].t ? "OK ✓" : "FALTOU ✗");
} finally {
  await client.end();
}
