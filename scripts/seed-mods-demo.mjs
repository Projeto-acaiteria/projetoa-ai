// Seed de modificadores (monta-seu-lanche) nos burgers do restaurante-demo, pra demonstrar a
// montagem guiada. Idempotente (limpa os grupos do produto antes). Uso: node scripts/seed-mods-demo.mjs
import { readFileSync } from "node:fs";
import pg from "pg";
const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = (env.match(/DATABASE_URL=(.+)/) || [])[1].trim();
const mm = url.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^:/]+):(\d+)\/(.+)$/);
const [, user, password, host, port, database] = mm;
const c = new pg.Client({ user, password, host, port: +port, database, ssl: { rejectUnauthorized: false } });
await c.connect();
try {
  const { rows: [st] } = await c.query("select id from stores where slug='restaurante-demo'");
  const S = st.id;
  const burgers = ["Burger da casa", "Cheddar duplo", "Bacon crocante"];
  const GRUPOS = [
    { title: "Ponto da carne", min: 1, max: 1, free: 0, opts: [["Ao ponto", 0], ["Bem passada", 0], ["Mal passada", 0]] },
    { title: "Adicionais", min: 0, max: 5, free: 0, opts: [["Bacon", 500], ["Cheddar extra", 400], ["Ovo", 300], ["Cebola caramelizada", 350]] },
    { title: "Remover", min: 0, max: 0, free: 0, opts: [["Sem alface", 0], ["Sem tomate", 0], ["Sem cebola", 0]] },
  ];
  for (const name of burgers) {
    const { rows: [p] } = await c.query("select id from menu_products where store_id=$1 and name=$2", [S, name]);
    if (!p) { console.log("nao achou:", name); continue; }
    await c.query("delete from menu_modifier_groups where store_id=$1 and product_id=$2", [S, p.id]);
    let gi = 0;
    for (const g of GRUPOS) {
      const { rows: [grp] } = await c.query(
        "insert into menu_modifier_groups (store_id,product_id,title,min_select,max_select,free_up_to,sort) values ($1,$2,$3,$4,$5,$6,$7) returning id",
        [S, p.id, g.title, g.min, g.max, g.free, gi++]
      );
      let oi = 0;
      for (const [oname, price] of g.opts)
        await c.query("insert into menu_modifiers (store_id,group_id,name,price_cents,sort) values ($1,$2,$3,$4,$5)", [S, grp.id, oname, price, oi++]);
    }
    console.log(`  ${name}: 3 grupos (Ponto/Adicionais/Remover)`);
  }
  console.log("\n✓ monta-seu-lanche seedado nos burgers do restaurante-demo");
} finally {
  await c.end();
}
