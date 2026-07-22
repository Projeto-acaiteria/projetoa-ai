// AUDITORIA FINANCEIRA (read-only). Uso: node scripts/auditoria-financeira.mjs [slug]
// Reconcilia a cadeia do dinheiro: comanda -> pagamento -> caixa -> comissao -> estoque/CMV.
import { readFileSync } from "node:fs";
import pg from "pg";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = (env.match(/DATABASE_URL=(.+)/) || [])[1].trim();
const m = url.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^:/]+):(\d+)\/(.+)$/);
const [, user, password, host, port, database] = m;
const c = new pg.Client({ user, password, host, port: +port, database, ssl: { rejectUnauthorized: false } });
await c.connect();

const slug = process.argv[2] || "medellin";
const brl = (x) => "R$ " + ((Number(x) || 0) / 100).toFixed(2).replace(".", ",");
const q = (s, p) => c.query(s, p).then((r) => r.rows);
const sid = (await q(`select id from stores where slug=$1`, [slug]))[0].id;
const P = [];
const push = (sev, t, d) => P.push({ sev, t, d });
const fdt = (x) => (x ? x.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");

console.log(`\n====== AUDITORIA FINANCEIRA · ${slug.toUpperCase()} ======`);

const [g] = await q(`select
  (select count(*) from tabs where store_id=$1) tabs,
  (select count(*) from tabs where store_id=$1 and status='aberta') abertas,
  (select count(*) from tabs where store_id=$1 and cancelled) canc,
  (select coalesce(sum(amount_cents),0) from tab_payments where store_id=$1) pagotot`, [sid]);
console.log(`comandas: ${g.tabs} (${g.abertas} abertas, ${g.canc} canceladas) · pagamentos no banco ${brl(g.pagotot)}\n`);

// 1) RECONCILIACAO: consumo + couvert + taxa  vs  pago
const rec = await q(`
 select t.id, tb.number mesa, coalesce(t.cover_cents,0) cover, coalesce(t.service_fee_cents,0) fee,
   coalesce((select sum(i.qty*i.unit_price_cents) from tab_orders o join tab_order_items i on i.tab_order_id=o.id where o.tab_id=t.id),0) consumo,
   coalesce((select sum(p.amount_cents) from tab_payments p where p.tab_id=t.id),0) pago,
   to_char(t.closed_at at time zone 'America/Sao_Paulo','DD/MM HH24:MI') fechou
 from tabs t left join tables tb on tb.id=t.table_id
 where t.store_id=$1 and t.status='fechada' and t.cancelled=false`, [sid]);
let okN = 0, difTot = 0;
const difs = [];
for (const r of rec) {
  const esp = Number(r.consumo) + Number(r.cover) + Number(r.fee);
  const d = Number(r.pago) - esp;
  if (Math.abs(d) <= 1) { okN++; continue; }
  difTot += d; difs.push({ ...r, esp, d });
}
console.log(`1) RECONCILIACAO (comandas fechadas: ${rec.length})`);
console.log(`   batem: ${okN} · divergem: ${difs.length}${difs.length ? ` · saldo ${brl(difTot)}` : ""}`);
difs.sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 15).forEach((r) =>
  console.log(`   ! tab#${r.id} mesa ${r.mesa ?? "?"} ${r.fechou}: consumo ${brl(r.consumo)} + couvert ${brl(r.cover)} + taxa ${brl(r.fee)} = ${brl(r.esp)} | pago ${brl(r.pago)} | dif ${brl(r.d)}`));
if (difs.length) push(difs.some((r) => Math.abs(r.d) > 500) ? "A-CRITICO" : "B-ATENCAO", "reconciliacao", `${difs.length} comanda(s) com pago != devido (saldo ${brl(difTot)})`);

// 2) fechadas SEM pagamento
const semPg = rec.filter((r) => Number(r.pago) === 0 && (Number(r.consumo) + Number(r.cover)) > 0);
console.log(`\n2) FECHADAS SEM NENHUM PAGAMENTO: ${semPg.length}`);
semPg.slice(0, 10).forEach((r) => console.log(`   ! tab#${r.id} mesa ${r.mesa ?? "?"} ${r.fechou} · devia ${brl(Number(r.consumo) + Number(r.cover) + Number(r.fee))}`));
if (semPg.length) push("A-CRITICO", "venda nao recebida", `${semPg.length} comanda(s) fechada(s) sem pagamento — ${brl(semPg.reduce((s, r) => s + Number(r.consumo) + Number(r.cover) + Number(r.fee), 0))}`);

