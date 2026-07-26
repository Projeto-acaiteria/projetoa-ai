import { getTabFull } from "../src/lib/tables-store";
import { ticketHtml } from "../src/lib/ticket";

// DRY-RUN do cupom de pré-conta com dado REAL do banco. NÃO imprime, NÃO enfileira job:
// só lê a comanda pelo mesmo caminho do caixa (getTabFull) e renderiza o HTML em texto.
// Uso: npx tsx --env-file=.env.local scripts/prova-cupom-conta-real.ts <tabId> [storeId]
const STORE = process.argv[3] ?? "e2c9b699-8b92-4f95-a6b0-ef750a7721a4"; // Medellín
const TAB = Number(process.argv[2]);

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const PAYS: Record<string, string> = { dinheiro: "Dinheiro", pix: "PIX", debito: "Débito", credito: "Crédito" };

main().catch((e) => { console.error(e); process.exit(1); });

async function main() {
const full = await getTabFull(TAB, STORE);
if (!full) throw new Error(`comanda ${TAB} não encontrada`);

// mesma conta do MesasBarClient: consumo + couvert + taxa; falta = total - já pago
const consumo = full.consumoCents;
const coverCharged = full.coverCents;
const serviceFee = Math.round(consumo * 0.1); // toggle dos 10% LIGADO (padrão do bar)
const grand = consumo + coverCharged + serviceFee;
const paid = full.paidCents;
const falta = Math.max(0, grand - paid);
const pagosNoCupom = full.payments.map((p) => ({
  label: `Pago (${PAYS[p.method] ?? p.method})`,
  cents: p.amount_cents,
}));

console.log("=== NÚMEROS LIDOS DO BANCO ===");
console.log("consumo .....", brl(consumo));
console.log("couvert .....", brl(coverCharged));
console.log("taxa 10% ....", brl(serviceFee));
console.log("TOTAL .......", brl(grand));
console.log("já pago .....", brl(paid), JSON.stringify(full.payments.map((p) => [p.method, p.amount_cents])));
console.log("falta .......", brl(falta));
console.log();

const html = ticketHtml({
  loja: "Medellín Music Bar",
  display: "Mesa (dry-run)",
  dateLabel: "dry-run",
  modeLabel: "CONFERÊNCIA",
  items: full.orders.flatMap((o) =>
    o.items.map((i) => ({ qty: i.qty, name: i.name, totalCents: i.qty * i.unit_price_cents })),
  ),
  subtotalCents: consumo,
  extras: [
    ...(coverCharged > 0 ? [{ label: "Couvert", cents: coverCharged }] : []),
    ...(serviceFee > 0 ? [{ label: "Taxa de serviço 10%", cents: serviceFee }] : []),
  ],
  totalCents: grand,
  payments: pagosNoCupom,
  collectCents: falta > 0 ? falta : undefined,
});

console.log("=== CUPOM QUE SAIRIA NO PAPEL ===");
console.log(
  html.replace(/<[^>]+>/g, "|").replace(/\|+/g, "|").split("|").map((s) => s.trim()).filter(Boolean).join("\n"),
);
}
