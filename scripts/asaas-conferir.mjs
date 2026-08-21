// Read-only: confere um cliente e/ou uma cobrança no Asaas.
// uso: node --env-file=.env.local scripts/asaas-conferir.mjs <customerId> [paymentId]
const key = process.env.ASAAS_API_KEY?.replace(/^\\/, ""); // .env.local guarda \$aact… (escape do Next)
if (!key) { console.error("sem ASAAS_API_KEY"); process.exit(1); }
const h = { access_token: key };
const base = "https://api.asaas.com/v3";

const [customerId, paymentId] = process.argv.slice(2);

if (customerId) {
  const c = await (await fetch(`${base}/customers/${customerId}`, { headers: h })).json();
  console.log("CLIENTE:", c.name, "| cpfCnpj:", c.cpfCnpj, "| ref:", c.externalReference);
  const lista = await (await fetch(`${base}/payments?customer=${customerId}&limit=10&order=desc`, { headers: h })).json();
  console.log("cobranças do cliente:", lista.totalCount);
  for (const p of lista.data ?? []) console.log("  -", p.id, "R$", p.value, p.billingType, p.status, "venc", p.dueDate, "| ref:", p.externalReference);
}

if (paymentId) {
  const p = await (await fetch(`${base}/payments/${paymentId}`, { headers: h })).json();
  console.log("COBRANÇA:", p.id, "| R$", p.value, "|", p.billingType, "|", p.status, "| venc:", p.dueDate, "| ref:", p.externalReference);
}
