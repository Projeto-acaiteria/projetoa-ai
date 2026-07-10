// Cria itens de estoque de GARRAFA (unidade) pros produtos da seção Garrafas do Medellín.
// name = igual ao produto (pra baixa por nome), id = <slug>-garrafa (não colide com a dose), sem
// dosesPerBottle (→ estoque de UNIDADE). Idempotente (upsert). Uso: node scripts/... [--commit]
import { readFileSync } from "node:fs";
import pg from "pg";
const COMMIT = process.argv.includes("--commit");
const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = (env.match(/DATABASE_URL=(.+)/) || [])[1]?.trim();
const m = url.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^:/]+):(\d+)\/(.+)$/);
const [, u, pw, h, po, db] = m;
const c = new pg.Client({ user: u, password: pw, host: h, port: +po, database: db, ssl: { rejectUnauthorized: false } });
await c.connect();
const q = async (s, p = []) => (await c.query(s, p)).rows;
const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const hoje = new Date().toISOString().slice(0, 10);
try {
  const SID = (await q("select id from stores where slug='medellin'"))[0].id;
  const prods = await q("select p.name from menu_products p join menu_categories mc on mc.id=p.category_id where p.store_id=$1 and mc.name='Garrafas' order by p.name", [SID]);
  console.log(`Garrafas no menu: ${prods.length}`);
  console.log(COMMIT ? "🔴 criando itens de estoque de garrafa..." : "🟡 DRY-RUN (nada gravado). Rode com --commit.\n");
  let n = 0;
  for (const p of prods) {
    const id = slug(p.name) + "-garrafa";
    const data = { id, qty: 0, name: p.name, unit: "garrafa", minQty: 0, history: [], category: "Garrafas", updatedAt: hoje };
    console.log(`  ${p.name}  →  id=${id}`);
    if (COMMIT) { await q("insert into stock_items (store_id, id, data) values ($1,$2,$3) on conflict (store_id, id) do update set data=excluded.data", [SID, id, JSON.stringify(data)]); n++; }
  }
  console.log(COMMIT ? `\n✅ ${n} itens de garrafa criados (categoria "Garrafas", unidade garrafa, qty 0).` : "");
} finally { await c.end(); }
