"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
// Cliente do QZ Tray — impressão térmica 80mm silenciosa (padrão validado na
// petiscaria). Modo unsigned por ora (QZ pede "Allow" 1x); cert opcional depois.
// A conexão é POR ABA: sempre chamar qzConnect() antes de imprimir, não gatear
// em isActive() (aba nova retorna false e cai no fallback). — lição do Verbo.

import { QZ_CERT } from "./qz-cert";
import { parseScaleWeight } from "./scale";

type QZ = any;
let qzMod: QZ = null;

async function getQz(): Promise<QZ> {
  if (qzMod) return qzMod;
  const mod: any = await import("qz-tray");
  const qz = mod.default ?? mod;
  // modo ASSINADO — com o override.crt na máquina, o QZ não pede "Allow"
  qz.security.setCertificatePromise((resolve: any) => resolve(QZ_CERT));
  if (qz.security.setSignatureAlgorithm) qz.security.setSignatureAlgorithm("SHA512");
  qz.security.setSignaturePromise((toSign: string) => (resolve: any, reject: any) => {
    fetch(`/api/qz-sign?request=${encodeURIComponent(toSign)}`)
      .then((r) => r.text())
      .then(resolve)
      .catch(reject);
  });
  qzMod = qz;
  return qzMod;
}

export async function qzConnect(): Promise<QZ> {
  const qz = await getQz();
  if (!qz.websocket.isActive()) await qz.websocket.connect({ retries: 1, delay: 1 });
  return qz;
}

export async function qzPrintHtml(printer: string, html: string): Promise<void> {
  const qz = await qzConnect();
  // IMPORTANTE: scaleContent re-estica o conteúdo pra encher o `size`, então PADDING no HTML é
  // inútil pra cortar borda (o QZ cancela). A alavanca real é o `size` (largura do output) + `margins`
  // (deslocamento), que o scaleContent respeita. Esta TM-T20X imprime ~64mm (512 dots), não 72mm, e
  // tem ~3-4mm de zona morta à esquerda. Então: size 58mm de output, deslocado 4mm pra direita →
  // conteúdo cai em ~4-62mm, dentro da área imprimível, sem cortar nenhum lado. (29/06 v4 — size-lever)
  const cfg = qz.configs.create(printer, { scaleContent: true, units: "mm", size: { width: 58 }, margins: { top: 0, right: 0, bottom: 0, left: 4 } });
  await qz.print(cfg, [{ type: "html", format: "plain", data: html }]);
}

// Abre a gaveta de dinheiro: pulso ESC/POS na impressora térmica (a gaveta liga na
// impressora pela RJ11). Comando ESC p m t1 t2 (m=0 pino, t1=25ms, t2=250ms) — padrão da
// indústria. ⚠️ HARDWARE: só tem efeito com gaveta física conectada; sem ela, no-op inofensivo.
export async function qzKickDrawer(printer: string): Promise<void> {
  const qz = await qzConnect();
  const cfg = qz.configs.create(printer, { encoding: "ISO-8859-1" });
  await qz.print(cfg, [{ type: "raw", format: "command", flavor: "plain", data: "\x1B\x70\x00\x19\xFA" }]);
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

// ── Balança serial via QZ Tray (V2 — leitura automática do peso) ──────────────
// Reusa a MESMA ponte do QZ que já roda pra impressão. Protocolo Toledo (parseScaleWeight).
// ⚠️ Caminho de HARDWARE — só valida com balança física + QZ rodando; o parser é provado isolado.
export type ScaleConfig = { port: string; baudRate: number; dataBits: number; parity: string; stopBits: number };
const SCALE_KEY = "scale:config";

export function getScaleConfig(): ScaleConfig | null {
  if (typeof window === "undefined") return null;
  try { const v = localStorage.getItem(SCALE_KEY); return v ? (JSON.parse(v) as ScaleConfig) : null; } catch { return null; }
}
export function setScaleConfig(cfg: ScaleConfig): void {
  if (typeof window !== "undefined") localStorage.setItem(SCALE_KEY, JSON.stringify(cfg));
}

export async function qzListSerialPorts(): Promise<string[]> {
  const qz = await qzConnect();
  const ports = await qz.serial.findPorts();
  return Array.isArray(ports) ? ports : ports ? [ports] : [];
}

/** Lê UM peso estável da balança (gramas). null = nada estável no tempo limite. Fecha a porta no fim.
 *  request = comando que pede o peso (Toledo PRT1 responde a ENQ 0x05). */
export async function qzReadScaleGrams(cfg?: Partial<ScaleConfig>, request = "\x05", timeoutMs = 2500): Promise<number | null> {
  const saved = getScaleConfig();
  const c: ScaleConfig = {
    port: cfg?.port ?? saved?.port ?? "",
    baudRate: cfg?.baudRate ?? saved?.baudRate ?? 9600,
    dataBits: cfg?.dataBits ?? saved?.dataBits ?? 8,
    parity: cfg?.parity ?? saved?.parity ?? "none",
    stopBits: cfg?.stopBits ?? saved?.stopBits ?? 1,
  };
  if (!c.port) throw new Error("Balança não configurada (porta).");
  const qz = await qzConnect();
  const bounds = { baudRate: c.baudRate, dataBits: c.dataBits, parity: c.parity, stopBits: c.stopBits, flowControl: "none" };

  return new Promise<number | null>((resolve) => {
    let buffer = "";
    let settled = false;
    let timer: ReturnType<typeof setTimeout>;
    const finish = (val: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { qz.serial.setSerialCallbacks(null); } catch {} // não vazar callback global entre leituras
      qz.serial.closePort(c.port).catch(() => {});
      resolve(val);
    };
    timer = setTimeout(() => finish(parseScaleWeight(buffer)), timeoutMs);
    try {
      qz.serial.setSerialCallbacks((evt: any) => {
        const data = (evt && (evt.output ?? evt.data)) ?? "";
        buffer += String(data);
        const g = parseScaleWeight(buffer);
        if (g != null) finish(g);
      });
      Promise.resolve(qz.serial.openPort(c.port, bounds))
        .then(() => (request ? qz.serial.sendData(c.port, request) : undefined))
        .catch(() => finish(null));
    } catch {
      finish(null);
    }
  });
}
