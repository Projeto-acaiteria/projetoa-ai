"use client";

import { useEffect, useState } from "react";
import { IconBowl, IconArrowRight } from "@/components/Icons";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export default function InstallApp({ storeName }: { storeName: string }) {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // já instalado? não mostra
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    const ua = navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua);
    setIsIOS(ios);
    if (ios) setShow(true); // iOS não tem prompt — mostra instrução

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!show || dismissed) return null;

  async function instalar() {
    if (isIOS) {
      setIosHelp((v) => !v);
      return;
    }
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      setShow(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-4">
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-bg-elevated p-3 shadow-[var(--shadow-card)]">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl brand-gradient text-white">
          <IconBowl width={22} height={22} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-ink">Baixe o app do {storeName}</div>
          <div className="text-xs text-[var(--text-muted)]">Peça mais rápido, direto da tela inicial do celular.</div>
        </div>
        <button onClick={instalar} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl brand-gradient px-3.5 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-brand)]">
          Instalar <IconArrowRight width={15} height={15} />
        </button>
        <button onClick={() => setDismissed(true)} aria-label="Fechar" className="shrink-0 px-1 text-[var(--text-faded)]">×</button>
      </div>
      {isIOS && iosHelp && (
        <div className="mt-2 rounded-xl bg-bg-surface-2 p-3 text-xs text-ink-2">
          No iPhone: toque no botão <b>Compartilhar</b> (o quadrado com a seta pra cima) na barra do Safari e escolha <b>&quot;Adicionar à Tela de Início&quot;</b>.
        </div>
      )}
    </div>
  );
}
