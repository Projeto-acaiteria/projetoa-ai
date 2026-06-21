// Gera o HTML do cupom térmico 80mm (conteúdo 72mm, Courier, charset utf-8 p/
// acento). Mesmo cupom serve pra venda de balcão e pedido do link.
// WHITE-LABEL (SaaS): marca (loja) e tagline vêm da CONFIG de cada loja, nunca
// cravados no HTML. Qualidade do Medellín: marca grande, destino gigante,
// totais com linha pontilhada (.dots) e "NÃO É DOCUMENTO FISCAL".
import { brl } from "@/lib/format";

export type TicketItem = { qty: number; name: string; note?: string; totalCents?: number };
export type TicketData = {
  loja: string;
  tagline?: string; // ex: "Açaiteria", "Hamburgueria" — vem do settings da loja
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
  code?: string; // código de rastreio (delivery) — sai destacado pro cliente acompanhar
  collectCents?: number; // valor a RECEBER do cliente na entrega/retirada (não processamos pagamento)
};

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));

// linha com pontilhado que alinha label -> valor sozinho (chave do visual)
const lead = (l: string, r: string, cls = "") =>
  `<div class="lead ${cls}"><span>${l}</span><span class="dots"></span><span>${r}</span></div>`;

// ── Via de PREPARO por estação (KDS → impressora da cozinha/bar) ──────────────
// Cupom sem preço (é comanda de preparo): faixa da ESTAÇÃO + destino (mesa) gigante + qty grande +
// observação em caixa. A faixa é dinâmica (station.toUpperCase()) — serve cozinha, bar, copa...
export type StationTicketData = {
  station: string;
  tableLabel: string;
  dateLabel: string;
  orderId: number;
  items: { qty: number; name: string; sizeLabel?: string | null; mods?: { name: string; price_cents: number }[] | null; note?: string | null }[];
  note?: string | null;
};

