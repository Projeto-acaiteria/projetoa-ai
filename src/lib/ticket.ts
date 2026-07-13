// Gera o HTML do cupom térmico 80mm (conteúdo 72mm, Courier, charset utf-8 p/
// acento). Mesmo cupom serve pra venda de balcão e pedido do link.
// WHITE-LABEL (SaaS): marca (loja) e tagline vêm da CONFIG de cada loja, nunca
// cravados no HTML. Qualidade do Medellín: marca grande, destino gigante,
// totais com linha pontilhada (.dots) e "NÃO É DOCUMENTO FISCAL".
import { brl } from "@/lib/format";
import { getPrintWidthMm } from "@/lib/print-config";

export type TicketItem = { qty: number; name: string; note?: string; totalCents?: number };
export type TicketData = {
  loja: string;
  tagline?: string; // ex: "Açaiteria", "Hamburgueria" — vem do settings da loja
  endereco?: string; // cabeçalho do cupom (settings da loja)
  cnpj?: string; // CNPJ/CPF no cabeçalho
  tel?: string; // telefone/WhatsApp no cabeçalho
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
  subtotalCents?: number; // soma dos PRODUTOS (sem couvert/taxa) — sai como "Subtotal" quando há extras/desconto
  extras?: { label: string; cents: number }[]; // linhas ENTRE subtotal e total: couvert, taxa de serviço 10%…
  discountCents?: number;
  feeCents?: number;
  receivedCents?: number;
  changeCents?: number;
  pointsInfo?: string;
  origem?: "balcao" | "link"; // pedido do link ganha destaque "NOVO PEDIDO ONLINE"
  code?: string; // código de rastreio (delivery) — sai destacado pro cliente acompanhar
  collectCents?: number; // valor a RECEBER do cliente na entrega/retirada (não processamos pagamento)
  via?: string; // rótulo da via quando imprime 2 ("VIA DO CLIENTE" / "VIA DA LOJA")
  rodape?: string; // mensagem do rodapé (config da loja); vazio = "Obrigado! Volte sempre :)"
};

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));

// CNPJ = 14 dígitos, CPF = 11 — rotula certo no cabeçalho do cupom
const docLabel = (doc: string) => (doc.replace(/\D/g, "").length === 11 ? "CPF" : "CNPJ");

// linha com pontilhado que alinha label -> valor sozinho (chave do visual)
const lead = (l: string, r: string, cls = "") =>
  `<div class="lead ${cls}"><span>${l}</span><span class="dots"></span><span>${r}</span></div>`;

