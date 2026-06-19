// Popula .data com ~1 mês de operação movimentada, pra demonstrar o sistema.
// Rodar: node scripts/seed-demo.mjs   (depois recarregar o app)
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const DIR = path.join(process.cwd(), ".data");
mkdirSync(DIR, { recursive: true });
const write = (f, d) => writeFileSync(path.join(DIR, f), JSON.stringify(d, null, 2));

const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const chance = (p) => Math.random() < p;

const NAMES = [
  "Marina Souza", "João Pereira", "Carla Mendes", "Diego Alves", "Rita Lopes", "Pedro Henrique", "Ana Beatriz",
  "Lucas Teixeira", "Fernanda Dias", "Rafael Gomes", "Juliana Castro", "Bruno Martins", "Camila Rocha", "Thiago Nunes",
  "Patrícia Lima", "Gustavo Reis", "Larissa Pires", "Marcelo Vidal", "Beatriz Cunha", "Vinícius Melo", "Sabrina Costa",
  "André Ramos", "Tatiane Freitas", "Felipe Barros", "Renata Aguiar", "Gabriel Moura", "Aline Cardoso", "Rodrigo Pinto",
  "Letícia Farias", "Igor Mendonça", "Priscila Tavares", "Daniel Cordeiro", "Vanessa Brito", "Caio Nogueira",
  "Bianca Macedo", "Otávio Sales", "Débora Vieira", "Hugo Antunes", "Natália Campos", "Wesley Duarte",
];
const ACOMP = ["granola", "banana", "leite cond.", "morango", "paçoca", "Nutella", "Ninho", "ovomaltine", "kiwi", "chocolate"];
const SIZES = [
  { label: "Copo 300ml", base: 1000 },
  { label: "Copo 500ml", base: 1600 },
  { label: "Copo 700ml", base: 2000 },
];
const PRODUTOS = [
  { name: "Refrigerante lata", cents: 600, stockId: "refri" },
  { name: "Picolé de açaí", cents: 600, stockId: "picole" },
  { name: "Sorvete pote 2L (creme)", cents: 2500, stockId: "sorvetepote" },
  { name: "Água mineral", cents: 300, stockId: "agua" },
];
const METHODS = [
  ...Array(45).fill("dinheiro"), ...Array(30).fill("pix"), ...Array(10).fill("debito"), ...Array(15).fill("credito"),
];
const FEE = { dinheiro: 0, pix: 0, debito: 2.0, credito: 3.5 };

const phoneOf = (i) => `${99}9${String(80000000 + i * 7919).slice(0, 8)}`;

// ---- clientes ----
const mesAtual = String(new Date().getMonth() + 1).padStart(2, "0");
const customers = NAMES.map((name, i) => {
  const points = chance(0.25) ? rnd(100, 320) : rnd(0, 95);
  // primeiros 5 fazem aniversário no mês atual (pra demonstrar a aba)
  const y = rnd(1980, 2005), m = i < 5 ? mesAtual : String(rnd(1, 12)).padStart(2, "0"), d = String(rnd(1, 28)).padStart(2, "0");
  return {
    phone: phoneOf(i), name, points, createdAt: "2026-05-10T12:00:00.000Z",
    birthday: `${y}-${m}-${d}`,
    history: [{ type: "earn", points: Math.max(5, points), ref: "#histórico", at: "2026-05-20T15:00:00.000Z" }],
  };
});

