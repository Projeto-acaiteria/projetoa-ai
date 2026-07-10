// Reorganiza destilados do Medellín em duas seções: "Doses" e "Garrafas".
// Move produtos por size_label; desativa Whisky/Gin/Tequila/Licores (ficam vazias).
// Dry-run por padrão; --commit executa. Uso: node scripts/reorg-doses-medellin.mjs [--commit]
import { readFileSync } from "node:fs";
import pg from "pg";
const COMMIT = process.argv.includes("--commit");
const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = (env.match(/DATABASE_URL=(.+)/) || [])[1]?.trim();
const m = url.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^:/]+):(\d+)\/(.+)$/);
const [, u, pw, h, po, db] = m;
const c = new pg.Client({ user: u, password: pw, host: h, port: +po, database: db, ssl: { rejectUnauthorized: false } });
await c.connect();
const q = async (s, p = []) => (await c.query(s, p)).rows;
const TIPO_ORDER = { Whisky: 0, Gin: 1, Tequila: 2, Licores: 3 }; // agrupa por tipo dentro de Doses/Garrafas
try {
  const SID = (await q("select id from stores where slug='medellin'"))[0].id;
  const destCats = await q("select id, name, sort from menu_categories where store_id=$1 and name in ('Whisky','Gin','Tequila','Licores')", [SID]);
  const destIds = destCats.map((r) => r.id);
  const baseSort = Math.min(...destCats.map((r) => Number(r.sort))); // Doses/Garrafas entram onde os destilados estavam
  const prods = await q(
    "select p.id, p.name, p.size_label, mc.name as cat from menu_products p join menu_categories mc on mc.id=p.category_id where p.store_id=$1 and mc.id = any($2) and p.size_label in ('dose','garrafa') order by p.size_label, p.name",
    [SID, destIds]
  );
  const doses = prods.filter((p) => p.size_label === "dose");
  const garrafas = prods.filter((p) => p.size_label === "garrafa");
  const sortKey = (p) => (TIPO_ORDER[p.cat] ?? 9) * 1000; // ordena por tipo; nome desempata via ordem já vinda

  console.log(`Medellín ${SID}`);
  console.log(`Destilados: ${destCats.map((r) => r.name).join(", ")} (sort base ${baseSort})`);
  console.log(`→ DOSES: ${doses.length} · GARRAFAS: ${garrafas.length}`);
  if (!COMMIT) { console.log("\n🟡 DRY-RUN. Rode com --commit."); await c.end(); process.exit(0); }

  const mkCat = async (name, sort) => {
    const ex = (await q("select id from menu_categories where store_id=$1 and name=$2", [SID, name]))[0];
    if (ex) { await q("update menu_categories set station='bar', active=true, sort=$3 where id=$1 and store_id=$2", [ex.id, SID, sort]); return ex.id; }
    return (await q("insert into menu_categories (store_id, name, station, sort, active, earns_points, no_prep) values ($1,$2,'bar',$3,true,true,false) returning id", [SID, name, sort]))[0].id;
  };
  const dosesId = await mkCat("Doses", baseSort);
  const garrafasId = await mkCat("Garrafas", baseSort + 1);

  let n = 0;
  for (const [i, p] of doses.entries()) { await q("update menu_products set category_id=$1, sort=$2 where id=$3 and store_id=$4", [dosesId, sortKey(p) + i, p.id, SID]); n++; }
  for (const [i, p] of garrafas.entries()) { await q("update menu_products set category_id=$1, sort=$2 where id=$3 and store_id=$4", [garrafasId, sortKey(p) + i, p.id, SID]); n++; }
  // desativa as categorias antigas (vazias agora)
  await q("update menu_categories set active=false where store_id=$1 and id = any($2)", [SID, destIds]);
  console.log(`\n✅ ${n} produtos movidos. Doses=${dosesId} Garrafas=${garrafasId}. Whisky/Gin/Tequila/Licores desativadas.`);
} finally { await c.end(); }
