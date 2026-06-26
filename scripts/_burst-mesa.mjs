// Corrida na MESMA MESA: N pedidos simultaneos pela mesa X (QR) — testa se getOrCreateOpenTab
// cria 1 comanda (correto) ou comandas DUPLICADAS (bug de corrida). Uso: node _burst-mesa.mjs <mesa> <N>
import { readFileSync } from "node:fs";
import pg from "pg";
const BASE = "https://projetoa-ai-six.vercel.app";
const SLUG = "hamburgueria-teste";
const SID = "a22f92a0-c759-4534-9c93-7daa429b6c2e";
const REFRI = "ef50a808-e491-4337-b275-c1a3f668e975";
const MESA = Number(process.argv[2] || 99);
const N = Number(process.argv[3] || 12);

function pedido() {
  return fetch(`${BASE}/api/mesa-pedido`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: SLUG, tableNumber: MESA, items: [{ productId: REFRI, qty: 1 }] }) })
    .then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }))
    .catch((e) => ({ status: 0, body: { error: String(e) } }));
}

console.log(`Disparando ${N} pedidos SIMULTANEOS na MESA ${MESA} (${SLUG})...`);
const res = await Promise.all(Array.from({ length: N }, () => pedido()));
const ok = res.filter((r) => r.status === 200).length;
const fail = res.filter((r) => r.status !== 200);
console.log(`OK: ${ok}/${N} | falhas: ${fail.length}`, fail.length ? fail.slice(0, 3).map((f) => f.status + ":" + (f.body.error || "")) : "");

// prova na fonte: quantas COMANDAS ABERTAS existem pra essa mesa? (esperado: 1)
const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = (env.match(/DATABASE_URL=(.+)/) || [])[1].trim();
const m = url.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^:/]+):(\d+)\/(.+)$/);
const [, user, password, host, port, database] = m;
const c = new pg.Client({ user, password, host, port: +port, database, ssl: { rejectUnauthorized: false } });
await c.connect();
try {
  const { rows: tbl } = await c.query("select id from tables where store_id=$1 and number=$2", [SID, MESA]);
  const tableIds = tbl.map((t) => t.id);
  const { rows: abertas } = await c.query("select count(*)::int n from tabs where store_id=$1 and table_id = any($2) and status='aberta'", [SID, tableIds]);
  const { rows: itens } = await c.query("select count(*)::int n from tab_order_items i join tab_orders o on o.id=i.tab_order_id join tabs t on t.id=o.tab_id where t.store_id=$1 and t.table_id = any($2)", [SID, tableIds]);
  console.log(`\nMESAS (tables) com numero ${MESA}: ${tableIds.length}  ${tableIds.length === 1 ? "(OK)" : ">>> MESA DUPLICADA"}`);
  console.log(`COMANDAS ABERTAS na mesa ${MESA}: ${abertas[0].n}  ${abertas[0].n === 1 ? "(OK)" : ">>> COMANDA DUPLICADA (BUG DE CORRIDA)"}`);
  console.log(`itens lancados no total: ${itens[0].n} (esperado = nº de pedidos que passaram = ${ok})`);
} finally { await c.end(); }