export function stationTicketHtml(d: StationTicketData): string {
  const items = d.items
    .map(
      (it) =>
        `<div class="it"><span class="q">${it.qty}x</span><span class="n">${esc(it.name)}${
          it.sizeLabel ? `<div class="sz">${esc(it.sizeLabel)}</div>` : ""
        }${
          it.mods && it.mods.length ? `<div class="mods">${it.mods.map((m) => "+ " + esc(m.name)).join("<br>")}</div>` : ""
        }${
          it.note ? `<div class="inote">OBS: ${esc(it.note)}</div>` : ""
        }</span></div>`,
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{font-family:'Courier New',monospace;color:#000;margin:0}
    body{width:72mm;padding:2mm;line-height:1.3}
    .stn{font-weight:700;font-size:16px;text-align:center;border:2px solid #000;padding:3px 0;margin-bottom:4px;letter-spacing:2px}
    .dest{font-weight:700;font-size:30px;text-align:center;line-height:1.1}
    .meta{font-size:11px;text-align:center;margin-bottom:5px}
    .sep{border-top:2px solid #000;margin:5px 0}
    .it{display:flex;gap:8px;align-items:flex-start;margin-bottom:7px}
    .it .q{font-weight:700;font-size:20px;min-width:36px}
    .it .n{font-size:18px;font-weight:600;flex:1}
    .it .sz{font-size:12px;font-weight:400}
    .it .mods{font-size:14px;font-weight:700;padding-left:2px;line-height:1.4}
    .it .inote{font-size:13px;font-weight:700;padding-left:2px;text-decoration:underline}
    .obs{border:2px solid #000;padding:4px 6px;font-weight:700;font-size:15px}
  </style></head><body>
    <div class="stn">${esc(d.station).toUpperCase()}</div>
    <div class="dest">${esc(d.tableLabel).toUpperCase()}</div>
    <div class="meta">${esc(d.dateLabel)} &middot; #${d.orderId}</div>
    <div class="sep"></div>
    ${items}
    ${d.note ? `<div class="sep"></div><div class="obs">OBS: ${esc(d.note)}</div>` : ""}
  </body></html>`;
}

export function ticketHtml(d: TicketData): string {
  const isLink = d.origem === "link";

  const items = d.items
    .map(
      (it) =>
        `<div class="it"><div class="ln"><span class="q">${it.qty}x</span><span class="n">${esc(
          it.name,
        )}</span><span class="v">${it.totalCents != null ? brl(it.totalCents) : ""}</span></div>${
          it.note ? `<div class="note">${esc(it.note)}</div>` : ""
        }</div>`,
    )
    .join("");

  const entrega =
    d.phone || d.bairro || d.address
      ? `<div class="box">${d.phone ? `<div>Tel: ${esc(d.phone)}</div>` : ""}${
          d.bairro ? `<div class="b">Bairro: ${esc(d.bairro)}</div>` : ""
        }${d.address ? `<div>End: ${esc(d.address)}</div>` : ""}</div>`
      : "";

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{font-family:'Courier New',monospace;color:#000;margin:0}
    body{width:72mm;padding:2mm;font-size:12px;line-height:1.35}
    .c{text-align:center}.b{font-weight:700}
    .dash{border-top:1px dashed #000;margin:5px 0}
    .lead{display:flex;align-items:baseline}
    .lead .dots{flex:1;border-bottom:1px dotted #000;margin:0 4px 3px}
    .tag{border:2px solid #000;text-align:center;font-weight:700;padding:3px;margin-bottom:4px;font-size:13px;letter-spacing:1px}
    .brand{text-align:center;font-weight:700;font-size:18px;letter-spacing:1px}
    .sub{text-align:center;font-size:11px}
    .dest{text-align:center;font-weight:700;font-size:22px;margin:5px 0 2px}
    .box{border:2px solid #000;padding:4px 6px;margin:4px 0;font-size:13px;line-height:1.5}
    .it{margin-bottom:3px}
    .it .ln{display:flex;gap:6px;align-items:baseline}
    .it .q{font-weight:700;min-width:26px}
    .it .n{flex:1;font-size:13px;font-weight:600}
    .it .v{font-weight:600}
    .it .note{padding-left:32px;font-size:11px}
    .total{font-size:16px}
    .track{border:2px solid #000;text-align:center;font-weight:700;padding:3px;margin:4px 0;letter-spacing:3px;font-size:15px}
    .collect{border:3px solid #000;text-align:center;font-weight:700;padding:5px;margin:5px 0;font-size:15px;line-height:1.3}
    .collect .v{font-size:22px}
  </style></head><body>
    ${isLink ? `<div class="tag">NOVO PEDIDO ONLINE</div>` : ""}
    <div class="brand">${esc(d.loja).toUpperCase()}</div>
    ${d.tagline ? `<div class="sub">${esc(d.tagline)}</div>` : ""}
    <div class="dash"></div>
    ${lead(esc(d.display), esc(d.dateLabel))}
    <div class="b" style="text-align:center;font-size:15px;margin:2px 0">${esc(d.modeLabel).toUpperCase()}</div>
    ${d.code ? `<div class="track">RASTREIO: ${esc(d.code)}</div>` : ""}
    ${d.customerName ? `<div class="dest">${esc(d.customerName).toUpperCase()}</div>` : ""}
    ${entrega}
    <div class="dash"></div>
    ${items}
    <div class="dash"></div>
    ${d.feeCents ? lead("Taxa entrega", brl(d.feeCents)) : ""}
    ${lead("TOTAL", brl(d.totalCents), "b total")}
    ${d.collectCents != null ? `<div class="collect">RECEBER ${d.paymentLabel ? `EM ${esc(d.paymentLabel).toUpperCase()}` : "DO CLIENTE"}<br><span class="v">${brl(d.collectCents)}</span></div>` : (d.paymentLabel ? `<div class="c">Pagamento: ${esc(d.paymentLabel)}</div>` : "")}
    ${d.receivedCents != null ? lead("Recebido", brl(d.receivedCents)) : ""}
    ${d.changeCents != null && d.changeCents > 0 ? lead("Troco", brl(d.changeCents)) : ""}
    ${d.pointsInfo ? `<div class="c" style="margin-top:4px">${esc(d.pointsInfo)}</div>` : ""}
    <div class="dash"></div>
    <div class="c b">NÃO É DOCUMENTO FISCAL</div>
    <div class="c" style="margin-top:3px">Obrigado! Volte sempre :)</div>
    <div class="c" style="font-size:10px;margin-top:6px">. . . . . . . .</div>
  </body></html>`;
}
