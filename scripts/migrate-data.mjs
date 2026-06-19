// Migra os dados do .data/*.json pro Supabase. Idempotente (upsert).
// Roda conforme os stores vão sendo migrados. Uso: node scripts/migrate-data.mjs
import { readFileSync, existsSync } from "node:fs";
import pg from "pg";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = (env.match(/DATABASE_URL=(.+)/) || [])[1]?.trim();
const m = url.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^:/]+):(\d+)\/(.+)$/);
const [, user, password, host, port, database] = m;
const c = new pg.Client({ user, password, host, port: +port, database, ssl: { rejectUnauthorized: false } });
await c.connect();

const dir = new URL("../.data/", import.meta.url);
const read = (f) => {
  const p = new URL(f, dir);
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
};
const upsertConfig = async (table, data) => {
  if (data == null) return console.log(`- ${table}: sem .data, pulado`);
  await c.query(`insert into ${table} (id, data) values (1, $1) on conflict (id) do update set data = $1`, [JSON.stringify(data)]);
  console.log(`✓ ${table}`);
};

const upsertRows = async (table, pk, arr) => {
  if (!Array.isArray(arr)) return console.log(`- ${table}: sem .data (ou não é lista), pulado`);
  await c.query(`delete from ${table}`);
  for (const item of arr) {
    await c.query(`insert into ${table} (${pk}, data) values ($1, $2) on conflict (${pk}) do update set data = $2`, [item[pk], JSON.stringify(item)]);
  }
  console.log(`✓ ${table} (${arr.length})`);
};

// ── config single-row ──
await upsertConfig("app_settings", read("settings.json"));
await upsertConfig("app_menu", read("menu.json"));
await upsertConfig("app_loyalty", read("loyalty.json"));

// ── relacionais (blob: pk natural + data) ──
await upsertRows("customers", "phone", read("customers.json"));
await upsertRows("orders", "id", read("orders.json"));
await upsertRows("stock_items", "id", read("stock.json"));
await upsertRows("cash_sessions", "id", read("cash.json"));
await upsertRows("expenses", "id", read("expenses.json"));
await upsertRows("fixed_expenses", "id", read("fixed-expenses.json"));

await c.end();
console.log("=== migração de dados OK ===");
