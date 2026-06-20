// Seed de SUSHITERIA demo — categorias ricas do nicho (Combinados/Hot Rolls/Temaki/Niguiri&Sashimi/
// Entradas/Bebidas). Combinados e temakis usam o MOTOR (grupo "Tamanho", escolha 1, soma). Reusa tudo.
// Uso: node scripts/seed-sushi-demo.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const get = (k) => (env.match(new RegExp("^" + k + "=(.+)", "m")) || [])[1]?.trim().replace(/^["']|["']$/g, "");
const admin = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const u = (id) => `https://images.unsplash.com/photo-${id}?w=600&h=600&fit=crop&q=80`;

const SLUG = "sushi-demo", EMAIL = "sushi@comandapro.app", PASSWORD = "sushi2026", NAME = "Sushi Ya";

let userId;
const { data: cu, error: ce } = await admin.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true });
if (ce) { if (/already|registered|exists/i.test(ce.message)) { const { data: l } = await admin.auth.admin.listUsers(); userId = l.users.find((x) => x.email === EMAIL)?.id; } else { console.error(ce.message); process.exit(1); } } else userId = cu.user.id;

let storeId;
const { data: ex } = await admin.from("stores").select("id").eq("slug", SLUG).maybeSingle();
if (ex) { storeId = ex.id; await admin.from("stores").update({ name: NAME, owner_id: userId }).eq("id", storeId); }
else { const { data: st, error: se } = await admin.from("stores").insert({ slug: SLUG, name: NAME, owner_id: userId }).select("id").single(); if (se) { console.error(se.message); process.exit(1); } storeId = st.id; }

await admin.from("store_config").upsert({ store_id: storeId, business_type: "restaurante", menu_template: "grid", sells_by_weight: false, has_balcao: false, has_tables: true, has_delivery: true, cover_enabled: false, stock_dose: false, has_stations: true, loyalty_enabled: false }, { onConflict: "store_id" });
await admin.from("app_settings").upsert({ store_id: storeId, data: { store: { name: NAME, tagline: "Sushi fresquinho, do jeito que você monta", whatsapp: "5599810420160", hours: Array.from({ length: 7 }, () => ({ open: "18:00", close: "23:30", closed: false })) } } }, { onConflict: "store_id" });
const { data: sub } = await admin.from("subscriptions").select("store_id").eq("store_id", storeId).maybeSingle();
const subRow = { store_id: storeId, status: "active", permanent_courtesy: true };
await (sub ? admin.from("subscriptions").update(subRow).eq("store_id", storeId) : admin.from("subscriptions").insert(subRow));

await admin.from("menu_categories").delete().eq("store_id", storeId);

const CATS = [
  { name: "Combinados", station: "cozinha", desc: "Escolha o tamanho — pra dividir", prods: [
    { name: "Combinado Salmão", img: "1553621042-f6e147245754", sizes: [["20 peças", 5000], ["30 peças", 7000], ["40 peças", 9000]] },
    { name: "Combinado Especial", img: "1611143669185-af224c5e3252", sizes: [["24 peças", 6500], ["36 peças", 9000], ["48 peças", 12000]] },
    { name: "Combinado Veggie", img: "1617196034796-73dfa7b1fd56", sizes: [["16 peças", 4500], ["24 peças", 6000]] },
  ] },
  { name: "Hot Rolls", station: "cozinha", desc: "Empanados e quentinhos", prods: [
    { name: "Hot Philadelphia (8un)", price: 2800, img: "1587334207810-4915c4e40c67", adds: [["Cream cheese extra", 500], ["Geleia de pimenta", 400]] },
    { name: "Hot Salmão (8un)", price: 3000, img: "1591632288574-a387f820a1ca" },
    { name: "Hot Califórnia (8un)", price: 2600, img: "1571987530791-58e3e7744d99" },
  ] },
  { name: "Temaki", station: "cozinha", desc: "Cone de alga na hora", prods: [
    { name: "Temaki Salmão", img: "1601059286024-61032e83b203", sizes: [["Broto", 1800], ["Tradicional", 2800], ["Gigante", 3800]] },
    { name: "Temaki Filadélfia", img: "1610722839611-f7837e1dd39f", sizes: [["Broto", 1800], ["Tradicional", 2800]] },
  ] },
  { name: "Niguiri & Sashimi", station: "cozinha", desc: "Cortes do sushiman", prods: [
    { name: "Niguiri Salmão (2un)", price: 1600, img: "1617196034796-73dfa7b1fd56" },
    { name: "Sashimi Salmão (10 fatias)", price: 4500, img: "1553621042-f6e147245754" },
  ] },
  { name: "Entradas", station: "cozinha", desc: "Pra começar", prods: [
    { name: "Guioza (6un)", price: 2500 }, { name: "Sunomono", price: 1800 }, { name: "Sopa missô", price: 1200 },
  ] },
  { name: "Bebidas", station: "bar", desc: "", prods: [
    { name: "Sakê (dose)", price: 1500 }, { name: "Refrigerante", price: 700 }, { name: "Água", price: 400 }, { name: "Chá gelado", price: 900 },
  ] },
];

let csort = 0;
for (const cat of CATS) {
  const { data: c } = await admin.from("menu_categories").insert({ store_id: storeId, name: cat.name, station: cat.station, description: cat.desc || null, sort: csort++, active: true }).select("id").single();
  let psort = 0;
  for (const p of cat.prods) {
    const { data: prod } = await admin.from("menu_products").insert({ store_id: storeId, category_id: c.id, name: p.name, price_cents: p.price ?? 0, size_label: null, img: p.img ? u(p.img) : null, sort: psort++, active: true }).select("id").single();
    if (p.sizes) {
      const { data: g } = await admin.from("menu_modifier_groups").insert({ store_id: storeId, product_id: prod.id, title: "Tamanho", min_select: 1, max_select: 1, free_up_to: 0, price_mode: "sum", sort: 0 }).select("id").single();
      let s = 0;
      for (const [n, pr] of p.sizes) await admin.from("menu_modifiers").insert({ store_id: storeId, group_id: g.id, name: n, price_cents: pr, sort: s++ });
    }
    if (p.adds) {
      const { data: g } = await admin.from("menu_modifier_groups").insert({ store_id: storeId, product_id: prod.id, title: "Adicionais", min_select: 0, max_select: 0, free_up_to: 0, price_mode: "sum", sort: 1 }).select("id").single();
      let s = 0;
      for (const [n, pr] of p.adds) await admin.from("menu_modifiers").insert({ store_id: storeId, group_id: g.id, name: n, price_cents: pr, sort: s++ });
    }
  }
  console.log(`  ${cat.name} (${cat.station}): ${cat.prods.length} itens`);
}
console.log("\n✓ sushi-demo pronto → /" + SLUG + "  · login:", EMAIL, "/", PASSWORD);
