// Simula 1 mês de operação de uma AT no tenant Starteq (showcase). Insere direto no banco
// (sem mexer nas quantidades do estoque) e grava um MANIFESTO com todo ID criado, pra limpeza
// cirúrgica depois (scripts/clean-mes-starteq.mjs). Uso: node scripts/seed-mes-starteq.mjs
import { readFileSync, writeFileSync } from "node:fs";
import pg from "pg";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = (env.match(/DATABASE_URL=(.+)/) || [])[1]?.trim();
const m = url.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^:/]+):(\d+)\/(.+)$/);
const [, user, password, host, port, database] = m;
const client = new pg.Client({ user, password, host, port: +port, database, ssl: { rejectUnauthorized: false } });

const SID = "c1251296-9bee-40ed-a98e-472614c61bf8"; // Starteq
const STAFF = [
  { id: "b7de7abe-400b-4dfb-958d-bfb7dce154b0", name: "Rafael Costa", pct: 30 },
  { id: "5b1b5e39-67b2-42cb-ad40-4916d6142708", name: "Marina Lopes", pct: 25 },
];

const rnd = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rnd(a, b + 1));
const pick = (arr) => arr[ri(0, arr.length - 1)];
const chance = (p) => Math.random() < p;
const ALPH = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const code = (pre, n = 6) => pre + Array.from({ length: n }, () => pick([...ALPH])).join("");
const rid = (pre) => pre + Math.random().toString(36).slice(2, 10);

// janela: últimos 30 dias até hoje
const NOW = new Date();
const dayISO = (d) => d.toISOString();
const ymd = (d) => d.toISOString().slice(0, 10);
function randDate() { const d = new Date(NOW); d.setDate(d.getDate() - ri(0, 29)); d.setHours(ri(9, 18), ri(0, 59), 0, 0); return d; }

const NOMES = ["Ana Paula", "Bruno Alves", "Carla Dias", "Diego Nunes", "Eduarda Reis", "Felipe Sá", "Gabriela Luz", "Hugo Martins", "Isabela Rocha", "João Vitor", "Karina Melo", "Lucas Prado", "Marcos Vinícius", "Natália Gomes", "Otávio Lima", "Paula Freitas", "Rafaela Souza", "Samuel Costa", "Tatiane Cruz", "Vinícius Barros", "Wesley Pinto", "Yasmin Torres", "Alan Ribeiro", "Beatriz Campos", "Caio Fonseca"];
const fone = () => `63 9${ri(6, 9)}${ri(100, 999)}-${ri(1000, 9999)}`;
const DEVICES = ["Notebook Acer Aspire 5", "Notebook Dell Inspiron 15", "Notebook Lenovo IdeaPad 3", "PC Gamer Desktop", "Notebook Samsung Book", "PC Desktop Escritório", "Notebook Positivo Motion", "Notebook ASUS VivoBook", "All-in-One LG", "PC Montado Ryzen"];
// serviços típicos de AT: [descrição, valor serviço, usa peça?]
const SERVICOS = [
  ["Formatação + backup + drivers", 8000, false],
  ["Limpeza interna + pasta térmica", 6000, false],
  ["Remoção de vírus e otimização", 9000, false],
  ["Reinstalação do Windows", 10000, false],
  ["Diagnóstico técnico", 5000, false],
  ["Recuperação de dados", 20000, false],
  ["Troca de tela de notebook", 15000, true],
  ["Troca de fonte", 7000, true],
  ["Upgrade de SSD", 5000, true],
  ["Upgrade de memória RAM", 4000, true],
  ["Troca de teclado de notebook", 8000, true],
  ["Reparo de placa-mãe", 25000, true],
  ["Troca de cooler / ventoinha", 6000, true],
];
const SITUACOES = ["Aguardando peça", "Em orçamento", "Em teste", "Aguardando aprovação"];

const manifest = { criadoEm: dayISO(NOW), sid: SID, service_orders: [], os_parts: [], orders: [], commission_payments: [], budgets: [], purchases: [], bills: [], expenses: [] };

