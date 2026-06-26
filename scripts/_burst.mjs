// Simula N acessos SIMULTANEOS (clientes pedindo ao mesmo tempo) — testa corrida no numero
// do pedido (#display), unicidade do codigo de rastreio e robustez sob carga.
// Uso: node scripts/_burst.mjs <N>
const BASE = "https://projetoa-ai-six.vercel.app";
const SLUG = "hamburgueria-teste";
const N = Number(process.argv[2] || 25);

const XBACON = "268d45e0-fe16-45c9-bdd0-d26d4978e3fb";
const AOPONTO = "d3dd5edb-a1eb-45a0-b70e-b96072db680e";
const BACON = "95410635-7466-4d21-8723-278e5535c74c";
const REFRI = "ef50a808-e491-4337-b275-c1a3f668e975";
const BATATA = "31298e37-b415-4f4e-b9c4-c9e4760bed19";

// 3 carrinhos diferentes pra variar (rodizia por indice)
const carts = [
  { items: [{ productId: XBACON, qty: 1, modifierIds: [AOPONTO, BACON] }, { productId: REFRI, qty: 1 }], esperado: 3400 + 600 },
  { items: [{ productId: REFRI, qty: 2 }], esperado: 1200 },
  { items: [{ productId: BATATA, qty: 1 }, { productId: REFRI, qty: 1 }], esperado: 1800 + 600 },
];

function pedido(i) {
  const cart = carts[i % carts.length];
  const body = {
    slug: SLUG, customerName: `Burst ${i}`, phone: `21${String(900000000 + i)}`,
    mode: "retirada", paymentMethod: "dinheiro", items: cart.items,
  };
  const t0 = Date.now();
  return fetch(`${BASE}/api/delivery-pedido`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    .then(async (r) => ({ i, status: r.status, ms: Date.now() - t0, body: await r.json().catch(() => ({})), esperado: cart.esperado }))
    .catch((e) => ({ i, status: 0, ms: Date.now() - t0, body: { error: String(e) } }));
}

console.log(`Disparando ${N} pedidos SIMULTANEOS em ${SLUG}...`);
const t0 = Date.now();
const res = await Promise.all(Array.from({ length: N }, (_, i) => pedido(i)));
const wall = Date.now() - t0;

const ok = res.filter((r) => r.status === 201 || r.body?.ok);
const fail = res.filter((r) => !(r.status === 201 || r.body?.ok));
const displays = ok.map((r) => r.body?.order?.display).filter(Boolean);
const codes = ok.map((r) => r.body?.order?.code).filter(Boolean);
const totaisOk = ok.filter((r) => r.body?.order?.totalCents === r.esperado).length;
const lat = res.map((r) => r.ms).sort((a, b) => a - b);

console.log(`\nwall: ${wall}ms | OK: ${ok.length}/${N} | falhas: ${fail.length}`);
console.log(`latencia ms — min ${lat[0]} / mediana ${lat[Math.floor(lat.length / 2)]} / max ${lat[lat.length - 1]}`);
console.log(`#display unicos: ${new Set(displays).size}/${displays.length}  ${new Set(displays).size === displays.length ? "(SEM COLISAO)" : ">>> COLISAO!"}`);
console.log(`codigos rastreio unicos: ${new Set(codes).size}/${codes.length}  ${new Set(codes).size === codes.length ? "(OK)" : ">>> COLISAO!"}`);
console.log(`totais corretos: ${totaisOk}/${ok.length}  ${totaisOk === ok.length ? "(OK)" : ">>> ALGUM VALOR ERRADO!"}`);
if (fail.length) console.log("falhas:", JSON.stringify(fail.slice(0, 5).map((f) => ({ i: f.i, status: f.status, err: f.body?.error })), null, 0));
const dups = displays.filter((d, i) => displays.indexOf(d) !== i);
if (dups.length) console.log("DISPLAYS DUPLICADOS:", [...new Set(dups)]);
