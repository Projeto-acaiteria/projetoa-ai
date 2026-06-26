// Isolamento multi-tenant SOB CARGA: dispara pedidos a 2 lojas ao MESMO tempo (intercalados)
// e prova que cada loja recebe só os seus, com o total certo. Uso: node scripts/_burst-multi.mjs <N-por-loja>
const BASE = "https://projetoa-ai-six.vercel.app";
const N = Number(process.argv[2] || 20);

const LOJAS = [
  { slug: "hamburgueria-teste", prod: "ef50a808-e491-4337-b275-c1a3f668e975", preco: 600, tag: "H" }, // Refri R$6
  { slug: "restaurante-demo", prod: "67b0c9e1-18c4-4423-be89-92ceca4e4466", preco: 700, tag: "R" }, // Refrigerante R$7
];

function pedido(loja, i) {
  const body = { slug: loja.slug, customerName: `Iso ${loja.tag}${i}`, phone: `2733${loja.tag === "H" ? "1" : "2"}${String(100000 + i)}`, mode: "retirada", paymentMethod: "dinheiro", items: [{ productId: loja.prod, qty: 1 }] };
  return fetch(`${BASE}/api/delivery-pedido`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    .then(async (r) => ({ slug: loja.slug, ok: r.status === 201, total: (await r.json().catch(() => ({})))?.order?.totalCents, esperado: loja.preco }))
    .catch((e) => ({ slug: loja.slug, ok: false, err: String(e) }));
}

// monta a lista INTERCALADA (H0, R0, H1, R1, ...) e dispara TODOS de uma vez
const jobs = [];
for (let i = 0; i < N; i++) for (const loja of LOJAS) jobs.push(() => pedido(loja, i));
console.log(`Disparando ${jobs.length} pedidos SIMULTANEOS (${N} por loja, intercalados)...`);
const t0 = Date.now();
const res = await Promise.all(jobs.map((j) => j()));
console.log(`wall: ${Date.now() - t0}ms`);

for (const loja of LOJAS) {
  const meus = res.filter((r) => r.slug === loja.slug);
  const ok = meus.filter((r) => r.ok);
  const totalCerto = ok.filter((r) => r.total === loja.preco).length;
  console.log(`${loja.slug}: ${ok.length}/${meus.length} OK | total certo (R$${loja.preco / 100}): ${totalCerto}/${ok.length} ${totalCerto === ok.length ? "" : ">>> ERRO"}`);
}
