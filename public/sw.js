// Service worker mínimo — habilita instalação do PWA e um cache básico.
// v2: ao ativar, APAGA caches antigos. Sem isso, o bundle JS novo convivia com o payload de PÁGINA
// velho (RSC) → props como offline_enabled chegavam desatualizadas. Bump de versão = limpeza forçada.
const CACHE = "acai-v6";

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
      .catch(async () => {
        // offline: serve do cache. Se a página não foi cacheada, NUNCA deixa dar ERR_FAILED —
        // pra navegação, cai na última tela de app cacheada (Mesas é a de operação); pra o resto,
        // uma resposta 503 leve. Assim o PWA não trava numa tela branca de erro do navegador.
        const cached = await caches.match(e.request);
        if (cached) return cached;
        if (e.request.mode === "navigate") {
          const shell = (await caches.match("/admin/mesas")) || (await caches.match("/admin")) || (await caches.match("/"));
          if (shell) return shell;
        }
        return new Response("Offline — reconecte para carregar esta tela.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      }),
  );
});
