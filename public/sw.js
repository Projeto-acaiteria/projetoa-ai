// Service worker mínimo — habilita instalação do PWA e um cache básico.
// v2: ao ativar, APAGA caches antigos. Sem isso, o bundle JS novo convivia com o payload de PÁGINA
// velho (RSC) → props como offline_enabled chegavam desatualizadas. Bump de versão = limpeza forçada.
const CACHE = "acai-v2";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(
  caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()),
));

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request)),
  );
});
