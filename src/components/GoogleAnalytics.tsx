/* ═══════════════════════════════════════════════════════════════
   GOOGLE ANALYTICS (GA4) — portado do AgendaPRO em 22/09/2026

   Serve pra duas coisas:
   1. medir de onde vem a visita do site (home, segmentadas, /respostas)
   2. verificar a posse no Search Console pelo método "Google Analytics",
      sem precisar de tag HTML separada

   ⚠️ SÓ NAS PÁGINAS PÚBLICAS. Fica fora do painel do dono, do app do garçom,
   do painel do operador e da área de pontos do cliente final: URL de painel
   carrega id de loja/pedido e a área de pontos é do cliente da loja. Isso
   não vai pro Google.

   ⚠️ Sem NEXT_PUBLIC_GA_ID, não renderiza nada — dev e preview ficam
   desligados sozinhos.

   ⚠️ <script> CRU, não next/script: no AgendaPRO o next/script sumia com o
   inline de inicialização e o gtag não mandava hit (tag "instalada", Tempo
   real zerado). Com script cru os dois saem no HTML e dá pra provar por curl.
   ═══════════════════════════════════════════════════════════════ */
"use client";

import { usePathname } from "next/navigation";

const AREAS_PRIVADAS = ["/admin", "/garcom", "/sistema", "/entrar", "/login", "/meus-pontos", "/doc"];

export default function GoogleAnalytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  const pathname = usePathname() ?? "/";

  if (!gaId) return null;
  if (AREAS_PRIVADAS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  return (
    <>
      <script async src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} />
      <script
        dangerouslySetInnerHTML={{
          __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`,
        }}
      />
    </>
  );
}
