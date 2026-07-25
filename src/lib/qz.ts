"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
// Cliente do QZ Tray — impressão térmica 80mm silenciosa (padrão validado na
// petiscaria). Modo unsigned por ora (QZ pede "Allow" 1x); cert opcional depois.
// A conexão é POR ABA: sempre chamar qzConnect() antes de imprimir, não gatear
// em isActive() (aba nova retorna false e cai no fallback). — lição do Verbo.

import { QZ_CERT } from "./qz-cert";
import { parseScaleWeight } from "./scale";
import { getPrintWidthMm } from "./print-config";
import { cacheGet, cacheSet } from "./offline-cache";

type QZ = any;
let qzMod: QZ = null;

// ── Assinatura OFFLINE (opção 1) ─────────────────────────────────────────────
// O QZ assina cada print no servidor (/api/qz-sign). Sem net isso falha e a impressão de estação
// não sai. Solução: cachear a chave (PKCS#8) uma vez ONLINE e assinar no navegador (Web Crypto,
// RSASSA-PKCS1-v1_5 + SHA-512 → base64, IGUAL ao servidor, determinístico → o QZ aceita).
const QZ_KEY_CACHE = "qz-key-pkcs8";
let signKeyPromise: Promise<CryptoKey | null> | null = null;

async function importPkcs8(pem: string): Promise<CryptoKey> {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("pkcs8", der.buffer, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-512" }, false, ["sign"]);
}

/** Garante a chave local de assinatura: memória → IndexedDB → busca online (/api/qz-key) e cacheia. */
async function ensureSignKey(): Promise<CryptoKey | null> {
  if (!signKeyPromise) {
    signKeyPromise = (async () => {
      try {
        let pem = await cacheGet<string>(QZ_KEY_CACHE); // persistido (sobrevive reload/offline)
        if (!pem) {
          const r = await fetch("/api/qz-key", { cache: "no-store" }); // só dá certo ONLINE (warm)
          if (!r.ok) return null;
          pem = await r.text();
          if (pem) await cacheSet(QZ_KEY_CACHE, pem);
        }
        return pem ? await importPkcs8(pem) : null;
      } catch { return null; }
    })();
  }
  return signKeyPromise;
}

async function signLocal(toSign: string): Promise<string> {
  const key = await ensureSignKey();
  if (!key) throw new Error("sem chave local de assinatura");
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(toSign));
  let bin = ""; const bytes = new Uint8Array(sig);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin); // base64 — mesmo formato do /api/qz-sign
}

async function getQz(): Promise<QZ> {
  if (qzMod) return qzMod;
  const mod: any = await import("qz-tray");
  const qz = mod.default ?? mod;
  // modo ASSINADO — com o override.crt na máquina, o QZ não pede "Allow"
  qz.security.setCertificatePromise((resolve: any) => resolve(QZ_CERT));
  if (qz.security.setSignatureAlgorithm) qz.security.setSignatureAlgorithm("SHA512");
  // assina no SERVIDOR (online); offline → assinatura LOCAL. navigator.onLine === false → vai direto
  // no local (nem tenta o servidor). Online com timeout curto: se o /api/qz-sign não responde (queda
  // de net que o navegador ainda não marcou), NÃO pendura — cai no local. Antes pendurava e o QZ
  // nunca recebia a assinatura → não imprimia offline.
  qz.security.setSignaturePromise((toSign: string) => (resolve: any, reject: any) => {
    const local = () => signLocal(toSign).then(resolve).catch(reject);
    if (typeof navigator !== "undefined" && !navigator.onLine) { local(); return; }
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    fetch(`/api/qz-sign?request=${encodeURIComponent(toSign)}`, { signal: ctrl.signal })
      .then((r) => { clearTimeout(t); if (!r.ok) throw new Error("qz-sign " + r.status); return r.text(); })
      .then((sig) => { if (!sig) throw new Error("assinatura vazia"); resolve(sig); })
      .catch(() => { clearTimeout(t); local(); }); // timeout/rede/erro → assina local
  });
  qzMod = qz;
  return qzMod;
}

/** Aquece a chave de assinatura local ENQUANTO tem net — chamar só em loja com offline ligado, pra
 *  não cachear a chave em todo device (limita a exposição). Sem isso, offline não há como assinar. */
export const warmQzSignKey = () => ensureSignKey();

export async function qzConnect(): Promise<QZ> {
  const qz = await getQz();
  if (!qz.websocket.isActive()) await qz.websocket.connect({ retries: 1, delay: 1 });
  return qz;
}

export async function qzPrintHtml(printer: string, html: string): Promise<void> {
  const qz = await qzConnect();
  // Largura CALIBRÁVEL por máquina (print-config). A página do QZ e o corpo do cupom (ticket.ts)
  // usam o MESMO valor, então o conteúdo é AUTORADO na largura real da impressora — o sistema se
  // adapta à impressora. Se cortava na direita, o operador baixa a largura em Ajustes → Impressora.
  const width = getPrintWidthMm();
  const cfg = qz.configs.create(printer, { scaleContent: true, margins: 0, units: "mm", size: { width } });
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

// Avança o papel e CORTA (ESC/POS): ESC d 5 (feed 5 linhas, pro conteúdo passar da lâmina) + corte.
// modo "total" = GS V 0 (corte total, padrão — funciona na maioria). modo "parcial" = GS V 1 (deixa
// um filete unindo; modelos que IGNORAM o GS V 0 costumam aceitar o GS V 1). Escolhido por-estação
// em Ajustes → Impressora. Enviado só quando a estação está marcada "cortar papel" no print.ts.
export async function qzCutPaper(printer: string, mode: "total" | "parcial" = "total"): Promise<void> {
  const qz = await qzConnect();
  const cfg = qz.configs.create(printer, { encoding: "ISO-8859-1" });
  const cutCmd = mode === "parcial" ? "\x1B\x64\x05\x1D\x56\x01" : "\x1B\x64\x05\x1D\x56\x00";
  await qz.print(cfg, [{ type: "raw", format: "command", flavor: "plain", data: cutCmd }]);
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
