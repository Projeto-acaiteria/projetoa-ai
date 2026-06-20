// Seed idempotente de uma loja BAR demo pra ver o TemplateBar no ar.
// Cria/reusa user + store (slug bar-demo) + store_config(menu_template=bar, has_stations) +
// subscription cortesia (não expira) + cardápio com 2 estações (Petiscos→cozinha, Bebidas→bar).
// Uso: node scripts/seed-bar-demo.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const get = (k) => (env.match(new RegExp("^" + k + "=(.+)", "m")) || [])[1]?.trim().replace(/^["']|["']$/g, "");
const admin = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

const SLUG = "bar-demo", EMAIL = "bar@comandapro.app", PASSWORD = "bar2026", NAME = "Boteco Demo";

// 1. user owner (reusa se já existe)
let userId;
const { data: cu, error: ce } = await admin.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true });
if (ce) {
  if (/already|registered|exists/i.test(ce.message)) {
    const { data: list } = await admin.auth.admin.listUsers();
    userId = list.users.find((u) => u.email === EMAIL)?.id;
  } else { console.error("createUser:", ce.message); process.exit(1); }
} else userId = cu.user.id;
console.log("owner:", userId);

// 2. store (reusa por slug)
let storeId;
const { data: ex } = await admin.from("stores").select("id").eq("slug", SLUG).maybeSingle();
if (ex) {
  storeId = ex.id;
  await admin.from("stores").update({ name: NAME, owner_id: userId }).eq("id", storeId);
} else {
  const { data: st, error: se } = await admin.from("stores").insert({ slug: SLUG, name: NAME, owner_id: userId }).select("id").single();
  if (se) { console.error("store:", se.message); process.exit(1); }
  storeId = st.id;
}
console.log("store:", storeId, "/", SLUG);

// 3. store_config (upsert) — modelo bar, com estações
const { error: cfgE } = await admin.from("store_config").upsert({
  store_id: storeId, business_type: "bar", menu_template: "bar",
  sells_by_weight: false, has_balcao: true, has_tables: true, has_delivery: false,
  cover_enabled: true, stock_dose: true, has_stations: true, loyalty_enabled: false,
}, { onConflict: "store_id" });
if (cfgE) { console.error("config:", cfgE.message); process.exit(1); }

// 3b. app_settings (nome/tagline/horário reais da loja — senão cai no DEFAULT açaí)
const horario = Array.from({ length: 7 }, () => ({ open: "17:00", close: "23:59", closed: false }));
await admin.from("app_settings").upsert({
  store_id: storeId,
  data: { store: { name: NAME, tagline: "Petiscos na brasa e cerveja trincando", whatsapp: "5599810420160", hours: horario } },
}, { onConflict: "store_id" });

// 4. subscription cortesia (não expira — demo). permanent_courtesy é COLUNA boolean (isenta o
// gate); o status fica 'active'. NÃO usar status='permanent_courtesy' (não existe no enum).
const { data: sub } = await admin.from("subscriptions").select("store_id").eq("store_id", storeId).maybeSingle();
const subRow = { store_id: storeId, status: "active", permanent_courtesy: true };
const subRes = sub
  ? await admin.from("subscriptions").update(subRow).eq("store_id", storeId)
  : await admin.from("subscriptions").insert(subRow);
if (subRes.error) { console.error("subscription:", subRes.error.message); process.exit(1); }

// 5. cardápio (limpa e recria — idempotente)
await admin.from("menu_categories").delete().eq("store_id", storeId); // produtos caem por cascade

const CARDAPIO = [
  {
    name: "Petiscos", station: "cozinha", sort: 0,
    description: "Pra acompanhar a cerveja gelada",
    produtos: [
      { name: "Batata frita simples", size_label: "500g", price_cents: 3000 },
      { name: "Batata frita c/ calabresa", size_label: "500g", price_cents: 5000 },
      { name: "Filé de tilápia", size_label: "500g", price_cents: 6500 },
      { name: "Calabresa acebolada", size_label: "500g", price_cents: 3500 },
      { name: "Frango a passarinho", size_label: "500g", price_cents: 3500 },
      { name: "Mandioca frita", size_label: null, price_cents: 800 },
      { name: "Feijão tropeiro", size_label: null, price_cents: 1000 },
      { name: "Arroz", size_label: null, price_cents: 1000 },
      { name: "Vinagrete", size_label: null, price_cents: 800 },
    ],
  },
  {
    name: "Bebidas", station: "bar", sort: 1,
    description: "Geladas, direto do balcão",
    produtos: [
      { name: "Cerveja Heineken", size_label: "600ml", price_cents: 1500 },
      { name: "Cerveja Original", size_label: "600ml", price_cents: 1300 },
      { name: "Cerveja Skol", size_label: "lata", price_cents: 700 },
      { name: "Caipirinha", size_label: "dose", price_cents: 1800 },
      { name: "Refrigerante", size_label: "lata", price_cents: 600 },
      { name: "Água mineral", size_label: null, price_cents: 400 },
    ],
  },
];

for (const cat of CARDAPIO) {
  const { data: c, error: catE } = await admin.from("menu_categories").insert({
    store_id: storeId, name: cat.name, station: cat.station, description: cat.description, sort: cat.sort, active: true,
  }).select("id").single();
  if (catE) { console.error("cat:", catE.message); process.exit(1); }
  const rows = cat.produtos.map((p, i) => ({
    store_id: storeId, category_id: c.id, name: p.name, price_cents: p.price_cents,
    size_label: p.size_label, sort: i, active: true,
  }));
  const { error: pE } = await admin.from("menu_products").insert(rows);
  if (pE) { console.error("prod:", pE.message); process.exit(1); }
  console.log(`  ${cat.name} (${cat.station}): ${rows.length} produtos`);
}

console.log("\n✓ bar demo pronto → /" + SLUG + "  · login:", EMAIL, "/", PASSWORD);
