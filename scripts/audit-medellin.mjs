// Auditoria de go-live do tenant Medellín — READ-ONLY. Uso: node scripts/audit-medellin.mjs
import { readFileSync } from "node:fs";
import pg from "pg";
const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = (env.match(/DATABASE_URL=(.+)/) || [])[1]?.trim();
const m = url.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^:/]+):(\d+)\/(.+)$/);
const [, user, password, host, port, database] = m;
const c = new pg.Client({ user, password, host, port: +port, database, ssl: { rejectUnauthorized: false } });
await c.connect();
const q = async (sql, p = []) => (await c.query(sql, p)).rows;
const brl = (cents) => "R$ " + ((cents || 0) / 100).toFixed(2);
const line = (s) => console.log(s);
const H = (s) => { console.log("\n=== " + s + " ==="); };

try {
  const SID = (await q("select id from stores where slug='medellin'"))[0].id;
  const problems = [];

  // 1) CONFIG
  H("1) CONFIG");
  const cfg = (await q("select * from store_config where store_id=$1", [SID]))[0];
  line(`template=${cfg.menu_template} tables=${cfg.has_tables} balcao=${cfg.has_balcao} cover=${cfg.cover_enabled} stations=${cfg.has_stations} estoque=${cfg.has_estoque} loyalty=${cfg.loyalty_enabled} weight=${cfg.sells_by_weight}`);

  // 2) CAIXA (cash_sessions jsonb)
  H("2) CAIXA");
  const sessions = await q("select id, data from cash_sessions where store_id=$1 order by (data->>'openedAt') desc nulls last", [SID]);
  line(`sessões: ${sessions.length}`);
  const open = sessions.filter((s) => !s.data.closedAt && s.data.status !== "fechado");
  line(`abertas: ${open.length}`);
  for (const s of open) {
    const d = s.data;
    const movs = d.movements || [];
    const sangria = movs.filter((mv) => mv.type === "sangria").reduce((a, mv) => a + (mv.amountCents || 0), 0);
    const supr = movs.filter((mv) => mv.type === "suprimento").reduce((a, mv) => a + (mv.amountCents || 0), 0);
    line(`  caixa ${s.id}: openedAt=${d.openedAt} fundo=${brl(d.openingFloatCents)} movs=${movs.length} sangria=${brl(sangria)} suprimento=${brl(supr)}`);
  }
  // reconciliação: caixa em dinheiro esperado = fundo + comandas dinheiro do dia − sangria + suprimento
  const cashTabs = (await q("select coalesce(sum(amount_cents),0) as t from tab_payments where store_id=$1 and method='dinheiro' and paid_at::date=current_date", [SID]))[0].t;
  const fundo = open[0]?.data?.openingFloatCents || 0;
  line(`  → esperado em caixa (dinheiro): fundo ${brl(fundo)} + comandas dinheiro ${brl(cashTabs)} = ${brl(fundo + Number(cashTabs))}`);

  // 3) TABS (mesas/comandas)
  H("3) COMANDAS (tabs)");
  const tabs = await q("select id, table_id, label, status, cover_cents, people_count, service_fee_cents, opened_at, closed_at, waiter_id from tabs where store_id=$1 order by opened_at desc", [SID]);
  const openTabs = tabs.filter((t) => t.status !== "fechada");
  line(`total tabs: ${tabs.length} | abertas: ${openTabs.length} | fechadas: ${tabs.filter(t=>t.status==='fechada').length}`);
  for (const t of openTabs) {
    const items = await q("select toi.qty, toi.unit_price_cents, toi.name, tor.station from tab_order_items toi join tab_orders tor on tor.id=toi.tab_order_id where tor.tab_id=$1", [t.id]);
    const consumo = items.reduce((a, i) => a + i.qty * i.unit_price_cents, 0);
    const pays = await q("select method, amount_cents from tab_payments where tab_id=$1", [t.id]);
    const paid = pays.reduce((a, p) => a + p.amount_cents, 0);
    const abertaHa = t.opened_at ? Math.round((Date.now() - new Date(t.opened_at)) / 60000) : "?";
    line(`  tab#${t.id} mesa=${t.table_id} label=${t.label ?? "-"} status=${t.status} itens=${items.length} consumo=${brl(consumo)} cover=${brl(t.cover_cents)}(${t.people_count}p) taxa=${brl(t.service_fee_cents)} pago=${brl(paid)} abertaHá=${abertaHa}min`);
    const noStation = items.filter((i) => !i.station);
    if (noStation.length) problems.push(`tab#${t.id}: ${noStation.length} item(ns) SEM estação (não roteia pro preparo)`);
  }

  // 4) ROTEAMENTO POR ESTAÇÃO
  H("4) ROTEAMENTO (tab_orders.station)");
  const stns = await q("select coalesce(station,'(null)') as station, count(*) from tab_orders where store_id=$1 group by station", [SID]);
  stns.forEach((r) => line(`  ${r.station}: ${r.count}`));
  const nullStn = stns.find((r) => r.station === "(null)");
  if (nullStn) problems.push(`${nullStn.count} tab_orders com station NULL — não roteia pro KDS/preparo`);

  // 5) MENU / CATEGORIAS (estação por categoria)
  H("5) CARDÁPIO");
  const cats = await q("select name, station, active, earns_points from menu_categories where store_id=$1 order by sort", [SID]);
  line(`categorias: ${cats.length}`);
  cats.forEach((r) => line(`  ${r.name} → estação=${r.station ?? "(nenhuma)"} ativa=${r.active} pontua=${r.earns_points}`));
  const catNoStation = cats.filter((r) => r.active && !r.station);
  if (catNoStation.length) problems.push(`${catNoStation.length} categoria(s) ativa(s) sem estação: ${catNoStation.map(c=>c.name).join(", ")}`);

  // 6) ESTOQUE (stock_items jsonb)
  H("6) ESTOQUE");
  const stock = await q("select data from stock_items where store_id=$1", [SID]);
  line(`itens: ${stock.length}`);
  if (stock[0]) line(`  keys: ${Object.keys(stock[0].data).join(", ")}`);
  let neg = 0, sellableNoPrice = 0;
  for (const s of stock) {
    const d = s.data;
    const qty = Number(d.qty ?? d.quantity ?? 0);
    if (qty < 0) { neg++; problems.push(`estoque negativo: ${d.name} = ${qty}`); }
    if ((d.sellPriceCents || d.sellPrice) === 0 && d.sellable) sellableNoPrice++;
  }
  line(`  negativos: ${neg} | vendáveis sem preço: ${sellableNoPrice}`);

  // 7) COVER / SHOWS
  H("7) SHOWS & COVER");
  const evs = await q("select artist, event_date, cover_cents, repasse_cents, active from events where store_id=$1 order by event_date desc", [SID]);
  line(`shows: ${evs.length}`);
  evs.forEach((e) => line(`  ${e.event_date?.toISOString?.().slice(0,10) ?? e.event_date} | ${e.artist} | cover=${brl(e.cover_cents)} repasse=${brl(e.repasse_cents)} ativo=${e.active}`));

  // 8) FINANCEIRO — reconciliação de pagamentos (tab_payments) do dia
  H("8) FINANCEIRO (tab_payments hoje)");
  const payAgg = await q("select method, count(*), sum(amount_cents) as total, sum(round(amount_cents*fee_percent/100.0)) as taxa_maquina from tab_payments where store_id=$1 and paid_at::date = current_date group by method", [SID]);
  let totComandas = 0;
  payAgg.forEach((r) => { totComandas += Number(r.total); line(`  ${r.method}: ${r.count}x = ${brl(r.total)} (taxa máq ${brl(r.taxa_maquina)})`); });
  line(`  TOTAL comandas (hoje): ${brl(totComandas)}`);

  // 9) INTEGRIDADE
  H("9) INTEGRIDADE");
  const orphanItems = (await q("select count(*) from tab_order_items toi left join tab_orders tor on tor.id=toi.tab_order_id where toi.store_id=$1 and tor.id is null", [SID]))[0].count;
  const orphanOrders = (await q("select count(*) from tab_orders tor left join tabs t on t.id=tor.tab_id where tor.store_id=$1 and t.id is null", [SID]))[0].count;
  const orphanPays = (await q("select count(*) from tab_payments tp left join tabs t on t.id=tp.tab_id where tp.store_id=$1 and t.id is null", [SID]))[0].count;
  // comandas FECHADAS mas pagas a menos (falta > 0): consumo+cover+taxa vs pago
  const closedRows = await q("select t.id, t.cover_cents, t.service_fee_cents, coalesce((select sum(qty*unit_price_cents) from tab_order_items toi join tab_orders tor on tor.id=toi.tab_order_id where tor.tab_id=t.id),0) as consumo, coalesce((select sum(amount_cents) from tab_payments tp where tp.tab_id=t.id),0) as pago from tabs t where t.store_id=$1 and t.status='fechada'", [SID]);
  const underpaid = closedRows.filter((r) => Number(r.consumo) + Number(r.cover_cents) + Number(r.service_fee_cents) - Number(r.pago) > 0);
  line(`  itens órfãos (sem order): ${orphanItems}`);
  line(`  orders órfãos (sem tab): ${orphanOrders}`);
  line(`  pagamentos órfãos (sem tab): ${orphanPays}`);
  line(`  comandas fechadas pagas a menos: ${underpaid.length}${underpaid.length ? " → tabs " + underpaid.map(r=>r.id).join(",") : ""}`);
  if (+orphanItems) problems.push(`${orphanItems} tab_order_items órfãos`);
  if (+orphanOrders) problems.push(`${orphanOrders} tab_orders órfãos`);
  if (+orphanPays) problems.push(`${orphanPays} tab_payments órfãos`);
  if (underpaid.length) problems.push(`${underpaid.length} comanda(s) fechada(s) com falta > 0 (fechou sem quitar): ${underpaid.map(r=>r.id).join(",")}`);

  // RESUMO
  H("RESUMO DE PROBLEMAS");
  if (!problems.length) line("  ✅ nenhum problema de integridade/config encontrado");
  else problems.forEach((p) => line("  ⚠️  " + p));
} finally { await c.end(); }
