// Seed de uma loja RESTAURANTE demo (modelo grid, foto grande estilo iFood) pra ver o TemplateGrid.
// Reusa o MESMO schema do bar (menu_categories + menu_products) — grid é só layout. Fotos do
// banco curado (image-bank). station: Pratos/Lanches→cozinha, Bebidas→bar (motor de roteamento serve igual).
// Uso: node scripts/seed-grid-demo.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const get = (k) => (env.match(new RegExp("^" + k + "=(.+)", "m")) || [])[1]?.trim().replace(/^["']|["']$/g, "");
const admin = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

const SLUG = "restaurante-demo", EMAIL = "restaurante@comandapro.app", PASSWORD = "restaurante2026", NAME = "Cantina do Chef";
const u = (id) => `https://images.unsplash.com/photo-${id}?w=600&h=600&fit=crop&q=80`;

let userId;
const { data: cu, error: ce } = await admin.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true });
if (ce) {
  if (/already|registered|exists/i.test(ce.message)) { const { data: list } = await admin.auth.admin.listUsers(); userId = list.users.find((x) => x.email === EMAIL)?.id; }
  else { console.error("createUser:", ce.message); process.exit(1); }
} else userId = cu.user.id;

let storeId;
const { data: ex } = await admin.from("stores").select("id").eq("slug", SLUG).maybeSingle();
if (ex) { storeId = ex.id; await admin.from("stores").update({ name: NAME, owner_id: userId }).eq("id", storeId); }
else { const { data: st, error: se } = await admin.from("stores").insert({ slug: SLUG, name: NAME, owner_id: userId }).select("id").single(); if (se) { console.error("store:", se.message); process.exit(1); } storeId = st.id; }
console.log("store:", storeId, "/", SLUG);

await admin.from("store_config").upsert({
  store_id: storeId, business_type: "restaurante", menu_template: "grid",
  sells_by_weight: false, has_balcao: false, has_tables: true, has_delivery: true,
  cover_enabled: false, stock_dose: false, has_stations: true, loyalty_enabled: false,
}, { onConflict: "store_id" });

const horario = Array.from({ length: 7 }, () => ({ open: "11:00", close: "23:00", closed: false }));
await admin.from("app_settings").upsert({ store_id: storeId, data: { store: { name: NAME, tagline: "Cozinha de verdade, do nosso jeito", whatsapp: "5599810420160", hours: horario } } }, { onConflict: "store_id" });

const { data: sub } = await admin.from("subscriptions").select("store_id").eq("store_id", storeId).maybeSingle();
const subRow = { store_id: storeId, status: "active", permanent_courtesy: true };
await (sub ? admin.from("subscriptions").update(subRow).eq("store_id", storeId) : admin.from("subscriptions").insert(subRow));

await admin.from("menu_categories").delete().eq("store_id", storeId);

const CARDAPIO = [
  { name: "Pratos principais", station: "cozinha", sort: 0, description: "Servidos quentinhos, pra dividir ou não", produtos: [
    { name: "Picanha na chapa", size_label: "400g", price_cents: 8900, img: "1555939594-58d7cb561ad1" },
    { name: "Costela no bafo", size_label: "500g", price_cents: 7500, img: "1588168333986-5078d3ae3976" },
    { name: "Filé ao molho", size_label: "350g", price_cents: 6900, img: "1633436375795-12b3b339712f" },
    { name: "Frango grelhado", size_label: "300g", price_cents: 4900, img: "1603360946369-dc9bb6258143" },
  ] },
  { name: "Lanches", station: "cozinha", sort: 1, description: "Artesanais, no pão brioche", produtos: [
    { name: "Burger da casa", size_label: "180g", price_cents: 3900, img: "1568901346375-23c9450c58cd" },
    { name: "Cheddar duplo", size_label: "2x 120g", price_cents: 4500, img: "1572802419224-296b0aeee0d9" },
    { name: "Bacon crocante", size_label: "180g", price_cents: 4200, img: "1571091718767-18b5b1457add" },
  ] },
  { name: "Bebidas", station: "bar", sort: 2, description: "Geladas", produtos: [
    { name: "Chopp artesanal", size_label: "300ml", price_cents: 1400, img: "1571613316887-6f8d5cbf7ef7" },
    { name: "Caipirinha", size_label: "dose", price_cents: 1800, img: "1609951651556-5334e2706168" },
    { name: "Refrigerante", size_label: "lata", price_cents: 700, img: "1551024709-8f23befc6f87" },
  ] },
];

for (const cat of CARDAPIO) {
  const { data: c, error: ce2 } = await admin.from("menu_categories").insert({ store_id: storeId, name: cat.name, station: cat.station, description: cat.description, sort: cat.sort, active: true }).select("id").single();
  if (ce2) { console.error("cat:", ce2.message); process.exit(1); }
  const rows = cat.produtos.map((p, i) => ({ store_id: storeId, category_id: c.id, name: p.name, price_cents: p.price_cents, size_label: p.size_label, img: u(p.img), sort: i, active: true }));
  const { error: pe } = await admin.from("menu_products").insert(rows);
  if (pe) { console.error("prod:", pe.message); process.exit(1); }
  console.log(`  ${cat.name} (${cat.station}): ${rows.length} produtos`);
}
console.log("\n✓ grid demo pronto → /" + SLUG + "  · login:", EMAIL, "/", PASSWORD);
