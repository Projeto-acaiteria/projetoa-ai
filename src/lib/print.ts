"use client";
// Imprime o cupom: tenta QZ Tray (silencioso, impressora do caixa); se não há
// impressora configurada ou o QZ não responde, cai no iframe escondido (imprime
// só o cupom, não a página inteira). Nunca lança — impressão não pode travar a venda.
import { qzPrintHtml, getStationPrinter } from "./qz";

export async function printTicket(html: string, station = "caixa"): Promise<"qz" | "iframe" | "erro"> {
  const printer = getStationPrinter(station);
  if (printer) {
    try {
      await qzPrintHtml(printer, html);
      return "qz";
    } catch {
      // QZ caiu — segue pro fallback
    }
  }
  try {
    const iframe = document.createElement("iframe");
    Object.assign(iframe.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow!.document;
    doc.open();
    doc.write(html);
    doc.close();
    await new Promise((r) => setTimeout(r, 250));
    iframe.contentWindow!.focus();
    iframe.contentWindow!.print();
    setTimeout(() => iframe.remove(), 1500);
    return "iframe";
  } catch {
    return "erro";
  }
}

// Imprime o cupom de VENDA em 1 ou 2 vias (cliente + loja), conforme a preferência POR-MÁQUINA
// `print:duasvias` (default LIGADO). makeHtml recebe o rótulo da via e devolve o HTML do cupom
// (ex: (via) => ticketHtml({ ...dados, via })). Imprime sequencial pra não embaralhar na térmica.
export async function printVias(makeHtml: (via?: string) => string, station = "caixa"): Promise<void> {
  const duas = typeof window !== "undefined" && localStorage.getItem("print:duasvias") !== "0";
  if (duas) {
    await printTicket(makeHtml("VIA DO CLIENTE"), station);
    await printTicket(makeHtml("VIA DA LOJA"), station);
  } else {
    await printTicket(makeHtml(), station);
  }
}