await client.connect();
try {
  await client.query("BEGIN");

  // catálogo real do Starteq p/ peças e vendas
  const { rows: prods } = await client.query(
    "SELECT id, data->>'name' AS name, COALESCE((data->>'sellPriceCents')::int,0) AS sell, data->>'category' AS cat FROM stock_items WHERE store_id=$1 AND COALESCE((data->>'sellPriceCents')::int,0)>0",
    [SID],
  );
  const pecaPool = prods.filter((p) => p.sell <= 250000); // peça de conserto realista
  const { rows: maxRow } = await client.query("SELECT COALESCE(max(id),0) AS mx FROM orders");
  let orderId = Number(maxRow[0].mx);

  // ---------- OS de conserto (~60) + 6 montagens ----------
  const osQuitadasPorTecnico = { [STAFF[0].id]: [], [STAFF[1].id]: [] };
  const osCodes = [];
  async function inserirOS(o) {
    const { rows } = await client.query(
      `INSERT INTO service_orders (store_id, code, customer_name, customer_phone, device, problem, diagnosis, status, situacao, priority, staff_id, commission_percent, service_value_cents, parts_value_cents, discount_cents, total_cents, payment_status, paid_at, payment_method, estimated_at, ready_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,0,$15,$16,$17,$18,$19,$20,$21,$21) RETURNING id`,
      [SID, o.code, o.customer, o.phone, o.device, o.problem, o.diagnosis, o.status, o.situacao, o.priority, o.staffId, o.pct, o.serviceCents, o.partsCents, o.totalCents, o.payStatus, o.paidAt, o.payMethod, o.estimatedAt, o.readyAt, dayISO(o.createdAt)],
    );
    return rows[0].id;
  }

  const TOTAL_OS = 60, TOTAL_MONT = 6;
  for (let i = 0; i < TOTAL_OS; i++) {
    const st = pick(STAFF);
    const [problem, serviceCents, usaPeca] = pick(SERVICOS);
    const createdAt = randDate();
    // peças
    let partsCents = 0; const parts = [];
    if (usaPeca && chance(0.85) && pecaPool.length) {
      const np = chance(0.2) ? 2 : 1;
      for (let k = 0; k < np; k++) { const pr = pick(pecaPool); parts.push(pr); partsCents += pr.sell; }
    }
    // status/pagamento
    const r = Math.random();
    let status, payStatus = "aberta", paidAt = null, payMethod = null, readyAt = null;
    if (r < 0.68) { status = "entregue"; payStatus = "quitada"; }
    else if (r < 0.80) { status = "pronto"; if (chance(0.5)) payStatus = "quitada"; }
    else if (r < 0.90) status = "em_reparo";
    else if (r < 0.95) status = "aguardando";
    else status = "cancelado";
    const totalCents = serviceCents + partsCents;
    if (payStatus === "quitada") { const pd = new Date(createdAt); pd.setDate(pd.getDate() + ri(0, 4)); paidAt = dayISO(pd); payMethod = pick(["pix", "dinheiro", "cartao"]); }
    if (status === "pronto" || status === "entregue") { const rd = new Date(createdAt); rd.setDate(rd.getDate() + ri(0, 3)); readyAt = dayISO(rd); }
    // prazo (alguns atrasados)
    let estimatedAt = null;
    if (["aguardando", "em_reparo", "pronto"].includes(status) && chance(0.7)) { const ed = new Date(createdAt); ed.setDate(ed.getDate() + ri(-2, 6)); estimatedAt = dayISO(ed); }
    const situacao = (["aguardando", "em_reparo"].includes(status) && chance(0.5)) ? pick(SITUACOES) : null;
    const priority = chance(0.3) ? pick(["muito_urgente", "urgente", "alta", "media", "baixa"]) : null;
    const c = code("OS");
    const osId = await inserirOS({
      code: c, customer: pick(NOMES), phone: fone(), device: pick(DEVICES), problem,
      diagnosis: status === "entregue" ? "Serviço concluído e testado." : null,
      status, situacao, priority, staffId: st.id, pct: st.pct, serviceCents, partsCents,
      totalCents, payStatus, paidAt, payMethod, estimatedAt, readyAt, createdAt,
    });
    manifest.service_orders.push(osId); osCodes.push({ id: osId, code: c });
    for (const pr of parts) {
      const { rows } = await client.query("INSERT INTO os_parts (store_id, os_id, sku, name, qty, unit_cost_cents) VALUES ($1,$2,$3,$4,1,$5) RETURNING id", [SID, osId, pr.id, pr.name, pr.sell]);
      manifest.os_parts.push(rows[0].id);
    }
    if (payStatus === "quitada") osQuitadasPorTecnico[st.id].push({ id: osId, comm: Math.round(serviceCents * st.pct / 100), paidAt });
  }

  // montagens de PC (6) — service = taxa de montagem, parts = componentes
  for (let i = 0; i < TOTAL_MONT; i++) {
    const st = pick(STAFF);
    const createdAt = randDate();
    const comps = Array.from({ length: ri(4, 7) }, () => pick(pecaPool));
    const partsCents = comps.reduce((s, p) => s + p.sell, 0);
    const serviceCents = pick([15000, 20000, 25000, 30000]);
    const totalCents = serviceCents + partsCents;
    const quit = chance(0.7);
    const paidAt = quit ? (() => { const d = new Date(createdAt); d.setDate(d.getDate() + ri(0, 3)); return dayISO(d); })() : null;
    const c = code("OS");
    const osId = await inserirOS({
      code: c, customer: pick(NOMES), phone: fone(), device: `Montagem de PC (${comps.length} peças)`,
      problem: "Montagem de PC / setup", diagnosis: quit ? "Montado e testado (stress test OK)." : null,
      status: quit ? "entregue" : "em_reparo", situacao: null, priority: chance(0.3) ? "alta" : null,
      staffId: st.id, pct: st.pct, serviceCents, partsCents, totalCents,
      payStatus: quit ? "quitada" : "aberta", paidAt, payMethod: quit ? pick(["pix", "cartao"]) : null,
      estimatedAt: null, readyAt: paidAt, createdAt,
    });
    manifest.service_orders.push(osId);
    for (const pr of comps) { const { rows } = await client.query("INSERT INTO os_parts (store_id, os_id, sku, name, qty, unit_cost_cents) VALUES ($1,$2,$3,$4,1,$5) RETURNING id", [SID, osId, pr.id, pr.name, pr.sell]); manifest.os_parts.push(rows[0].id); }
    if (quit) osQuitadasPorTecnico[st.id].push({ id: osId, comm: Math.round(serviceCents * st.pct / 100), paidAt });
  }

  // ---------- Pagamentos de comissão (2 fechamentos por técnico; deixa ~20% pendente) ----------
  for (const st of STAFF) {
    const os = osQuitadasPorTecnico[st.id].sort((a, b) => (a.paidAt < b.paidAt ? -1 : 1));
    const pagar = os.slice(0, Math.floor(os.length * 0.8)); // 20% fica pendente
    const meio = Math.ceil(pagar.length / 2);
    const lotes = [pagar.slice(0, meio), pagar.slice(meio)].filter((l) => l.length);
    for (const lote of lotes) {
      const total = lote.reduce((s, o) => s + o.comm, 0);
      if (!total) continue;
      const id = rid("cp");
      const paidAt = lote[lote.length - 1].paidAt;
      const per = paidAt.slice(0, 10);
      await client.query("INSERT INTO commission_payments (id, store_id, data) VALUES ($1,$2,$3)", [id, SID, JSON.stringify({ id, notes: null, osIds: lote.map((o) => o.id), paidAt, staffId: st.id, createdAt: paidAt, paidCents: total, periodEnd: per, bonusCents: 0, totalCents: total, bonusReason: null, periodStart: per })]);
      await client.query("UPDATE service_orders SET commission_payment_id=$1 WHERE id = ANY($2)", [id, lote.map((o) => o.id)]);
      manifest.commission_payments.push(id);
    }
  }

  // ---------- Vendas de balcão (~120) ----------
  for (let i = 0; i < 120; i++) {
    const createdAt = randDate();
    const n = ri(1, 3); const items = []; let subtotal = 0;
    for (let k = 0; k < n; k++) { const pr = pick(prods); const qty = chance(0.85) ? 1 : 2; items.push({ qty, name: pr.name, group: pr.cat, paidCents: pr.sell * qty, earnsPoints: false }); subtotal += pr.sell * qty; }
    const pay = pick(["dinheiro", "pix", "pix", "debito", "credito"]);
    let discountCents = 0, cardFeeCents = 0;
    if (pay === "pix") discountCents = Math.round(subtotal * 0.05);
    if (pay === "debito") cardFeeCents = Math.round(subtotal * 0.02);
    if (pay === "credito") cardFeeCents = Math.round(subtotal * 0.035);
    const totalCents = subtotal - discountCents;
    orderId += 1;
    const data = { id: orderId, code: code(""), mode: "balcao", items, phone: "", status: "entregue", display: "#" + orderId, consumed: true, feeCents: 0, cardFeeCents, createdAt: dayISO(createdAt), sizeLabel: "", totalCents, customerName: chance(0.4) ? pick(NOMES) : "", discountCents, paymentMethod: pay, subtotalCents: subtotal };
    await client.query("INSERT INTO orders (id, store_id, data) VALUES ($1,$2,$3)", [orderId, SID, JSON.stringify(data)]);
    manifest.orders.push(orderId);
  }
  // Os INSERTs acima usam id EXPLÍCITO → a sequência identity de `orders` NÃO avança sozinha.
  // Resincroniza pro max(id) real: senão a PRÓXIMA VENDA REAL (de qualquer loja) colide no id
  // (23505 duplicate pkey) e o balcão para de registrar venda. (Incidente Cantinho 15/07/2026.)
  await client.query("SELECT setval(pg_get_serial_sequence('orders','id'), (SELECT max(id) FROM orders))");

  // ---------- Orçamentos (~20) ----------
  for (let i = 0; i < 20; i++) {
    const createdAt = randDate();
    const n = ri(1, 3); const items = [];
    for (let k = 0; k < n; k++) { const pr = pick(prods); items.push({ qty: 1, kind: "produto", name: pr.name, unitCents: pr.sell, discountCents: 0 }); }
    if (chance(0.7)) items.push({ qty: 1, kind: "servico", name: pick(SERVICOS)[0], unitCents: pick([5000, 8000, 10000, 15000]), discountCents: 0 });
    const r = Math.random();
    const status = r < 0.35 ? "aprovado" : r < 0.6 ? "pendente" : r < 0.8 ? "expirado" : "recusado";
    const linked = status === "aprovado" && osCodes.length ? pick(osCodes) : null;
    const val = new Date(createdAt); val.setDate(val.getDate() + 14);
    const id = rid("bd");
    await client.query("INSERT INTO budgets (id, store_id, data) VALUES ($1,$2,$3)", [id, SID, JSON.stringify({ id, cpf: null, code: code("OR"), items, status, createdAt: dayISO(createdAt), approvedAt: status === "aprovado" ? dayISO(createdAt) : null, freteCents: 0, observacao: "Preços sujeitos a disponibilidade de estoque.", validadeAt: ymd(val), outrosCents: 0, customerName: pick(NOMES), customerPhone: fone(), discountCents: 0, osId: linked?.id ?? null, osCode: linked?.code ?? null })]);
    manifest.budgets.push(id);
  }

  // ---------- Compras / reposição (8) + despesa de cada ----------
  const FORNEC = ["Distribuidora TechSul", "Info Atacado LTDA", "Mega Componentes", "Nortech Distribuição"];
  for (let i = 0; i < 8; i++) {
    const date = ymd(randDate());
    const n = ri(2, 4); const items = []; let tot = 0;
    for (let k = 0; k < n; k++) { const pr = pick(prods); const qty = ri(2, 6); const cost = Math.round(pr.sell * 0.7); items.push({ stockId: pr.id, name: pr.name, qty, unitCostCents: cost }); tot += qty * cost; }
    const frete = pick([0, 2500, 4000]); tot += frete;
    const id = rid("pc"); const c = code("PC");
    await client.query("INSERT INTO purchases (id, store_id, data) VALUES ($1,$2,$3)", [id, SID, JSON.stringify({ id, code: c, fornecedor: pick(FORNEC), nfNumber: String(ri(10000, 99999)), items, freteCents: frete, notes: null, date, status: "recebida", receivedAt: date + "T12:00:00-03:00", createdAt: date + "T10:00:00-03:00" })]);
    manifest.purchases.push(id);
    const eid = rid("e");
    await client.query("INSERT INTO expenses (id, store_id, data) VALUES ($1,$2,$3)", [eid, SID, JSON.stringify({ id: eid, description: `Compra ${c} · fornecedor`, category: "pecas", amountCents: tot, date, createdAt: date + "T12:00:00-03:00" })]);
    manifest.expenses.push(eid);
  }

  // ---------- Despesas fixas + variáveis ----------
  const mesRef = ymd(new Date(NOW.getFullYear(), NOW.getMonth(), 5));
  const DESP = [
    ["Aluguel da loja", "aluguel", 180000, mesRef],
    ["Energia elétrica", "utilidades", 45000, ymd(new Date(NOW.getFullYear(), NOW.getMonth(), 10))],
    ["Internet fibra", "utilidades", 15000, ymd(new Date(NOW.getFullYear(), NOW.getMonth(), 8))],
    ["Salários (equipe)", "salarios", 300000, ymd(new Date(NOW.getFullYear(), NOW.getMonth(), 5))],
    ["Tráfego pago / marketing", "marketing", 20000, ymd(randDate())],
    ["Material de limpeza e escritório", "outros", 8000, ymd(randDate())],
    ["Manutenção de equipamento de bancada", "manutencao", 12000, ymd(randDate())],
  ];
  for (const [desc, cat, amt, date] of DESP) { const eid = rid("e"); await client.query("INSERT INTO expenses (id, store_id, data) VALUES ($1,$2,$3)", [eid, SID, JSON.stringify({ id: eid, description: desc, category: cat, amountCents: amt, date, createdAt: date + "T09:00:00-03:00" })]); manifest.expenses.push(eid); }

  // ---------- Contas a pagar/receber ----------
  const d = (off) => { const x = new Date(NOW); x.setDate(x.getDate() + off); return ymd(x); };
  const BILLS = [
    { kind: "pagar", description: "Fornecedor Mega Componentes (NF 4821)", party: "Mega Componentes", amountCents: 340000, dueDate: d(5), payments: [] },
    { kind: "pagar", description: "Aluguel julho", party: "Imobiliária Central", amountCents: 180000, dueDate: d(-3), payments: [] },
    { kind: "pagar", description: "Energia elétrica", party: "Energisa", amountCents: 45000, dueDate: d(-8), payments: [{ amountCents: 45000, date: d(-6), note: null }] },
    { kind: "pagar", description: "Parcelamento maquininha", party: "SafraPay", amountCents: 60000, dueDate: d(12), payments: [] },
    { kind: "receber", description: "Fiado - conserto notebook", party: "Cliente Ana Paula", amountCents: 50000, dueDate: d(4), payments: [{ amountCents: 20000, date: d(-2), note: "entrada" }] },
    { kind: "receber", description: "Venda parcelada PC gamer", party: "Cliente Lucas Prado", amountCents: 120000, dueDate: d(10), payments: [] },
    { kind: "receber", description: "Fiado - upgrade SSD", party: "Cliente Diego Nunes", amountCents: 30000, dueDate: d(-5), payments: [{ amountCents: 30000, date: d(-4), note: null }] },
  ];
  for (const b of BILLS) {
    const id = rid("bl"); const pre = b.kind === "pagar" ? "CP" : "CR";
    const paid = b.payments.reduce((s, p) => s + p.amountCents, 0);
    const settledAt = paid >= b.amountCents ? d(-1) + "T12:00:00-03:00" : null;
    await client.query("INSERT INTO bills (id, store_id, data) VALUES ($1,$2,$3)", [id, SID, JSON.stringify({ id, code: code(pre), kind: b.kind, description: b.description, party: b.party, amountCents: b.amountCents, dueDate: b.dueDate, payments: b.payments, notes: null, settledAt, createdAt: dayISO(NOW) })]);
    manifest.bills.push(id);
  }

  await client.query("COMMIT");
  writeFileSync(new URL("../.seed-mes-manifest.json", import.meta.url), JSON.stringify(manifest, null, 2));
  const c = (k) => manifest[k].length;
  console.log("OK — mês simulado no Starteq:");
  console.log(`  OS+montagens: ${c("service_orders")} (peças: ${c("os_parts")})`);
  console.log(`  Vendas balcão: ${c("orders")}`);
  console.log(`  Comissões pagas: ${c("commission_payments")}`);
  console.log(`  Orçamentos: ${c("budgets")}  Compras: ${c("purchases")}  Contas: ${c("bills")}  Despesas: ${c("expenses")}`);
  console.log("Manifesto: .seed-mes-manifest.json (usar no clean-mes-starteq.mjs)");
} catch (e) {
  await client.query("ROLLBACK");
  console.error("ERRO — rollback:", e.message);
  process.exit(1);
} finally {
  await client.end();
}
