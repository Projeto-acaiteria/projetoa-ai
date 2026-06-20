import { readFileSync } from "node:fs";
import pg from "pg";
const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = (env.match(/DATABASE_URL=(.+)/) || [])[1].trim();
const m = url.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^:/]+):(\d+)\/(.+)$/);
const [, user, password, host, port, database] = m;
const c = new pg.Client({ user, password, host, port: +port, database, ssl: { rejectUnauthorized: false } });
await c.connect();
const S = "c2716a0c-6376-47b5-bc92-fe7200ff572f"; // bar-demo
try {
  // limpa pedidos demo anteriores (labels Mesa 3/Mesa 7)
  await c.query("delete from tab_order_items where tab_order_id in (select o.id from tab_orders o join tabs t on t.id=o.tab_id where t.store_id=$1 and t.label in ('Mesa 3','Mesa 7'))", [S]);
  await c.query("delete from tab_orders where tab_id in (select id from tabs where store_id=$1 and label in ('Mesa 3','Mesa 7'))", [S]);
  await c.query("delete from tabs where store_id=$1 and label in ('Mesa 3','Mesa 7')", [S]);

  async function tab(label) {
    const { rows } = await c.query("insert into tabs (store_id,status,service_fee_cents,label) values ($1,'aberta',0,$2) returning id", [S, label]);
    return rows[0].id;
  }
  async function order(tabId, station, status, agoMin, items) {
    const { rows } = await c.query(
      "insert into tab_orders (store_id,tab_id,status,station,created_at) values ($1,$2,$3,$4, now() - ($5 || ' minutes')::interval) returning id",
      [S, tabId, status, station, agoMin]
    );
    const oid = rows[0].id;
    for (const it of items)
      await c.query("insert into tab_order_items (store_id,tab_order_id,name,size_label,qty,unit_price_cents) values ($1,$2,$3,$4,$5,$6)", [S, oid, it.n, it.s ?? null, it.q, it.p]);
  }

  const m3 = await tab("Mesa 3");
  await order(m3, "cozinha", "pendente", 12, [{ n: "Frango a passarinho", s: "500g", q: 1, p: 3500 }, { n: "Batata frita c/ calabresa", s: "500g", q: 1, p: 5000 }]);
  await order(m3, "bar", "preparando", 3, [{ n: "Cerveja Heineken", s: "600ml", q: 3, p: 1500 }]);

  const m7 = await tab("Mesa 7");
  await order(m7, "cozinha", "pendente", 6, [{ n: "Filé de tilápia", s: "500g", q: 2, p: 6500 }]);
  await order(m7, "bar", "pronto", 8, [{ n: "Caipirinha", s: "dose", q: 2, p: 1800 }, { n: "Refrigerante", s: "lata", q: 1, p: 600 }]);

  console.log("✓ pedidos KDS seedados na bar-demo (Mesa 3 + Mesa 7)");
} finally {
  await c.end();
}
