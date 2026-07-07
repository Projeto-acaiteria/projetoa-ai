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
export async function submitOrQueue(url: string, body: unknown, label: string): Promise<{ ok: true; data: unknown } | { queued: true }> {
  const payload = JSON.stringify(body);
  if (typeof navigator !== "undefined" && navigator.onLine) {
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw Object.assign(new Error(d.error || "falha"), { server: true }); }
      return { ok: true, data: await r.json().catch(() => ({})) };
    } catch (e) {
      // erro do SERVIDOR (validação etc.) NÃO enfileira — repropaga; só falha de REDE enfileira
      if ((e as { server?: boolean }).server) throw e;
    }
  }
  await enqueue({ id: newId(), url, method: "POST", body: payload, label, createdAt: Date.now() });
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
      const r = await fetch(w.url, { method: w.method, headers: { "Content-Type": "application/json" }, body: w.body });
      if (r.ok) { await removePending(w.id); sent++; }
      else if (r.status >= 400 && r.status < 500) { await removePending(w.id); } // request inválido: não retorna
      // 5xx: mantém na fila pra próxima
    } catch { break; } // falha de rede: ainda offline, para o loop
  }
  if (sent > 0) notifyChange();
  return sent;
}
