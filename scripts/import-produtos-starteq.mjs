// Import dos produtos reais do site Starteq → estoque do tenant Starteq (ComandaPRO).
// Fonte: scripts/produtos-site.json (dump de catalog.ts do site).
// Idempotente: upsert por (store_id, id=sku). Rerodar não duplica.
// Entra como published=false (RASCUNHO) pro dono revisar e publicar no /admin/loja.
// store_id EXPLÍCITO (regra dura: nunca cair no resolveStoreId → Cantinho).
import { readFileSync } from "node:fs";
import pg from "pg";

const STARTEQ = "c1251296-9bee-40ed-a98e-472614c61bf8";
const SITE = "https://starteq.vercel.app";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = (env.match(/DATABASE_URL=(.+)/) || [])[1].trim();
const m = url.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^:/]+):(\d+)\/(.+)$/);
const [, user, password, host, port, database] = m;
const client = new pg.Client({ user, password, host, port: +port, database, ssl: { rejectUnauthorized: false } });

const products = JSON.parse(readFileSync(new URL("./produtos-site.json", import.meta.url), "utf8"));
const now = new Date().toISOString();

const SKIP_SPECS = ["cooler_included", "igpu", "supports_socket", "supports_mobo", "image_url"];
function baseDescription(p) {
  const specs = Object.entries(p.specs || {})
    .filter(([k]) => !SKIP_SPECS.includes(k))
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join("/") : v}`)
    .join(" · ");
  return `${p.name}.${specs ? ` Ficha técnica — ${specs}.` : ""}`;
}

async function main() {
  await client.connect();
  try {
    const before = (await client.query("SELECT count(*) FROM stock_items WHERE store_id=$1", [STARTEQ])).rows[0].count;
    let ok = 0;
    for (const p of products) {
      const data = {
        id: p.sku,
        name: p.name,
        category: p.category,
        qty: p.stock ?? 0,
        unit: "un",
        minQty: 0,
        sellPriceCents: Math.round((p.price || 0) * 100),
        specs: p.specs || {},
        brand: p.brand,
        highlight: !!p.highlight,
        badge: p.badge,
        image: p.image ? (p.image.startsWith("http") ? p.image : SITE + p.image) : undefined,
        published: false, // RASCUNHO — o dono revisa e publica no /admin/loja
        description: baseDescription(p),
        updatedAt: now,
        history: [],
      };
      await client.query(
        `INSERT INTO stock_items (store_id, id, data) VALUES ($1, $2, $3)
         ON CONFLICT (store_id, id) DO UPDATE SET data = EXCLUDED.data`,
        [STARTEQ, p.sku, data]
      );
      ok++;
    }
    const after = (await client.query("SELECT count(*) FROM stock_items WHERE store_id=$1", [STARTEQ])).rows[0].count;
    console.log(`Antes: ${before} · Upsertados: ${ok} · Depois: ${after}`);
    // read-after-write: mostra 3 amostras reais do banco
    const sample = await client.query(
      `SELECT id, data->>'name' AS name, data->>'category' AS cat, (data->>'sellPriceCents')::int AS price, data->>'published' AS pub, data->>'image' AS img
       FROM stock_items WHERE store_id=$1 AND id LIKE '100-%' ORDER BY id LIMIT 3`,
      [STARTEQ]
    );
    console.table(sample.rows);
  } finally {
    await client.end();
  }
}
main();