// ── Via de PREPARO por estação (KDS → impressora da cozinha/bar) ──────────────
// Cupom sem preço (é comanda de preparo): faixa da ESTAÇÃO + destino (mesa) gigante + qty grande +
// observação em caixa. A faixa é dinâmica (station.toUpperCase()) — serve cozinha, bar, copa...
export type StationTicketData = {
  loja?: string; // nome do negócio no topo da via (padrão de impressão: cabeçalho + negrito)
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
    *{font-family:'Courier New',monospace;color:#000;margin:0;box-sizing:border-box}
    body{width:${getPrintWidthMm()}mm;padding:2mm 4mm;line-height:1.3;font-weight:700}
    .loja{font-weight:700;font-size:15px;text-align:center;margin-bottom:3px}
    .stn{font-weight:700;font-size:16px;text-align:center;border:2px solid #000;padding:3px 0;margin-bottom:4px;letter-spacing:2px}
    .dest{font-weight:700;font-size:30px;text-align:center;line-height:1.1}
    .meta{font-size:11px;text-align:center;margin-bottom:5px}
    .sep{border-top:2px solid #000;margin:5px 0}
    .it{display:flex;gap:8px;align-items:flex-start;margin-bottom:7px}
    .it .q{font-weight:700;font-size:20px;min-width:36px}
    .it .n{font-size:18px;font-weight:600;flex:1}
    .it .sz{font-size:12px;font-weight:700}
    .it .mods{font-size:14px;font-weight:700;padding-left:2px;line-height:1.4}
    .it .inote{font-size:13px;font-weight:700;padding-left:2px;text-decoration:underline}
    .obs{border:2px solid #000;padding:4px 6px;font-weight:700;font-size:15px}
  </style></head><body>
    ${d.loja ? `<div class="loja">${esc(d.loja).toUpperCase()}</div>` : ""}
    <div class="stn">${esc(d.station).toUpperCase()}</div>
    <div class="dest">${esc(d.tableLabel).toUpperCase()}</div>
    <div class="meta">${esc(d.dateLabel)} &middot; #${d.orderId}</div>
    <div class="sep"></div>
    ${items}
    ${d.note ? `<div class="sep"></div><div class="obs">OBS: ${esc(d.note)}</div>` : ""}
  </body></html>`;
}

// ── COMPROVANTE DE ENTRADA da OS (80mm) — recibo que o cliente leva no check-in ──
// White-label (cabeçalho vem do settings da loja). Guarda garantia curta + cláusula de
// abandono (proteção legal) e a senha do aparelho (é do próprio cliente). Escrito do nosso jeito.
export type OSEntryTicketData = {
  loja: string;
  cnpj?: string;
  endereco?: string;
  tel?: string;
  code: string; // nº/código da OS
  dateLabel: string;
  customerName: string;
  cpf?: string;
  phone?: string;
  device: string;
  imei?: string;
  problem?: string;
  devicePassword?: string;
  rodape?: string;
};

export function osEntryTicketHtml(d: OSEntryTicketData): string {
  const linha = (l: string, r: string) =>
    r ? `<div class="row"><span class="lbl">${esc(l)}</span><span class="val">${esc(r)}</span></div>` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{font-family:'Courier New',monospace;color:#000;margin:0;box-sizing:border-box}
    body{width:${getPrintWidthMm()}mm;padding:2mm 4mm;line-height:1.35}
    .loja{font-weight:700;font-size:16px;text-align:center}
    .info{font-size:10px;text-align:center;line-height:1.25}
    .tit{font-weight:700;font-size:13px;text-align:center;border:2px solid #000;padding:3px 0;margin:6px 0;letter-spacing:1px}
    .os{font-weight:700;font-size:20px;text-align:center;line-height:1.1}
    .when{font-size:11px;text-align:center;margin-bottom:4px}
    .sep{border-top:1px dashed #000;margin:5px 0}
    .row{display:flex;gap:6px;font-size:12px;margin:2px 0}
    .row .lbl{font-weight:700;white-space:nowrap}
    .row .val{flex:1;text-align:right;word-break:break-word}
    .block{font-size:12px;margin:3px 0}
    .block b{font-weight:700}
    .termo{font-size:9.5px;line-height:1.3;margin-top:5px;text-align:justify}
    .sign{margin-top:22px;text-align:center;font-size:10px}
    .sign .ln{border-top:1px solid #000;margin:0 6mm 2px}
    .rod{font-size:10px;text-align:center;margin-top:8px}
  </style></head><body>
    <div class="loja">${esc(d.loja).toUpperCase()}</div>
    ${d.cnpj ? `<div class="info">${docLabel(d.cnpj)}: ${esc(d.cnpj)}</div>` : ""}
    ${d.endereco ? `<div class="info">${esc(d.endereco)}</div>` : ""}
    ${d.tel ? `<div class="info">${esc(d.tel)}</div>` : ""}
    <div class="tit">COMPROVANTE DE ENTRADA</div>
    <div class="os">OS Nº ${esc(d.code)}</div>
    <div class="when">Entrada: ${esc(d.dateLabel)}</div>
    <div class="sep"></div>
    ${linha("Cliente:", d.customerName)}
    ${d.cpf ? linha("CPF:", d.cpf) : ""}
    ${d.phone ? linha("Telefone:", d.phone) : ""}
    <div class="sep"></div>
    <div class="block"><b>Aparelho:</b> ${esc(d.device)}${d.imei ? `<br><b>IMEI/Série:</b> ${esc(d.imei)}` : ""}</div>
    ${d.problem ? `<div class="block"><b>Defeito relatado:</b> ${esc(d.problem)}</div>` : ""}
    ${d.devicePassword ? `<div class="block"><b>Senha do aparelho:</b> ${esc(d.devicePassword)}</div>` : ""}
    <div class="sep"></div>
    <div class="termo">Garantia de 90 dias sobre o serviço executado e peças fornecidas pela loja; não cobre mau uso, quedas ou contato com líquidos. Aparelho não retirado em até 90 dias corridos pode ser considerado abandonado (Art. 1.275 do Código Civil). <b>Guarde este comprovante para a retirada.</b></div>
    <div class="sign"><div class="ln"></div>Assinatura do cliente</div>
    <div class="rod">${esc(d.rodape || "Obrigado pela preferência!")}</div>
  </body></html>`;
}

// ── LEITURA X (relatório parcial do caixa, NÃO zera, pode tirar N vezes) ───────
// Imprime o resumo() do caixa aberto: recebimentos por método + conferência da
// gaveta de dinheiro. Espelha o cabeçalho do cupom (white-label). É o "espelho"
// que o operador tira durante o dia sem fechar o caixa (Z = fechamento que zera).
export type LeituraXData = {
  loja: string;
  tagline?: string;
  endereco?: string;
  cnpj?: string;
  tel?: string;
  dateLabel: string; // momento da leitura
  openedLabel: string; // hora de abertura do caixa
  operator?: string;
  seq?: number; // nº da leitura X nessa sessão (1ª, 2ª...)
  nVendas: number;
  salesCashCents: number;
  salesCardCents: number;
  cardFeeCents: number;
  cardNetCents: number;
  salesPixCents: number;
  salesTotalCents: number;
  openingFloatCents: number;
  suprimentoCents: number;
  sangriaCents: number;
  saldoCaixaCents: number;
  acai?: { totalKg: number; pesoKg: number; copoKg: number; copoCount: number; pesoCount: number };
};

const kgFmt = (n: number) => (n || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export function leituraXHtml(d: LeituraXData): string {
  const card = d.salesCardCents > 0;
  const pix = d.salesPixCents > 0;
  const acai = d.acai && (d.acai.totalKg > 0 || d.acai.copoCount > 0 || d.acai.pesoCount > 0) ? d.acai : null;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{font-family:'Courier New',monospace;color:#000;margin:0;box-sizing:border-box}
    body{width:${getPrintWidthMm()}mm;padding:2mm 4mm;font-size:14px;line-height:1.45;font-weight:700}
    .c{text-align:center}.b{font-weight:700}
    .dash{border-top:1px dashed #000;margin:5px 0}
    .lead{display:flex;align-items:baseline}
    .lead .dots{flex:1;border-bottom:1px dotted #000;margin:0 4px 3px}
    .brand{text-align:center;font-weight:700;font-size:19px;letter-spacing:1px}
    .sub{text-align:center;font-size:12px}
    .info{text-align:center;font-size:13px;line-height:1.55}
    .tag{border:2px solid #000;text-align:center;font-weight:700;padding:3px;margin:4px 0;font-size:15px;letter-spacing:2px}
    .sec{font-size:12px;font-weight:700;margin-top:6px;text-transform:uppercase;letter-spacing:1px}
    .total{font-size:16px}
  </style></head><body>
    <div class="brand">${esc(d.loja).toUpperCase()}</div>
    ${d.tagline ? `<div class="sub">${esc(d.tagline)}</div>` : ""}
    ${d.endereco ? `<div class="info">${esc(d.endereco)}</div>` : ""}
    ${d.tel ? `<div class="info">Tel: ${esc(d.tel)}</div>` : ""}
    ${d.cnpj ? `<div class="info">${docLabel(d.cnpj)}: ${esc(d.cnpj)}</div>` : ""}
    <div class="dash"></div>
    <div class="tag">LEITURA X${d.seq ? ` Nº ${d.seq}` : ""}</div>
    ${lead("Caixa aberto", esc(d.openedLabel))}
    ${lead("Leitura", esc(d.dateLabel))}
    ${d.operator ? lead("Operador", esc(d.operator)) : ""}
    ${lead("Vendas", String(d.nVendas))}
    <div class="dash"></div>
    <div class="sec">Recebimentos</div>
    ${lead("Dinheiro", brl(d.salesCashCents))}
    ${card ? lead("Cartão (bruto)", brl(d.salesCardCents)) : ""}
    ${card ? lead("Taxa maquininha", "- " + brl(d.cardFeeCents)) : ""}
    ${card ? lead("Cartão (líquido)", brl(d.cardNetCents)) : ""}
    ${pix ? lead("Pix", brl(d.salesPixCents)) : ""}
    ${lead("TOTAL VENDIDO", brl(d.salesTotalCents), "b total")}
    ${acai ? `<div class="dash"></div>
    <div class="sec">Açaí vendido</div>
    ${lead("Total", `${kgFmt(acai.totalKg)} kg`, "b total")}
    ${lead("Em copo", `${acai.copoCount} copos (~${kgFmt(acai.copoKg)} kg)`)}
    ${lead("Por peso", `${kgFmt(acai.pesoKg)} kg`)}` : ""}
    <div class="dash"></div>
    <div class="sec">Gaveta (dinheiro)</div>
    ${lead("Fundo de troco", brl(d.openingFloatCents))}
    ${lead("Vendas em dinheiro", brl(d.salesCashCents))}
    ${lead("Suprimentos", "+ " + brl(d.suprimentoCents))}
    ${lead("Sangrias", "- " + brl(d.sangriaCents))}
    ${lead("SALDO EM CAIXA", brl(d.saldoCaixaCents), "b total")}
    <div class="dash"></div>
    <div class="c b">LEITURA X — NÃO ZERA O CAIXA</div>
    <div class="c">NÃO É DOCUMENTO FISCAL</div>
    <div class="c" style="font-size:10px;margin-top:6px">. . . . . . . .</div>
  </body></html>`;
}

// ── SANGRIA / SUPRIMENTO (comprovante de movimento de caixa) ──────────────────
// Cupom físico assinável de retirada (sangria) ou reforço (suprimento). Espelha o
// cabeçalho white-label + valor em destaque + saldo resultante. Sangria leva linha
// de assinatura (rastro de quem retirou). Disparo é toggle por-máquina no caixa.
export type MovTicketData = {
  loja: string;
  endereco?: string;
  cnpj?: string;
  tel?: string;
  tipo: "sangria" | "suprimento";
  amountCents: number;
  operator?: string;
  reason?: string;
  dateLabel: string;
  saldoCaixaCents: number;
  rodape?: string;
};

export function movTicketHtml(d: MovTicketData): string {
  const isSangria = d.tipo === "sangria";
  const titulo = isSangria ? "SANGRIA (RETIRADA)" : "SUPRIMENTO (REFORÇO)";
  const sinal = isSangria ? "- " : "+ ";
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{font-family:'Courier New',monospace;color:#000;margin:0;box-sizing:border-box}
    body{width:${getPrintWidthMm()}mm;padding:2mm 4mm;font-size:14px;line-height:1.45;font-weight:700}
    .c{text-align:center}.b{font-weight:700}
    .dash{border-top:1px dashed #000;margin:5px 0}
    .lead{display:flex;align-items:baseline}
    .lead .dots{flex:1;border-bottom:1px dotted #000;margin:0 4px 3px}
    .brand{text-align:center;font-weight:700;font-size:19px;letter-spacing:1px}
    .info{text-align:center;font-size:13px;line-height:1.55}
    .tag{border:2px solid #000;text-align:center;font-weight:700;padding:3px;margin:4px 0;font-size:15px;letter-spacing:2px}
    .val{text-align:center;font-size:26px;font-weight:700;margin:6px 0}
    .total{font-size:16px}
    .sign{margin-top:16px;border-top:1px solid #000;padding-top:3px;text-align:center;font-size:12px}
  </style></head><body>
    <div class="brand">${esc(d.loja).toUpperCase()}</div>
    ${d.endereco ? `<div class="info">${esc(d.endereco)}</div>` : ""}
    ${d.tel ? `<div class="info">Tel: ${esc(d.tel)}</div>` : ""}
    ${d.cnpj ? `<div class="info">${docLabel(d.cnpj)}: ${esc(d.cnpj)}</div>` : ""}
    <div class="dash"></div>
    <div class="tag">${titulo}</div>
    <div class="val">${sinal}${brl(d.amountCents)}</div>
    ${d.operator ? lead("Operador", esc(d.operator)) : ""}
    ${d.reason ? lead("Motivo", esc(d.reason)) : ""}
    ${lead("Data", esc(d.dateLabel))}
    <div class="dash"></div>
    ${lead("SALDO EM CAIXA", brl(d.saldoCaixaCents), "b total")}
    <div class="dash"></div>
    ${isSangria ? `<div class="sign">Recebi a quantia acima</div>` : ""}
    <div class="c" style="margin-top:6px">NÃO É DOCUMENTO FISCAL</div>
    ${d.rodape && d.rodape.trim() ? `<div class="c" style="margin-top:4px">${esc(d.rodape)}</div>` : ""}
    <div class="c" style="font-size:10px;margin-top:6px">. . . . . . . .</div>
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
    *{font-family:'Courier New',monospace;color:#000;margin:0;box-sizing:border-box}
    body{width:${getPrintWidthMm()}mm;padding:2mm 4mm;font-size:14px;line-height:1.45;font-weight:700}
    .c{text-align:center}.b{font-weight:700}
    .dash{border-top:1px dashed #000;margin:5px 0}
    .lead{display:flex;align-items:baseline}
    .lead .dots{flex:1;border-bottom:1px dotted #000;margin:0 4px 3px}
    .tag{border:2px solid #000;text-align:center;font-weight:700;padding:3px;margin-bottom:4px;font-size:13px;letter-spacing:1px}
    .brand{text-align:center;font-weight:700;font-size:19px;letter-spacing:1px}
    .sub{text-align:center;font-size:12px}
    .info{text-align:center;font-size:13px;line-height:1.55}
    .dest{text-align:center;font-weight:700;font-size:22px;margin:5px 0 2px}
    .box{border:2px solid #000;padding:4px 6px;margin:4px 0;font-size:13px;line-height:1.5}
    .it{margin-bottom:3px}
    .it .ln{display:flex;gap:6px;align-items:baseline}
    .it .q{font-weight:700;min-width:26px}
    .it .n{flex:1;font-size:14px;font-weight:700}
    .it .v{font-weight:700}
    .it .note{padding-left:32px;font-size:12px}
    .total{font-size:16px}
    .track{border:2px solid #000;text-align:center;font-weight:700;padding:3px;margin:4px 0;letter-spacing:3px;font-size:15px}
    .collect{border:3px solid #000;text-align:center;font-weight:700;padding:5px;margin:5px 0;font-size:15px;line-height:1.3}
    .collect .v{font-size:22px}
  </style></head><body>
    ${isLink ? `<div class="tag">NOVO PEDIDO ONLINE</div>` : ""}
    <div class="brand">${esc(d.loja).toUpperCase()}</div>
    ${d.tagline ? `<div class="sub">${esc(d.tagline)}</div>` : ""}
    ${d.endereco ? `<div class="info">${esc(d.endereco)}</div>` : ""}
    ${d.tel ? `<div class="info">Tel: ${esc(d.tel)}</div>` : ""}
    ${d.cnpj ? `<div class="info">${docLabel(d.cnpj)}: ${esc(d.cnpj)}</div>` : ""}
    <div class="dash"></div>
    <div class="c b" style="font-size:13px;letter-spacing:1px">COMPROVANTE NÃO FISCAL</div>
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
    ${((d.extras && d.extras.length) || d.discountCents) ? lead("Subtotal", brl(d.subtotalCents ?? (d.totalCents + (d.discountCents ?? 0)))) : ""}
    ${(d.extras ?? []).map((e) => lead(esc(e.label), brl(e.cents))).join("")}
    ${d.discountCents ? lead("Desconto", "- " + brl(d.discountCents)) : ""}
    ${((d.extras && d.extras.length) || d.discountCents) ? `<div class="dash"></div>` : ""}
    ${lead("TOTAL", brl(d.totalCents), "b total")}
    ${d.collectCents != null ? `<div class="collect">RECEBER ${d.paymentLabel ? `EM ${esc(d.paymentLabel).toUpperCase()}` : "DO CLIENTE"}<br><span class="v">${brl(d.collectCents)}</span></div>` : (d.paymentLabel ? `<div class="c">Pagamento: ${esc(d.paymentLabel)}</div>` : "")}
    ${d.receivedCents != null ? lead("Recebido", brl(d.receivedCents)) : ""}
    ${d.changeCents != null && d.changeCents > 0 ? lead("Troco", brl(d.changeCents)) : ""}
    ${d.pointsInfo ? `<div class="box c" style="font-size:13px;line-height:1.4">${esc(d.pointsInfo).replace(/\n/g, "<br>")}</div>` : ""}
    <div class="dash"></div>
    ${d.via ? `<div class="c b" style="font-size:13px;margin-bottom:2px">— ${esc(d.via)} —</div>` : ""}
    <div class="c b">NÃO É DOCUMENTO FISCAL</div>
    <div class="c" style="margin-top:3px">${esc(d.rodape && d.rodape.trim() ? d.rodape : "Obrigado! Volte sempre :)")}</div>
    <div class="c" style="font-size:10px;margin-top:6px">. . . . . . . .</div>
  </body></html>`;
}
