// Seed de PIZZA meio-a-meio no restaurante-demo + teste do cálculo (price_mode=highest).
// Pizza base 0 + grupo "Sabores" (escolhe até 2, paga o mais caro) + grupo "Borda" (soma).
// Uso: node scripts/seed-pizza-demo.mjs
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
  // limpa pizza demo anterior
  await c.query("delete from menu_categories where store_id=$1 and name='Pizzas'", [S]);
  const { rows: [cat] } = await c.query("insert into menu_categories (store_id,name,station,description,sort,active) values ($1,'Pizzas','cozinha','Escolha até 2 sabores — paga o mais caro',3,true) returning id", [S]);
  const { rows: [pz] } = await c.query("insert into menu_products (store_id,category_id,name,price_cents,size_label,sort,active) values ($1,$2,'Pizza Grande','0','8 fatias',0,true) returning id", [S, cat.id]);

  // grupo Sabores (meio-a-meio): min1 max2 highest
  const { rows: [gs] } = await c.query("insert into menu_modifier_groups (store_id,product_id,title,min_select,max_select,free_up_to,price_mode,sort) values ($1,$2,'Sabores',1,2,0,'highest',0) returning id", [S, pz.id]);
  const sabores = [["Calabresa", 4000], ["Marguerita", 3500], ["Portuguesa", 4500], ["Frango c/ catupiry", 4200], ["Quatro queijos", 4800]];
  const sIds = {};
  let i = 0;
  for (const [n, p] of sabores) { const { rows: [m] } = await c.query("insert into menu_modifiers (store_id,group_id,name,price_cents,sort) values ($1,$2,$3,$4,$5) returning id", [S, gs.id, n, p, i++]); sIds[n] = m.id; }
  // grupo Borda (soma)
  const { rows: [gb] } = await c.query("insert into menu_modifier_groups (store_id,product_id,title,min_select,max_select,free_up_to,price_mode,sort) values ($1,$2,'Borda recheada',0,1,0,'sum',1) returning id", [S, pz.id]);
  for (const [n, p] of [["Sem borda", 0], ["Catupiry", 800], ["Cheddar", 800]]) await c.query("insert into menu_modifiers (store_id,group_id,name,price_cents,sort) values ($1,$2,$3,$4,0)", [S, gb.id, n, p]);
  console.log("✓ pizza seedada (Calabresa 40, Marguerita 35, Portuguesa 45, Frango 42, 4queijos 48)");

  // TESTE: meio-a-meio Calabresa(40) + Portuguesa(45) → deve pagar 45 (o maior)
  const body = { slug: "restaurante-demo", tableNumber: 30, items: [{ productId: pz.id, qty: 1, modifierIds: [sIds["Calabresa"], sIds["Portuguesa"]] }], note: "" };
  let res, t = 0;
  do { res = await fetch("http://localhost:3001/api/mesa-pedido", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); if (res.status === 500) { await new Promise((r) => setTimeout(r, 3000)); t++; } } while (res.status === 500 && t < 4);
  console.log("POST:", res.status);
  const { rows: it } = await c.query("select i.name, i.unit_price_cents, i.mods from tab_order_items i join tab_orders o on o.id=i.tab_order_id join tabs t on t.id=o.tab_id where t.store_id=$1 and t.label='Mesa 30'", [S]);
  console.log("MEIO-A-MEIO gravado:", JSON.stringify(it));
  console.log("esperado: unit_price_cents=4500 (paga Portuguesa 45, a mais cara), mods espelham os 2 sabores");
  // limpa só o tab de teste (mantém a pizza de demo)
  await c.query("delete from tab_order_items where tab_order_id in (select o.id from tab_orders o join tabs t on t.id=o.tab_id where t.store_id=$1 and t.label='Mesa 30')", [S]);
  await c.query("delete from tab_orders where tab_id in (select id from tabs where store_id=$1 and label='Mesa 30')", [S]);
  await c.query("delete from tabs where store_id=$1 and label='Mesa 30'", [S]);
  console.log("✓ tab de teste limpo (pizza permanece de demo)");
} finally {
  await c.end();
}
