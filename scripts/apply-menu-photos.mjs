// Aplica fotos no cardápio do Medellín a partir de um JSON [{category,name,url}].
// Valida cada URL (HTTP 200) antes de gravar; casa por categoria+nome; adiciona dimensionamento.
// Uso: node scripts/apply-menu-photos.mjs caminho/para/fotos.json [--commit]
import { readFileSync } from "node:fs";
import pg from "pg";
const COMMIT = process.argv.includes("--commit");
const jsonPath = process.argv[2];
if (!jsonPath) { console.error("Passe o caminho do JSON. Ex: node scripts/apply-menu-photos.mjs fotos.json --commit"); process.exit(1); }
const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = (env.match(/DATABASE_URL=(.+)/) || [])[1]?.trim();
const mm = url.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^:/]+):(\d+)\/(.+)$/);
const [, u, pw, h, po, db] = mm;
const SIZE = "?w=400&h=400&fit=crop&q=80&auto=format";
const norm = (s) => s.normalize("NFC").trim();

const items = JSON.parse(readFileSync(jsonPath, "utf8"));
console.log(`JSON: ${items.length} itens`);

// 1) valida URLs (dedup por URL base pra não checar 2x)
const uniqUrls = [...new Set(items.map((i) => i.url.split("?")[0]))];
console.log(`Validando ${uniqUrls.length} URLs distintas...`);
const bad = new Set();
await Promise.all(uniqUrls.map(async (base) => {
  try {
    const r = await fetch(base + SIZE, { method: "HEAD" });
    if (!r.ok) bad.add(base);
  } catch { bad.add(base); }
}));
console.log(bad.size ? `⚠️  ${bad.size} URL(s) inválida(s):\n  ${[...bad].join("\n  ")}` : "✅ todas as URLs respondem 200");

const c = new pg.Client({ user: u, password: pw, host: h, port: +po, database: db, ssl: { rejectUnauthorized: false } });
await c.connect();
try {
  const SID = (await c.query("select id from stores where slug='medellin'")).rows[0].id;
  let ok = 0, skipNoUrl = 0, notFound = 0;
  const misses = [];
  for (const it of items) {
    const base = it.url.split("?")[0];
    if (bad.has(base)) { skipNoUrl++; continue; }
    const img = base + SIZE;
    if (!COMMIT) { ok++; continue; }
    const res = await c.query(
      `update menu_products p set img=$1
       from menu_categories mc
       where p.category_id=mc.id and p.store_id=$2 and mc.name=$3 and p.name=$4 and (p.img is null or p.img='')`,
      [img, SID, norm(it.category), norm(it.name)]
    );
    if (res.rowCount > 0) ok += res.rowCount; else { notFound++; misses.push(`${it.category} / ${it.name}`); }
  }
  console.log(COMMIT ? `\n✅ COMMIT: ${ok} produto(s) atualizado(s). sem match: ${notFound}. url inválida: ${skipNoUrl}` : `\n🟡 DRY-RUN: ${ok} prontos, ${skipNoUrl} com url inválida. Rode com --commit.`);
  if (misses.length) console.log("  sem match no banco:\n  " + misses.join("\n  "));
  const rest = (await c.query("select count(*) n from menu_products where store_id=$1 and (img is null or img='')", [SID])).rows[0].n;
  console.log(`  produtos ainda sem foto: ${rest}`);
} finally { await c.end(); }
