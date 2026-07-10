// Zera os DADOS DE TESTE do Medellín pro go-live. NÃO mexe em cadastro (produtos, categorias,
// mesas, estoque-itens, config, app_settings). Limpa: comandas+pedidos+itens+pagamentos, caixa,
// shows de teste. Dry-run por padrão; só apaga com --commit.
// Uso: node scripts/reset-medellin-golive.mjs        (mostra o que apagaria)
//      node scripts/reset-medellin-golive.mjs --commit
import { readFileSync } from "node:fs";
import pg from "pg";
const COMMIT = process.argv.includes("--commit");
const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = (env.match(/DATABASE_URL=(.+)/) || [])[1]?.trim();
const mm = url.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^:/]+):(\d+)\/(.+)$/);
const [, user, password, host, port, database] = mm;
const c = new pg.Client({ user, password, host, port: +port, database, ssl: { rejectUnauthorized: false } });
await c.connect();
const q = async (sql, p = []) => (await c.query(sql, p)).rows;
const n = async (sql, p = []) => Number((await q(sql, p))[0].n);
const line = console.log;
try {
  const SID = (await q("select id from stores where slug='medellin'"))[0].id;
  line(`Medellín store_id = ${SID}`);
  line(COMMIT ? "\n🔴 MODO COMMIT — vai APAGAR:\n" : "\n🟡 DRY-RUN (nada será apagado). Rode com --commit pra executar de verdade.\n");

  const counts = {
    tab_order_items: await n("select count(*) n from tab_order_items where store_id=$1", [SID]),
    tab_payments: await n("select count(*) n from tab_payments where store_id=$1", [SID]),
    tab_orders: await n("select count(*) n from tab_orders where store_id=$1", [SID]),
    tabs: await n("select count(*) n from tabs where store_id=$1", [SID]),
    cash_sessions: await n("select count(*) n from cash_sessions where store_id=$1", [SID]),
    events_teste: await n("select count(*) n from events where store_id=$1 and artist ilike '%TESTE%'", [SID]),
  };
  Object.entries(counts).forEach(([k, v]) => line(`  ${k}: ${v}`));
  line("\n  (PRESERVADO: menu_products, menu_categories, tables, stock_items, store_config, app_settings, coupons, customers)");

  if (!COMMIT) { line("\nDry-run só. Nada apagado."); await c.end(); process.exit(0); }

  // ordem respeita FKs: itens → pagamentos → orders → tabs → caixa → shows de teste
  await q("delete from tab_order_items where store_id=$1", [SID]);
  await q("delete from tab_payments where store_id=$1", [SID]);
  await q("delete from tab_orders where store_id=$1", [SID]);
  await q("delete from tabs where store_id=$1", [SID]);
  await q("delete from cash_sessions where store_id=$1", [SID]);
  await q("delete from events where store_id=$1 and artist ilike '%TESTE%'", [SID]);
  line("\n✅ Dados de teste apagados. Cadastro intacto. Bar pronto pra abrir do zero.");
} finally { await c.end(); }
