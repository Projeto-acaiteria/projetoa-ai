// Importa a base de CLIENTES exportada do GestãoClick para o ComandaPRO (tenant Starteq).
// Alimenta a tabela service_customers (chave = CPF só dígitos) → a recepção acha o cliente pelo CPF.
//
// Uso:
//   node scripts/import-clientes-starteq.mjs "C:\caminho\clientes.csv"          (grava)
//   node scripts/import-clientes-starteq.mjs "C:\caminho\clientes.csv" --dry     (só mostra o que faria)
//   node scripts/import-clientes-starteq.mjs "C:\caminho\clientes.csv" --latin1  (CSV do Excel BR)
//
// Idempotente: ON CONFLICT (store_id, cpf) atualiza. Aceita ; ou , como separador (autodetecta).
import { readFileSync } from "node:fs";
import pg from "pg";

const STARTEQ = "c1251296-9bee-40ed-a98e-472614c61bf8";
const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const DRY = args.includes("--dry");
const LATIN1 = args.includes("--latin1");
if (!file) {
  console.error("Informe o caminho do CSV. Ex: node scripts/import-clientes-starteq.mjs clientes.csv --dry");
  process.exit(1);
}

const onlyDigits = (s) => (s || "").replace(/\D/g, "");
const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

// ── parser de CSV mínimo (aspas + separador ; ou ,) ──────────────────────────
function parseCSV(text) {
  const delim = (text.split("\n")[0].match(/;/g)?.length ?? 0) >= (text.split("\n")[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows = [];
  let row = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQ = false;
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === delim) { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c === "\r") { /* ignora */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}

// mapeia o índice da coluna por nomes possíveis do cabeçalho
function findCol(headers, names) {
  for (let i = 0; i < headers.length; i++) if (names.includes(norm(headers[i]))) return i;
  // match parcial (ex.: "nome/razão social")
  for (let i = 0; i < headers.length; i++) if (names.some((n) => norm(headers[i]).includes(n))) return i;
  return -1;
}

const raw = readFileSync(file, LATIN1 ? "latin1" : "utf8");
const rows = parseCSV(raw);
if (rows.length < 2) { console.error("CSV vazio ou sem linhas de dados."); process.exit(1); }
const headers = rows[0];
const col = {
  name: findCol(headers, ["nome", "cliente", "razao social", "nome/razao social", "nome razao social"]),
  cpf: findCol(headers, ["cpf", "cnpj", "cpf/cnpj", "cnpj/cpf", "documento", "cpf cnpj"]),
  phone: findCol(headers, ["telefone", "celular", "fone", "whatsapp", "telefone1", "telefone 1", "contato"]),
  email: findCol(headers, ["email", "e-mail"]),
  address: findCol(headers, ["endereco", "logradouro", "endereco completo"]),
};
console.log("Cabeçalho detectado:", headers.join(" | "));
console.log("Colunas mapeadas:", Object.fromEntries(Object.entries(col).map(([k, v]) => [k, v < 0 ? "(não achou)" : headers[v]])));
if (col.cpf < 0) { console.error("\n✗ Não achei a coluna de CPF/CNPJ no cabeçalho. Ajuste o CSV ou me diga o nome da coluna."); process.exit(1); }

const nowIso = new Date().toISOString();
const recs = [];
let semCpf = 0;
for (const r of rows.slice(1)) {
  const cpf = onlyDigits(r[col.cpf]);
  if (cpf.length < 3) { semCpf++; continue; }
  recs.push({
    cpf,
    name: (col.name >= 0 ? r[col.name] : "").trim() || "Cliente",
    phone: (col.phone >= 0 ? r[col.phone] : "").trim(),
    email: col.email >= 0 ? r[col.email]?.trim() || undefined : undefined,
    address: col.address >= 0 ? r[col.address]?.trim() || undefined : undefined,
    createdAt: nowIso,
  });
}
// dedup por CPF (fica o último)
const byCpf = new Map(recs.map((c) => [c.cpf, c]));
const finais = [...byCpf.values()];
console.log(`\nLinhas de dados: ${rows.length - 1} · válidas (com CPF): ${finais.length} · sem CPF (puladas): ${semCpf}`);
console.log("Amostra:", finais.slice(0, 3).map((c) => `${c.name} [${c.cpf}]${c.phone ? " " + c.phone : ""}`).join(" | ") || "—");

if (DRY) { console.log("\n--dry: nada foi gravado. Rode sem --dry pra importar."); process.exit(0); }

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = (env.match(/DATABASE_URL=(.+)/) || [])[1]?.trim();
const m = url.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^:/]+):(\d+)\/(.+)$/);
const [, user, password, host, port, database] = m;
const client = new pg.Client({ user, password, host, port: +port, database, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  let ok = 0;
  for (const c of finais) {
    await client.query(
      `INSERT INTO service_customers (store_id, cpf, data) VALUES ($1,$2,$3)
       ON CONFLICT (store_id, cpf) DO UPDATE SET data = EXCLUDED.data`,
      [STARTEQ, c.cpf, JSON.stringify(c)],
    );
    ok++;
  }
  const cnt = await client.query(`SELECT count(*)::int AS n FROM service_customers WHERE store_id=$1`, [STARTEQ]);
  console.log(`\n✓ Importados/atualizados: ${ok}. Total de clientes no Starteq agora: ${cnt.rows[0].n}`);
} finally {
  await client.end();
}
