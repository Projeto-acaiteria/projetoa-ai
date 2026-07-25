// Cache de LEITURA offline (Peça 1 do offline-first). Guarda o último snapshot bom de dados que o
// operador precisa ver quando a net cai: lista de mesas e a comanda aberta. Salvo SEMPRE que carrega
// online; servido quando o fetch falha (offline). IndexedDB cru, sem dependência nova.
// NÃO guarda dinheiro fechado — é só espelho de leitura pra a tela não ficar cega. Escrita continua
// na fila (offline-queue) com op_id (idempotência da Fatia 1).

const DB = "comandapro-cache";
const STORE = "reads";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "key" }); };
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

/** Salva um snapshot (chamar em toda carga ONLINE bem-sucedida). Nunca lança — cache é best-effort. */
export async function cacheSet(key: string, value: unknown): Promise<void> {
  try { await tx("readwrite", (s) => s.put({ key, value, at: Date.now() })); } catch { /* cota/indisp — ignora */ }
}

/** Lê o último snapshot (chamar quando o fetch falha por estar offline). null se nunca cacheou. */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const row = await tx<{ key: string; value: T; at: number } | undefined>("readonly", (s) => s.get(key));
    return row ? row.value : null;
  } catch { return null; }
}
