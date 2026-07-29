"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/auth/client";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// Entrada do garçom em DOIS passos, na ordem que funciona nos dois sistemas:
//   1) INSTALAR o app (Android tem botão; iPhone é Compartilhar → Adicionar à Tela de Início)
//   2) abrir o ÍCONE e digitar o código de 6 dígitos
// A ordem importa: no iPhone o app instalado tem armazenamento separado do Safari, então logar no
// navegador antes de instalar deixaria o ícone deslogado com o código já queimado.
export default function GarcomEntrarClient() {
  const router = useRouter();
  const [instalado, setInstalado] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [jaLogado, setJaLogado] = useState<string | null>(null); // sessão que já existe NESTE aparelho
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    setInstalado(standalone);
    setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const handler = (e: Event) => { e.preventDefault(); setDeferred(e as BIPEvent); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => { if (instalado) inputRef.current?.focus(); }, [instalado]);

  // O app é UM por aparelho (manifesto da plataforma, escopo "/"). Se o celular já tem sessão — o
  // garçom de outra casa, ou o dono — o Android ainda manda o link do QR pra cá, e sem aviso o cara
  // acha que "abriu no app errado". Mostra quem está conectado e deixa trocar.
  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setJaLogado(data.user?.email ?? null));
  }, []);

  async function sairDaConta() {
    await createClient().auth.signOut();
    setJaLogado(null);
    setInstalado(true);
    router.refresh();
  }

  async function instalar() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
  }

  async function entrar() {
    const limpo = code.replace(/\D/g, "");
    if (limpo.length !== 6 || busy) return;
    setBusy(true); setErro("");
    try {
      const r = await fetch("/api/garcom/entrar", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: limpo }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Código inválido.");
      // a sessão nasce AQUI dentro (cookie do app instalado) — é o ponto do fluxo todo
      const { error } = await createClient().auth.signInWithPassword({ email: d.email, password: d.password });
      if (error) throw new Error("Não consegui te conectar. Peça um código novo.");
      router.replace("/admin/mesas");
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui te conectar.");
      setCode("");
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0B0A09] px-6 py-10 text-white">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-3xl font-extrabold tracking-tight">ComandaPRO</h1>
        <p className="mt-1 text-center text-sm text-white/50">Acesso do garçom</p>

        {jaLogado && (
          <div className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm">
            <p className="font-bold text-amber-300">Este celular já está conectado</p>
            <p className="mt-1 break-all text-white/70">{jaLogado}</p>
            <p className="mt-2 text-white/60">
              É um aparelho por conta. Digitar um código novo aqui <b className="text-white">troca</b> quem está usando este celular.
            </p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => router.push("/admin/mesas")} className="flex-1 rounded-xl border border-white/15 px-3 py-2.5 text-sm font-bold">
                Continuar como está
              </button>
              <button onClick={sairDaConta} className="flex-1 rounded-xl bg-white px-3 py-2.5 text-sm font-bold text-black">
                Trocar de conta
              </button>
            </div>
          </div>
        )}

        {!instalado ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-lg font-bold">1. Instale o aplicativo</div>
            <p className="mt-1 text-sm text-white/60">
              O código só funciona dentro do aplicativo instalado. Instale primeiro e depois abra pelo ícone.
            </p>

            {isIOS ? (
              <ol className="mt-4 space-y-2 text-sm text-white/80">
                <li>1. Toque em <b>Compartilhar</b> (o quadrado com a seta para cima)</li>
                <li>2. Escolha <b>Adicionar à Tela de Início</b></li>
                <li>3. Confirme em <b>Adicionar</b></li>
              </ol>
            ) : deferred ? (
              <button onClick={instalar} className="mt-4 w-full rounded-xl bg-white px-4 py-3.5 font-bold text-black active:scale-[0.99]">
                Instalar aplicativo
              </button>
            ) : (
              <ol className="mt-4 space-y-2 text-sm text-white/80">
                <li>1. Toque no menu <b>⋮</b> do navegador</li>
                <li>2. Escolha <b>Instalar aplicativo</b> (ou <b>Adicionar à tela inicial</b>)</li>
              </ol>
            )}

            <div className="mt-5 border-t border-white/10 pt-4 text-sm text-white/50">
              <b className="text-white/80">2. Abra pelo ícone</b> e digite o código de 6 números que o gerente te passou.
            </div>

            {/* saída de emergência: Android sem prompt de instalação, navegador que já instalou e não
                reporta standalone, ou teste. No iPhone o aviso é sério — entrar aqui gasta o código
                e o ícone abre deslogado, porque o app instalado não enxerga a sessão do Safari. */}
            <button
              onClick={() => setInstalado(true)}
              className="mt-4 w-full text-center text-xs font-semibold text-white/40 underline"
            >
              Já instalei — quero digitar o código
            </button>
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5">
            <label className="text-lg font-bold">Digite seu código</label>
            <p className="mt-1 text-sm text-white/60">Os 6 números que o gerente gerou pra você.</p>
            <input
              ref={inputRef}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => { if (e.key === "Enter") void entrar(); }}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              className="mt-4 w-full rounded-xl border border-white/15 bg-black/40 px-4 py-4 text-center text-3xl font-extrabold tracking-[0.4em] outline-none focus:border-white/40"
            />
            {erro && <p className="mt-3 text-sm font-semibold text-red-400">{erro}</p>}
            <button
              onClick={entrar}
              disabled={code.replace(/\D/g, "").length !== 6 || busy}
              className="mt-4 w-full rounded-xl bg-white px-4 py-3.5 font-bold text-black transition active:scale-[0.99] disabled:opacity-40"
            >
              {busy ? "Entrando…" : "Entrar"}
            </button>
            <p className="mt-4 text-center text-xs text-white/40">
              O código vale 30 minutos e serve uma vez só. Se venceu, peça outro pro gerente.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
