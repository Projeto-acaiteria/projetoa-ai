// Preenche os DADOS DA LOJA Starteq nas configurações (cabeçalho do documento A4 + cupom 80mm).
// Dados reais confirmados no documento do GestãoClick. Uso: node scripts/set-starteq-dados.mjs
import { readFileSync } from "node:fs";
import pg from "pg";

const STARTEQ = "c1251296-9bee-40ed-a98e-472614c61bf8";
const DADOS = {
  name: "Starteq",
  cnpj: "28.623.696/0001-21",
  endereco: "Quadra ACSE 1 Rua SE 5, 07 - Plano Diretor Sul, Palmas/TO - CEP 77020-018",
  whatsapp: "6399252528619".replace(/\D/g, "").slice(0, 11) || "63992528619",
  email: "starteqpalmas@gmail.com",
  site: "starteqpalmas.com",
  responsavel: "Junior Falcão",
};
// número certo: (63) 99252-8619
DADOS.whatsapp = "63992528619";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = (env.match(/DATABASE_URL=(.+)/) || [])[1]?.trim();
const m = url.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^:/]+):(\d+)\/(.+)$/);
const [, user, password, host, port, database] = m;
const client = new pg.Client({ user, password, host, port: +port, database, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  const cur = await client.query(`SELECT data FROM app_settings WHERE store_id=$1`, [STARTEQ]);
  const data = cur.rows[0]?.data ?? {};
  data.store = { ...(data.store ?? {}), ...DADOS };
  await client.query(
    `INSERT INTO app_settings (store_id, data) VALUES ($1,$2)
     ON CONFLICT (store_id) DO UPDATE SET data = EXCLUDED.data`,
    [STARTEQ, JSON.stringify(data)],
  );
  const chk = await client.query(`SELECT data->'store'->>'cnpj' AS cnpj, data->'store'->>'endereco' AS end, data->'store'->>'responsavel' AS resp FROM app_settings WHERE store_id=$1`, [STARTEQ]);
  console.log("gravado:", chk.rows[0]);
} finally {
  await client.end();
}
