// Delta desde o baseline + re-check de integridade. Prova que os cliques do CIC caíram no banco
// e pega quebra na hora (órfão, estação null, estoque negativo, comanda fechada com falta).
// Uso: node scripts/watch-medellin.mjs
import { readFileSync } from "node:fs";
import pg from "pg";
const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = (env.match(/DATABASE_URL=(.+)/) || [])[1]?.trim();
const mm = url.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^:/]+):(\d+)\/(.+)$/);
const [, u, pw, h, po, db] = mm;
const c = new pg.Client({ user: u, password: pw, host: h, port: +po, database: db, ssl: { rejectUnauthorized: false } });
await c.connect();
const q = async (s, p = []) => (await c.query(s, p)).rows;
const n = async (s, p = []) => Number((await q(s, p))[0].n);
const brl = (x) => "R$ " + ((x || 0) / 100).toFixed(2);
const L = console.log;
try {
  const SID = (await q("select id from stores where slug='medellin'"))[0].id;
  let base = {};
  try { base = JSON.parse(readFileSync(new URL("./.medellin-baseline.json", import.meta.url), "utf8")); } catch {}
  const cur = {
    tabs: await n("select count(*) n from tabs where store_id=$1", [SID]),
    tabs_abertas: await n("select count(*) n from tabs where store_id=$1 and status<>'fechada'", [SID]),
    tab_orders: await n("select count(*) n from tab_orders where store_id=$1", [SID]),
    tab_payments: await n("select count(*) n from tab_payments where store_id=$1", [SID]),
    pay_total_hoje: await n("select coalesce(sum(amount_cents),0) n from tab_payments where store_id=$1 and paid_at::date=current_date", [SID]),
    staff: await n("select count(*) n from staff where store_id=$1", [SID]),
    coupons: await n("select count(*) n from coupons where store_id=$1", [SID]),
    customers: await n("select count(*) n from customers where store_id=$1", [SID]),
    stock_total_qty: await n("select coalesce(sum((data->>'qty')::numeric),0) n from stock_items where store_id=$1", [SID]),
  };
  L(`\n[${new Date().toISOString()}] DELTA desde o baseline (${base.at ?? "?"}):`);
  for (const k of Object.keys(cur)) {
    const b = base[k] ?? 0, d = cur[k] - b, tag = k.includes("total") || k.includes("qty") ? brl : (x) => x;
    L(`  ${k}: ${tag(b)} → ${tag(cur[k])}  ${d ? (d > 0 ? "▲+" : "▼") + tag(Math.abs(d)) : "="}`);
  }
  // integridade ao vivo
  const nullStn = await n("select count(*) n from tab_orders where store_id=$1 and station is null", [SID]);
  const orphanItems = await n("select count(*) n from tab_order_items toi left join tab_orders tor on tor.id=toi.tab_order_id where toi.store_id=$1 and tor.id is null", [SID]);
  const negStock = await n("select count(*) n from stock_items where store_id=$1 and (data->>'qty')::numeric < 0", [SID]);
  const underpaid = await n(`select count(*) n from tabs t where t.store_id=$1 and t.status='fechada' and (coalesce((select sum(qty*unit_price_cents) from tab_order_items toi join tab_orders tor on tor.id=toi.tab_order_id where tor.tab_id=t.id),0)+t.cover_cents+t.service_fee_cents) - coalesce((select sum(amount_cents) from tab_payments tp where tp.tab_id=t.id),0) > 0`, [SID]);
  const flags = [];
  if (nullStn) flags.push(`${nullStn} pedido(s) SEM estação`);
  if (orphanItems) flags.push(`${orphanItems} item(ns) órfão(s)`);
  if (negStock) flags.push(`${negStock} estoque negativo`);
  if (underpaid) flags.push(`${underpaid} comanda fechada com falta>0`);
  L(flags.length ? "  ⚠️  INTEGRIDADE: " + flags.join(" | ") : "  ✅ integridade ok");
} finally { await c.end(); }
