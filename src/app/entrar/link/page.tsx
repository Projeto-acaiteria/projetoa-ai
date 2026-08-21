"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/auth/client";
import { Logo } from "@/components/site/Logo";

// Entrada por LINK (magiclink) pro dono da loja. O app só tinha isso pro garçom
// (GarcomEntrarClient) — o /login cria o cliente Supabase dentro do submit, então link nenhum se
// resolvia sozinho. Serve pra suporte: a gente gera o link com a service key e entra na conta do
// cliente pra ver a tela que ELE vê, sem pedir senha e sem trocar a senha dele (trocar senha mata
// as sessões e derruba o cara no meio do serviço).
//
// Segurança: o token_hash só é emitido por quem tem a service_role key, é de uso único e expira —
// mesma confiança do fluxo do garçom. `next` só aceita caminho interno (nada de open redirect).
function EntrarPorLink() {
  const router = useRouter();
  const params = useSearchParams();
  const [erro, setErro] = useState<string | null>(null);
  const rodou = useRef(false); // token é de uso único: StrictMode não pode gastar duas vezes

  useEffect(() => {
    if (rodou.current) return;
    rodou.current = true;

    const tokenHash = params.get("token_hash");
    const destinoRaw = params.get("next") ?? "/entrar";
    const destino = destinoRaw.startsWith("/") && !destinoRaw.startsWith("//") ? destinoRaw : "/entrar";

    if (!tokenHash) {
      setErro("Link inválido — falta o token.");
      return;
    }

    (async () => {
      const { error } = await createClient().auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
      if (error) {
        setErro("Link expirado ou já usado. Peça um novo.");
        return;
      }
      router.replace(destino);
      router.refresh();
    })();
  }, [params, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <Logo />
      {erro ? (
        <>
          <p className="text-sm font-semibold text-[var(--red-no)]">{erro}</p>
          <a href="/login" className="text-xs underline opacity-70">
            Entrar com e-mail e senha
          </a>
        </>
      ) : (
        <p className="text-sm opacity-70">Entrando…</p>
      )}
    </div>
  );
}

export default function EntrarPorLinkPage() {
  return (
    <Suspense fallback={null}>
      <EntrarPorLink />
    </Suspense>
  );
}
