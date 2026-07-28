// Motor de fila OFFLINE (resiliência a quedas). Quando a net cai, a escrita vai pra uma fila local
// (IndexedDB) e dispara sozinha ao reconectar. Sem dependência nova — IndexedDB cru.
// λ.prova-na-fonte: write enfileirado NÃO leu a row no banco → é "pendente até sincronizar"; a UI
// tem que deixar isso claro. Só o Starteq usa (fluxos AT); food não chama isto.

export type QueuedWrite = { id: string; url: string; method: string; body: string; label: string; createdAt: number };

const DB = "comandapro-offline";
const STORE = "writes";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "id" }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDB().then((db) => new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    r.onsuccess = () => resolve(r.result as T);
    r.onerror = () => reject(r.error);
  }));
}

export const enqueue = (w: QueuedWrite) => tx<IDBValidKey>("readwrite", (s) => s.put(w));
export const getPending = () => tx<QueuedWrite[]>("readonly", (s) => s.getAll());
export const removePending = (id: string) => tx<undefined>("readwrite", (s) => s.delete(id));
export async function pendingCount(): Promise<number> {
  try { return (await getPending()).length; } catch { return 0; }
}

// id sem depender de crypto.randomUUID (nem sempre disponível): tempo + random
function newId(): string { return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`; }

// avisa o indicador (contador de pendentes) que a fila mudou
export const QUEUE_EVENT = "oq-changed";
function notifyChange() { if (typeof window !== "undefined") window.dispatchEvent(new Event(QUEUE_EVENT)); }

/** Envia agora (se online) ou enfileira (se offline / a net cair no meio).
 *  Retorna {ok:true,data} quando o servidor confirmou, ou {queued:true} quando ficou pendente. */
// fetch com TIMEOUT — navigator.onLine é falso-positivo (interface up, sem internet real): sem isso
// o fetch fica pendurado e a UI trava (botão "apagado"). Se estourar/abortar, vira falha de rede.
export async function fetchTimeout(url: string, init: RequestInit, ms = 5000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...init, signal: ctrl.signal }); }
  finally { clearTimeout(t); }
}

// queuedExtra: campos mesclados SÓ no corpo ENFILEIRADO (não no post online). Ex.: prePrinted=true —
// o replay avisa o servidor que a estação já foi impressa localmente no lançar offline, pra o vigia
// headless não reimprimir no sync. Online (post imediato) não leva isso: quem imprime é o vigia.
export async function submitOrQueue(url: string, body: unknown, label: string, queuedExtra?: Record<string, unknown>): Promise<{ ok: true; data: unknown } | { queued: true }> {
  const payload = JSON.stringify(body);
  // navigator.onLine === false é confiável (sem interface); === true NÃO garante internet → tenta com
  // timeout e cai pra fila se não responder. Assim não trava esperando um fetch que nunca volta.
  const maybeOnline = typeof navigator === "undefined" || navigator.onLine;
  if (maybeOnline) {
    try {
      const r = await fetchTimeout(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw Object.assign(new Error(d.error || "falha"), { server: true }); }
      return { ok: true, data: await r.json().catch(() => ({})) };
    } catch (e) {
      // erro do SERVIDOR (validação etc.) NÃO enfileira — repropaga; timeout/rede/abort enfileira
      if ((e as { server?: boolean }).server) throw e;
    }
  }
  const queuedBody = queuedExtra ? JSON.stringify({ ...(body as Record<string, unknown>), ...queuedExtra }) : payload;
  await enqueue({ id: newId(), url, method: "POST", body: queuedBody, label, createdAt: Date.now() });
  notifyChange();
  return { queued: true };
}

/** Drena a fila (chamar ao reconectar). Sucesso remove; erro de rede para (ainda offline);
 *  erro 4xx do servidor descarta (não vai passar); 5xx mantém (tenta depois). Retorna nº enviados. */
export async function flushQueue(): Promise<number> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return 0;
  let sent = 0;
  for (const w of await getPending()) {
    try {
      const r = await fetchTimeout(w.url, { method: w.method, headers: { "Content-Type": "application/json" }, body: w.body });
      if (r.ok) { await removePending(w.id); sent++; }
      else if (r.status >= 400 && r.status < 500) { await removePending(w.id); } // request inválido: não retorna
      // 5xx: mantém na fila pra próxima
    } catch { break; } // falha de rede: ainda offline, para o loop
  }
  if (sent > 0) notifyChange();
  return sent;
}

/** Remove os lançamentos OFFLINE de uma mesa (por NÚMERO) e re-enfileira UM com os itens que sobraram.
 *  Usado pra REMOVER um item de comanda aberta offline (ainda não sincronizada): como o item nunca
 *  chegou ao servidor, não há o que "cancelar" — só tirar da fila. Preserva pax/waiterId do 1º lançamento. */
export async function rebuildTableLancar(tableNumber: number, items: unknown[], queuedExtra?: Record<string, unknown>): Promise<void> {
  const all = await getPending();
  const isMine = (w: QueuedWrite) => {
    if (!w.url.includes("/api/mesas/lancar")) return false;
    try { return (JSON.parse(w.body) as { tableNumber?: number }).tableNumber === tableNumber; } catch { return false; }
  };
  const mine = all.filter(isMine);
  let base: Record<string, unknown> = {};
  if (mine[0]) { try { const b = JSON.parse(mine[0].body) as Record<string, unknown>; base = { pax: b.pax, waiterId: b.waiterId }; } catch {} }
  for (const w of mine) await removePending(w.id);
  if (items.length) {
    const opId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : newId();
    const body = JSON.stringify({ tableNumber, ...base, items, opId, ...(queuedExtra || {}) });
    await enqueue({ id: newId(), url: "/api/mesas/lancar", method: "POST", body, label: `Mesa ${tableNumber} · ${items.length} item(ns)`, createdAt: Date.now() });
  }
  notifyChange();
}