// ---- vendas (orders) ao longo de 30 dias ----
const now = new Date();
const orders = [];
let id = 1042;
for (let dback = 30; dback >= 0; dback--) {
  const day = new Date(now);
  day.setDate(now.getDate() - dback);
  const weekend = day.getDay() === 0 || day.getDay() === 6;
  const n = weekend ? rnd(18, 30) : rnd(10, 20); // fim de semana vende mais
  for (let k = 0; k < n; k++) {
    id++;
    const when = new Date(day);
    when.setHours(rnd(11, 21), rnd(0, 59), rnd(0, 59), 0);
    const isProduto = chance(0.18);
    let items, sub;
    if (isProduto) {
      const p = pick(PRODUTOS);
      items = [{ group: "Produto", name: p.name, qty: 1, paidCents: p.cents, stockId: p.stockId }];
      sub = p.cents;
    } else {
      const s = pick(SIZES);
      const extras = rnd(0, 5) * 200;
      const ac = [...new Set(Array.from({ length: rnd(2, 4) }, () => pick(ACOMP)))].join(", ");
      sub = s.base + extras;
      items = [{ group: "Açaí", name: `${s.label} — ${ac}`, qty: 1, paidCents: sub }];
    }
    const method = pick(METHODS);
    const cardFeeCents = Math.round((sub * FEE[method]) / 100);
    const hasCustomer = chance(0.4);
    const cust = hasCustomer ? pick(customers.slice(0, 30)) : null; // só clientes "ativos"
    orders.push({
      id, display: `#${id}`, createdAt: when.toISOString(),
      customerName: cust ? cust.name : "Balcão", phone: cust ? cust.phone : "",
      mode: "balcao", sizeLabel: "1 item", items,
      subtotalCents: sub, feeCents: 0, totalCents: sub, status: "entregue",
      paymentMethod: method, cardFeeCents,
      pointsAwarded: cust ? Math.floor(sub / 100) : undefined,
    });
  }
}

// ---- clientes SUMIDOS: últimos 8 com compra antiga (45-100 dias atrás) ----
for (let k = 30; k < 38; k++) {
  const cust = customers[k];
  for (let j = 0; j < rnd(1, 3); j++) {
    id++;
    const dback = rnd(45, 100);
    const when = new Date(now); when.setDate(now.getDate() - dback); when.setHours(rnd(11, 21), rnd(0, 59), 0, 0);
    const s = pick(SIZES); const sub = s.base + rnd(0, 4) * 200;
    orders.push({
      id, display: `#${id}`, createdAt: when.toISOString(), customerName: cust.name, phone: cust.phone,
      mode: "balcao", sizeLabel: "1 item", items: [{ group: "Açaí", name: s.label, qty: 1, paidCents: sub }],
      subtotalCents: sub, feeCents: 0, totalCents: sub, status: "entregue", paymentMethod: "dinheiro", cardFeeCents: 0,
      pointsAwarded: Math.floor(sub / 100),
    });
  }
}

// ---- despesas no mês ----
const dt = (dback) => { const x = new Date(now); x.setDate(now.getDate() - dback); return x.toISOString().slice(0, 10); };
const expenses = [
  { description: "Aluguel do ponto", category: "aluguel", amountCents: 150000, date: dt(28) },
  { description: "Salário ajudante", category: "salarios", amountCents: 120000, date: dt(28) },
  { description: "Polpa de açaí (fornecedor)", category: "insumos", amountCents: 48000, date: dt(27) },
  { description: "Polpa de açaí (fornecedor)", category: "insumos", amountCents: 52000, date: dt(20) },
  { description: "Polpa de açaí (fornecedor)", category: "insumos", amountCents: 49000, date: dt(13) },
  { description: "Polpa de açaí (fornecedor)", category: "insumos", amountCents: 51000, date: dt(6) },
  { description: "Granola e complementos", category: "insumos", amountCents: 16500, date: dt(25) },
  { description: "Granola e complementos", category: "insumos", amountCents: 14200, date: dt(11) },
  { description: "Copos, tampas e colheres", category: "embalagens", amountCents: 22000, date: dt(24) },
  { description: "Copos, tampas e colheres", category: "embalagens", amountCents: 18500, date: dt(9) },
  { description: "Conta de energia", category: "utilidades", amountCents: 31000, date: dt(15) },
  { description: "Conta de água", category: "utilidades", amountCents: 9800, date: dt(15) },
  { description: "Impulsionar Instagram", category: "marketing", amountCents: 10000, date: dt(19) },
  { description: "Impulsionar Instagram", category: "marketing", amountCents: 10000, date: dt(5) },
  { description: "Manutenção do freezer", category: "manutencao", amountCents: 18000, date: dt(12) },
].map((e, i) => ({ ...e, id: "e" + (1000 + i), createdAt: e.date + "T10:00:00.000Z" }));

