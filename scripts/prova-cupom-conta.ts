import { ticketHtml } from "../src/lib/ticket";

// Prova do cupom de pré-conta com adiantamento (bug Medellín 25/07): comanda R$100, cliente
// já pagou R$50 em dinheiro. O papel tem que mostrar o abatimento e cobrar só o que falta.
const html = ticketHtml({
  loja: "Medellín Music Bar",
  display: "Mesa 4",
  dateLabel: "25/07 23:10",
  modeLabel: "Mesa 4 · CONFERÊNCIA",
  items: [
    { qty: 2, name: "Heineken 600ml", totalCents: 4000 },
    { qty: 1, name: "Porção de Frango", totalCents: 6000 },
  ],
  subtotalCents: 10000,
  extras: [{ label: "Taxa de serviço 10%", cents: 1000 }],
  totalCents: 11000,
  payments: [{ label: "Pago (Dinheiro)", cents: 5000 }],
  collectCents: 6000,
});

console.log(
  html.replace(/<[^>]+>/g, "|").replace(/\|+/g, "|").split("|").map((s) => s.trim()).filter(Boolean).join("\n"),
);