// 3) abertas de noites anteriores (corte 6h)
const velhas = await q(`select t.id, tb.number mesa, to_char(t.opened_at at time zone 'America/Sao_Paulo','DD/MM HH24:MI') abriu,
   coalesce((select sum(i.qty*i.unit_price_cents) from tab_orders o join tab_order_items i on i.tab_order_id=o.id where o.tab_id=t.id),0) consumo
 from tabs t left join tables tb on tb.id=t.table_id
 where t.store_id=$1 and t.status='aberta'
   and (t.opened_at at time zone 'America/Sao_Paulo') < date_trunc('day', now() at time zone 'America/Sao_Paulo') + interval '6 hour'`, [sid]);
console.log(`\n3) COMANDAS ABERTAS DE NOITES ANTERIORES: ${velhas.length}`);
velhas.slice(0, 10).forEach((r) => console.log(`   ! tab#${r.id} mesa ${r.mesa ?? "?"} desde ${r.abriu} · ${brl(r.consumo)}`));
if (velhas.length) push("A-CRITICO", "comanda esquecida", `${velhas.length} comanda(s) aberta(s) de noite anterior — ${brl(velhas.reduce((s, r) => s + Number(r.consumo), 0))} pendurado`);

// 4) orfaos
const [orf] = await q(`select
  (select count(*) from tab_payments p where p.store_id=$1 and not exists(select 1 from tabs t where t.id=p.tab_id)) pg,
  (select count(*) from tab_orders o where o.store_id=$1 and not exists(select 1 from tabs t where t.id=o.tab_id)) ped`, [sid]);
console.log(`\n4) ORFAOS: pagamentos ${orf.pg} · pedidos ${orf.ped}`);
if (Number(orf.pg) + Number(orf.ped) > 0) push("A-CRITICO", "orfaos", "registros sem comanda dona");

// 5) canceladas
const canc = await q(`select t.id, coalesce(sum(p.amount_cents),0) pago, t.cancel_reason, t.cancelled_by from tabs t left join tab_payments p on p.tab_id=t.id
  where t.store_id=$1 and t.cancelled group by t.id, t.cancel_reason, t.cancelled_by`, [sid]);
console.log(`\n5) COMANDAS CANCELADAS: ${canc.length} (pagamento fica no banco, filtrado dos relatorios)`);
canc.forEach((r) => console.log(`   tab#${r.id} · ${brl(r.pago)} · "${r.cancel_reason}" · ${r.cancelled_by ?? "?"}`));

// 6) itens sem ficha tecnica
const [fich] = await q(`select count(*) n, count(*) filter (where i.consumes is null or i.consumes='[]'::jsonb) sem
  from tab_order_items i where i.store_id=$1`, [sid]);
const topSem = await q(`select i.name, sum(i.qty) qtd, sum(i.qty*i.unit_price_cents) receita from tab_order_items i
  where i.store_id=$1 and (i.consumes is null or i.consumes='[]'::jsonb) group by i.name order by receita desc limit 8`, [sid]);
const pct = Number(fich.n) ? Math.round((100 * Number(fich.sem)) / Number(fich.n)) : 0;
console.log(`\n6) ITENS SEM FICHA TECNICA: ${fich.sem}/${fich.n} (${pct}%) — nao baixam estoque nem entram no CMV`);
topSem.forEach((r) => console.log(`   • ${r.name} · ${r.qtd}un · ${brl(r.receita)}`));
if (pct > 30) push("B-ATENCAO", "CMV/estoque cego", `${pct}% dos itens vendidos sem ficha tecnica`);

// 7) comissao
const [com] = await q(`select count(*) n from tabs where store_id=$1 and status='fechada' and cancelled=false and waiter_id is null`, [sid]);
const [comOk] = await q(`select count(*) n from tabs where store_id=$1 and status='fechada' and cancelled=false and waiter_id is not null`, [sid]);
console.log(`\n7) COMISSAO: ${com.n} fechada(s) SEM garcom · ${comOk.n} com garcom`);
if (Number(com.n) > 0) push("B-ATENCAO", "comissao", `${com.n} comanda(s) fechada(s) sem garcom (nao gera comissao)`);