// ---- estoque (seed default com alguns alertas) ----
const stock = [
  { id: "sorvetepote", name: "Sorvete pote 2L (creme)", category: "sorvete", qty: 5, unit: "un", minQty: 3, expiry: "2026-10-01", sellPriceCents: 2500, updatedAt: dt(0), history: [] },
  { id: "picole", name: "Picolé de açaí", category: "picole", qty: 14, unit: "un", minQty: 10, expiry: "2026-09-15", sellPriceCents: 600, updatedAt: dt(0), history: [] },
  { id: "refri", name: "Refrigerante lata", category: "bebida", qty: 22, unit: "un", minQty: 12, expiry: "2027-02-01", sellPriceCents: 600, updatedAt: dt(0), history: [] },
  { id: "agua", name: "Água mineral", category: "bebida", qty: 18, unit: "un", minQty: 12, expiry: "2027-05-01", sellPriceCents: 300, updatedAt: dt(0), history: [] },
  { id: "polpa", name: "Polpa de açaí", category: "polpa", qty: 9, unit: "kg", minQty: 5, expiry: "2026-06-18", updatedAt: dt(0), history: [] },
  { id: "banana", name: "Banana", category: "fruta", qty: 2, unit: "kg", minQty: 3, expiry: "2026-06-13", updatedAt: dt(0), history: [] },
  { id: "granola", name: "Granola", category: "cereal", qty: 4, unit: "kg", minQty: 2, expiry: "2026-09-01", updatedAt: dt(0), history: [] },
  { id: "leitecond", name: "Leite condensado", category: "cobertura", qty: 10, unit: "un", minQty: 4, expiry: "2027-01-10", updatedAt: dt(0), history: [] },
  { id: "ninho", name: "Leite Ninho", category: "adicional", qty: 1.5, unit: "kg", minQty: 1, expiry: "2026-12-01", updatedAt: dt(0), history: [] },
  { id: "copo500", name: "Copo 500ml", category: "embalagem", qty: 180, unit: "un", minQty: 100, updatedAt: dt(0), history: [] },
];

// ---- caixa aberto hoje ----
const cash = [{
  id: 1, openedAt: new Date(new Date().setHours(11, 0, 0, 0)).toISOString(),
  operator: "Vidal", openingFloatCents: 15000, movements: [
    { type: "suprimento", amountCents: 5000, reason: "Reforço de troco", at: new Date(new Date().setHours(14, 0, 0, 0)).toISOString() },
    { type: "sangria", amountCents: 20000, reason: "Depósito no banco", at: new Date(new Date().setHours(17, 0, 0, 0)).toISOString() },
  ], status: "aberto",
}];

// ---- despesas fixas (templates recorrentes) ----
const fixed = [
  { id: "f001", description: "Aluguel do ponto", category: "aluguel", amountCents: 150000 },
  { id: "f002", description: "Salário ajudante", category: "salarios", amountCents: 120000 },
  { id: "f003", description: "Energia elétrica", category: "utilidades", amountCents: 31000 },
  { id: "f004", description: "Internet", category: "utilidades", amountCents: 9990 },
];
write("fixed-expenses.json", fixed);

write("customers.json", customers);
write("orders.json", orders.sort((a, b) => a.id - b.id));
write("expenses.json", expenses);
write("stock.json", stock);
write("cash.json", cash);

const fat = orders.reduce((s, o) => s + o.totalCents, 0);
console.log(`OK · ${orders.length} vendas · faturamento R$ ${(fat / 100).toFixed(2)} · ${expenses.length} despesas · ${customers.length} clientes`);
