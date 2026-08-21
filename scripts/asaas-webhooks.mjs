// Read-only: lista os webhooks cadastrados na conta Asaas (prova de que o pagamento volta pro app).
// uso: node --env-file=.env.local scripts/asaas-webhooks.mjs
// No .env.local a chave vai escapada (\$aact_…) por causa do dotenv-expand do Next. O --env-file do
// Node não desfaz esse escape, então tira a barra aqui.
const key = process.env.ASAAS_API_KEY?.replace(/^\\/, "");
if (!key) { console.error("sem ASAAS_API_KEY"); process.exit(1); }
const base = process.env.ASAAS_ENV === "sandbox" || key.startsWith("$aact_hmlg_")
  ? "https://api-sandbox.asaas.com/v3"
  : "https://api.asaas.com/v3";
console.log("BASE", base);
const res = await fetch(base + "/webhooks", { headers: { access_token: key, "content-type": "application/json" } });
console.log("STATUS", res.status);
const data = await res.json().catch(() => null);
for (const w of data?.data ?? []) {
  console.log({ id: w.id, name: w.name, url: w.url, enabled: w.enabled, interrupted: w.interrupted, events: w.events?.length, sendType: w.sendType, temToken: !!w.authToken });
  console.log("  events:", (w.events ?? []).join(", "));
}
if (!data?.data?.length) console.log("NENHUM WEBHOOK CADASTRADO", JSON.stringify(data)?.slice(0, 300));