// 8) madrugada
const madru = await q(`select (p.paid_at at time zone 'America/Sao_Paulo')::date dia, count(*) n, sum(p.amount_cents) tot
  from tab_payments p join tabs t on t.id=p.tab_id where p.store_id=$1 and t.cancelled=false
   and extract(hour from p.paid_at at time zone 'America/Sao_Paulo') < 6 group by 1 order by 1`, [sid]);
console.log(`\n8) PAGAMENTOS 00h-06h (pertencem a noite ANTERIOR):`);
if (!madru.length) console.log("   nenhum");
madru.forEach((r) => console.log(`   ${new Date(r.dia).toLocaleDateString("pt-BR")}: ${r.n} pgto · ${brl(r.tot)}`));
if (madru.length) push("B-ATENCAO", "bucket de noite", `${madru.reduce((s, r) => s + Number(r.n), 0)} pagamento(s) de madrugada caem no dia civil errado`);

// 9) sessoes de caixa
const sess = await q(`select id, data from cash_sessions where store_id=$1 order by id`, [sid]);
console.log(`\n9) SESSOES DE CAIXA: ${sess.length}`);
for (const s of sess) {
  const d = s.data;
  const ini = d.openedAt ? new Date(d.openedAt) : null;
  const fim = d.closedAt ? new Date(d.closedAt) : null;
  const horas = ini && fim ? ((fim - ini) / 3600000).toFixed(1) : null;
  const params = d.closedAt ? [sid, d.openedAt, d.closedAt] : [sid, d.openedAt];
  const real = (await q(`select coalesce(sum(p.amount_cents),0) t from tab_payments p join tabs tt on tt.id=p.tab_id
     where p.store_id=$1 and tt.cancelled=false and p.paid_at>=$2 ${d.closedAt ? "and p.paid_at<$3" : ""}`, params))[0].t;
  console.log(`   #${s.id} ${d.status} · ${fdt(ini)} -> ${fdt(fim)}${horas ? ` (${horas}h)` : ""} · mesa real ${brl(real)}${d.salesTotalCents != null ? ` · gravado ${brl(d.salesTotalCents)}` : ""}${d.diffCents != null ? ` · dif ${brl(d.diffCents)}` : ""}`);
  if (horas && Number(horas) > 14) push("A-CRITICO", "sessao longa", `caixa #${s.id} ficou ${horas}h aberto (atravessou noites)`);
}

// 10) estoque negativo
const neg = await q(`select data->>'name' nome, (data->>'qty')::numeric q from stock_items where store_id=$1 and (data->>'qty')::numeric < 0`, [sid]);
console.log(`\n10) ESTOQUE NEGATIVO: ${neg.length}`);
neg.slice(0, 10).forEach((r) => console.log(`   ! ${r.nome}: ${r.q}`));
if (neg.length) push("B-ATENCAO", "estoque", `${neg.length} insumo(s) com saldo negativo`);

// 11) couvert
const cov = await q(`select t.id, tb.number mesa, t.people_count p, t.cover_cents cc from tabs t left join tables tb on tb.id=t.table_id
  where t.store_id=$1 and t.status='fechada' and t.cancelled=false and coalesce(t.cover_cents,0)>0`, [sid]);
const [covTot] = await q(`select coalesce(sum(cover_cents),0) t from tabs where store_id=$1 and status='fechada' and cancelled=false`, [sid]);
console.log(`\n11) COUVERT COBRADO: ${cov.length} comanda(s) · total ${brl(covTot.t)}`);
cov.slice(0, 8).forEach((r) => console.log(`   tab#${r.id} mesa ${r.mesa ?? "?"} · ${r.p}p · ${brl(r.cc)}`));

// 12) taxa de servico
const [tx] = await q(`select count(*) filter (where coalesce(service_fee_cents,0)>0) com, count(*) filter (where coalesce(service_fee_cents,0)=0) sem
  from tabs where store_id=$1 and status='fechada' and cancelled=false`, [sid]);
console.log(`\n12) TAXA DE SERVICO 10%: cobrada em ${tx.com} · nao cobrada em ${tx.sem}`);

console.log(`\n====== PENDENCIAS (${P.length}) ======`);
if (!P.length) console.log("OK — nada fora do lugar");
P.sort((a, b) => a.sev.localeCompare(b.sev)).forEach((p) => console.log(`[${p.sev}] ${p.t}: ${p.d}`));
console.log();
await c.end();
