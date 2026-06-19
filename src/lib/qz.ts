"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
// Cliente do QZ Tray — impressão térmica 80mm silenciosa (padrão validado na
// petiscaria). Modo unsigned por ora (QZ pede "Allow" 1x); cert opcional depois.
// A conexão é POR ABA: sempre chamar qzConnect() antes de imprimir, não gatear
// em isActive() (aba nova retorna false e cai no fallback). — lição do Verbo.

type QZ = any;
let qzMod: QZ = null;

async function getQz(): Promise<QZ> {
  if (qzMod) return qzMod;
  const mod: any = await import("qz-tray");
  qzMod = mod.default ?? mod;
  return qzMod;
}

export async function qzConnect(): Promise<QZ> {
  const qz = await getQz();
  if (!qz.websocket.isActive()) await qz.websocket.connect({ retries: 1, delay: 1 });
  return qz;
}

export async function qzPrintHtml(printer: string, html: string): Promise<void> {
  const qz = await qzConnect();
  // conteúdo 72mm dentro do papel 80mm (não usar 80 no body, corta lateral)
  const cfg = qz.configs.create(printer, { scaleContent: true, margins: 0, units: "mm", size: { width: 80 } });
  await qz.print(cfg, [{ type: "html", format: "plain", data: html }]);
}

export async function qzIsActive(): Promise<boolean> {
  try {
    const qz = await getQz();
    return qz.websocket.isActive();
  } catch {
    return false;
  }
}

export async function qzListPrinters(): Promise<string[]> {
  const qz = await qzConnect();
  const found = await qz.printers.find(); // todas as impressoras do Windows
  return Array.isArray(found) ? found : found ? [found] : [];
}

// 1 impressora só no açaí (sem roteamento), mas mantém a chave por estação
export function getStationPrinter(station = "caixa"): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("printer:" + station);
}
export function setStationPrinter(station: string, name: string): void {
  if (typeof window !== "undefined") localStorage.setItem("printer:" + station, name);
}
