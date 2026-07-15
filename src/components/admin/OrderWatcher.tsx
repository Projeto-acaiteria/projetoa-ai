"use client";

import { useEffect, useRef, useCallback } from "react";
import { printVias } from "@/lib/print";
import { ticketHtml } from "@/lib/ticket";
import { ticketFromOrder } from "@/lib/order-ticket";
import type { Order } from "@/lib/orders-store";

// VIGIA GLOBAL de pedidos do link. Montado no layout do admin (fica vivo em TODA tela), então
// apita + imprime pedido novo de delivery/retirada mesmo se o operador estiver no Caixa (não só
// na tela Pedidos). Os toggles ficam na tela Pedidos e gravam no localStorage; aqui eu releio o
// estado a cada ciclo, então ligar/desligar lá vale aqui em até ~4s. Renderiza null (sem UI).
export default function OrderWatcher({ storeName, endereco, cnpj, tel, cupomRodape }: { storeName: string; endereco: string; cnpj: string; tel: string; cupomRodape: string }) {
  const lastId = useRef<number | null>(null); // maior id já visto; null = ainda sem baseline
  const audioCtx = useRef<AudioContext | null>(null);

  // bipe de novo pedido (Web Audio, sem arquivo) — 2 toques curtos
  const beep = useCallback(() => {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx.current = audioCtx.current ?? new Ctx();
      const ac = audioCtx.current;
      if (ac.state === "suspended") void ac.resume();
      [0, 0.18].forEach((t) => {
        const o = ac.createOscillator(); const g = ac.createGain();
        o.type = "sine"; o.frequency.value = 880;
        g.gain.setValueAtTime(0.001, ac.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + t + 0.15);
        o.connect(g); g.connect(ac.destination);
        o.start(ac.currentTime + t); o.stop(ac.currentTime + t + 0.16);
      });
    } catch { /* navegador sem áudio / sem gesto ainda — silencioso */ }
  }, []);

  const load = useCallback(async () => {
    try {
      // 1ª vez: pega só o MAIOR id atual (baseline leve, sem baixar o histórico nem tempestade
      // de impressão). Enquanto não tiver baseline, retenta aqui — rede instável não trava o vigia.
      if (lastId.current === null) {
        const res = await fetch("/api/pedidos?maxid=1", { cache: "no-store" });
        const data = await res.json();
        lastId.current = Number(data.maxId ?? 0);
        return;
      }
      // ciclos seguintes: só o que entrou DEPOIS do último id visto (quase sempre vazio)
      const res = await fetch(`/api/pedidos?desde=${lastId.current}`, { cache: "no-store" });
      const data = await res.json();
      // só pedidos já gravados por completo (id numérico) — ignora row em meio de escrita
      const novos: Order[] = (data.orders ?? []).filter((o: Order) => Number.isFinite(o?.id));
      if (!novos.length) return;
      lastId.current = Math.max(lastId.current, ...novos.map((o) => o.id));
      const novosLink = novos.filter((o) => o.mode !== "balcao");
      if (!novosLink.length) return;
      // relê os toggles a cada ciclo (mudança na tela Pedidos vale aqui sem remontar)
      const soundOn = localStorage.getItem("sound:caixa") !== "0";
      const autoPrint = localStorage.getItem("autoprint:caixa") !== "0";
      if (soundOn) beep();
      if (autoPrint) {
        for (const o of novosLink) {
          void printVias((via) => ticketHtml({ ...ticketFromOrder(o, storeName, { endereco, cnpj, tel, rodape: cupomRodape }), via }));
        }
      }
    } catch {
      /* mantém estado anterior — rede instável não pode derrubar o vigia */
    }
  }, [beep, storeName, endereco, cnpj, tel, cupomRodape]);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000); // mesmo ritmo da tela Pedidos
    return () => clearInterval(t);
  }, [load]);

  return null;
}
