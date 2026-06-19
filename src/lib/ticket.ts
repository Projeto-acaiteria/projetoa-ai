// Gera o HTML do cupom térmico 80mm (conteúdo 72mm, Courier, charset utf-8 p/
// acento). Mesmo cupom serve pra venda de balcão e pedido do link.
import { brl } from "@/lib/format";

export type TicketItem = { qty: number; name: string; note?: string; totalCents?: number };
export type TicketData = {
  loja: string;
  display: string;
  dateLabel: string;
  modeLabel: string;
  paymentLabel?: string;
  customerName?: string;
  phone?: string;
  address?: string;
  bairro?: string;
  items: TicketItem[];
  totalCents: number;
  feeCents?: number;
  receivedCents?: number;
  changeCents?: number;
  pointsInfo?: string;
  origem?: "balcao" | "link"; // pedido do link ganha destaque "NOVO PEDIDO ONLINE"
};

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));

const row = (l: string, r: string, bold = false) =>
  `<div style="display:flex;justify-content:space-between;gap:8px${bold ? ";font-weight:700" : ""}"><span>${l}</span><span>${r}</span></div>`;

export function ticketHtml(d: TicketData): string {
  const items = d.items
    .map(
      (it) =>
        `<div style="margin-bottom:2px">${row(`${it.qty}x ${esc(it.name)}`, it.totalCents != null ? brl(it.totalCents) : "")}${
          it.note ? `<div style="padding-left:10px;font-size:11px">${esc(it.note)}</div>` : ""
        }</div>`,
    )
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{font-family:'Courier New',monospace;color:#000;margin:0}
    body{width:72mm;padding:2mm;font-size:12px;line-height:1.35}
    .c{text-align:center}.dash{border-top:1px dashed #000;margin:5px 0}
    .tag{border:2px solid #000;text-align:center;font-weight:700;padding:3px;margin-bottom:4px}
  </style></head><body>
    ${d.origem === "link" ? `<div class="tag">NOVO PEDIDO ONLINE</div>` : ""}
    <div class="c" style="font-weight:700;font-size:16px;letter-spacing:1px">${esc(d.loja)}</div>
    <div class="dash"></div>
    ${row(`Pedido ${esc(d.display)}`, esc(d.dateLabel))}
    <div>${esc(d.modeLabel)}${d.paymentLabel ? ` &middot; ${esc(d.paymentLabel)}` : ""}</div>
    ${d.customerName ? `<div>Cliente: ${esc(d.customerName)}${d.phone ? ` (${esc(d.phone)})` : ""}</div>` : ""}
    ${d.bairro ? `<div>Bairro: ${esc(d.bairro)}</div>` : ""}
    ${d.address ? `<div>Endereco: ${esc(d.address)}</div>` : ""}
    <div class="dash"></div>
    ${items}
    <div class="dash"></div>
    ${d.feeCents ? row("Taxa entrega", brl(d.feeCents)) : ""}
    ${row("TOTAL", brl(d.totalCents), true)}
    ${d.receivedCents != null ? row("Recebido", brl(d.receivedCents)) : ""}
    ${d.changeCents != null && d.changeCents > 0 ? row("Troco", brl(d.changeCents)) : ""}
    ${d.pointsInfo ? `<div class="c" style="margin-top:4px">${esc(d.pointsInfo)}</div>` : ""}
    <div class="dash"></div>
    <div class="c">Obrigado! Volte sempre :)</div>
    <div class="c" style="font-size:10px;margin-top:6px">- - - - - - - -</div>
  </body></html>`;
}
