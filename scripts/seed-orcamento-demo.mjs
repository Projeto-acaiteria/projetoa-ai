// Semeia UM orçamento de demonstração no tenant Starteq (pra mostrar o documento A4 no ar).
// Excluível pela tela /admin/orcamentos. Uso: node scripts/seed-orcamento-demo.mjs
import { readFileSync } from "node:fs";
import pg from "pg";

const STARTEQ = "c1251296-9bee-40ed-a98e-472614c61bf8";
const code = "ORDEMO01";
const budget = {
  id: "bdemo0001",
  code,
  customerName: "Cliente Demonstração",
  customerPhone: "63992528619",
  cpf: null,
  items: [
    { kind: "produto", name: "Placa de vídeo RTX 4060 8GB", qty: 1, unitCents: 189900, discountCents: 0 },
    { kind: "produto", name: "Memória DDR5 16GB 6000MHz", qty: 2, unitCents: 32900, discountCents: 5000 },
    { kind: "servico", name: "Montagem, instalação e testes", detail: "Inclui organização de cabos e stress test", qty: 1, unitCents: 15000, discountCents: 0 },
  ],
  freteCents: 0,
  outrosCents: 0,
  discountCents: 10000,
  validadeAt: "2026-07-27",
  observacao: "Orçamento de demonstração. Preços sujeitos a disponibilidade de estoque.",
  status: "pendente",
  createdAt: new Date().toISOString(),
  approvedAt: null,
};

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = (env.match(/DATABASE_URL=(.+)/) || [])[1]?.trim();
const m = url.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^:/]+):(\d+)\/(.+)$/);
const [, user, password, host, port, database] = m;
const client = new pg.Client({ user, password, host, port: +port, database, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query(
    `INSERT INTO budgets (id, store_id, data) VALUES ($1,$2,$3)
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
    [budget.id, STARTEQ, JSON.stringify(budget)],
  );
  const chk = await client.query(`SELECT data->>'code' AS code FROM budgets WHERE id=$1`, [budget.id]);
  console.log("orçamento demo:", chk.rows[0]?.code ? "OK ✓" : "FALTOU ✗");
  console.log("URL do documento A4: https://comandapro.net.br/doc/" + code);
} finally {
  await client.end();
}
