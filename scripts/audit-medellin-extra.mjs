// Auditoria extra de go-live (produtos/mesas/equipe/cupons/fiscal) + baseline pro diff. READ-ONLY.
import { readFileSync, writeFileSync } from "node:fs";
import pg from "pg";
const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = (env.match(/DATABASE_URL=(.+)/) || [])[1]?.trim();
const mm = url.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^:/]+):(\d+)\/(.+)$/);
const [, user, password, host, port, database] = mm;
const c = new pg.Client({ user, password, host, port: +port, database, ssl: { rejectUnauthorized: false } });
await c.connect();
const q = async (sql, p = []) => (await c.query(sql, p)).rows;
const brl = (x) => "R$ " + ((x || 0) / 100).toFixed(2);
const line = console.log;
const H = (s) => console.log("\n=== " + s + " ===");
try {
  const SID = (await q("select id from stores where slug='medellin'"))[0].id;
  const problems = [];

  H("PRODUTOS (menu_products)");
  const prods = await q("select p.name, p.price_cents, p.img, p.active, p.by_weight, mc.name cat, mc.station from menu_products p left join menu_categories mc on mc.id=p.category_id where p.store_id=$1 order by mc.sort, p.sort", [SID]);
  line(`total: ${prods.length} | ativos: ${prods.filter(p=>p.active).length}`);
  const noPrice = prods.filter((p) => p.active && !p.by_weight && (!p.price_cents || p.price_cents === 0));
  const noImg = prods.filter((p) => p.active && !p.img);
  const noCat = prods.filter((p) => p.active && !p.cat);
  line(`  ativos sem preço: ${noPrice.length}${noPrice.length ? " → " + noPrice.slice(0,8).map(p=>p.name).join(", ") : ""}`);
  line(`  ativos sem foto: ${noImg.length}${noImg.length ? " → " + noImg.slice(0,8).map(p=>p.name).join(", ") : ""}`);
  line(`  ativos sem categoria: ${noCat.length}`);
  if (noPrice.length) problems.push(`${noPrice.length} produto(s) ativo(s) SEM preço`);
  if (noCat.length) problems.push(`${noCat.length} produto(s) ativo(s) SEM categoria (não roteia estação)`);
  // produtos por estação (o que sai onde)
  const perCat = {};
  prods.filter(p=>p.active).forEach((p)=>{ const k=`${p.cat ?? "?"} [${p.station ?? "?"}]`; perCat[k]=(perCat[k]||0)+1; });
  Object.entries(perCat).forEach(([k,v])=>line(`  ${k}: ${v}`));

  H("MESAS (tables)");
  const tbls = await q("select area, count(*), min(number) mn, max(number) mx from tables where store_id=$1 group by area", [SID]);
  tbls.forEach((r)=>line(`  ${r.area}: ${r.count} mesas (nº ${r.mn}–${r.mx})`));

  H("EQUIPE (staff)");
  const st = await q("select name, commission_percent, active from staff where store_id=$1 order by name", [SID]);
  line(`total: ${st.length} | ativos: ${st.filter(s=>s.active).length}`);
  st.forEach((s)=>line(`  ${s.name} — comissão ${s.commission_percent}% ativo=${s.active}`));

  H("CUPONS");
  const cps = await q("select code, kind, percent, value_cents, active, used_count, usage_limit from coupons where store_id=$1", [SID]);
  line(`total: ${cps.length}`);
  cps.forEach((r)=>line(`  ${r.code} ${r.kind} ${r.percent??""}${r.value_cents?brl(r.value_cents):""} ativo=${r.active} usos=${r.used_count}/${r.usage_limit??"∞"}`));

  H("CLIENTES");
  line(`total: ${(await q("select count(*) from customers where store_id=$1",[SID]))[0].count}`);

  H("FISCAL / CUPOM (app_settings)");
  const asr = await q("select data from app_settings where store_id=$1", [SID]);
  const store = asr[0]?.data?.store ?? asr[0]?.data ?? {};
  line(`  nome=${store.name ?? "?"} tel=${store.whatsapp ?? store.tel ?? "?"}`);
  line(`  endereco=${store.endereco ?? "(vazio)"} cnpj=${store.cnpj ?? "(vazio)"}`);
  line(`  rodapé cupom=${store.cupomRodape ? "sim" : "(vazio)"} cor=${store.primaryColor ?? "?"} logo=${store.logoUrl ? "sim" : "não"}`);
  const machines = asr[0]?.data?.cardMachines ?? asr[0]?.data?.machines ?? [];
  line(`  maquininhas cadastradas: ${Array.isArray(machines) ? machines.length : "?"}`);
  const fees = asr[0]?.data?.fees;
  if (fees) line(`  taxas cartão: ${JSON.stringify(fees).slice(0,120)}`);
  if (!store.endereco) problems.push("endereço vazio (sai em branco no cupom)");
  if (!store.cnpj) problems.push("CNPJ vazio (sai em branco no cupom)");

  H("RESUMO EXTRA");
  if (!problems.length) line("  ✅ nada crítico");
  else problems.forEach((p)=>line("  ⚠️  " + p));

  // BASELINE pro diff pós-CIC
  const snap = {
    at: new Date().toISOString(),
    tabs: Number((await q("select count(*) n from tabs where store_id=$1",[SID]))[0].n),
    tabs_abertas: Number((await q("select count(*) n from tabs where store_id=$1 and status<>'fechada'",[SID]))[0].n),
    tab_orders: Number((await q("select count(*) n from tab_orders where store_id=$1",[SID]))[0].n),
    tab_payments: Number((await q("select count(*) n from tab_payments where store_id=$1",[SID]))[0].n),
    pay_total_hoje: Number((await q("select coalesce(sum(amount_cents),0) n from tab_payments where store_id=$1 and paid_at::date=current_date",[SID]))[0].n),
    staff: Number((await q("select count(*) n from staff where store_id=$1",[SID]))[0].n),
    coupons: Number((await q("select count(*) n from coupons where store_id=$1",[SID]))[0].n),
    customers: Number((await q("select count(*) n from customers where store_id=$1",[SID]))[0].n),
    stock_total_qty: Number((await q("select coalesce(sum((data->>'qty')::numeric),0) n from stock_items where store_id=$1",[SID]))[0].n),
    max_tab_id: Number((await q("select coalesce(max(id),0) n from tabs where store_id=$1",[SID]))[0].n),
  };
  writeFileSync(new URL("./.medellin-baseline.json", import.meta.url), JSON.stringify(snap, null, 2));
  H("BASELINE salvo (scripts/.medellin-baseline.json)");
  line(JSON.stringify(snap));
} finally { await c.end(); }
