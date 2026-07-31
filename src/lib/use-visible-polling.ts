"use client";
import { useEffect, useRef } from "react";

// Polling que PARA quando ninguém está olhando (28/07: 1,2M de invocações/mês na Vercel, com o
// limite em 1M — o piso subia mesmo em dia sem operação, porque tela aberta pergunta igual).
//
// Regras:
// - aba oculta / celular no bolso / monitor apagado → para de perguntar
// - ao voltar a ficar visível → responde NA HORA (não espera o próximo ciclo), então ninguém vê
//   dado velho por ter minimizado
// - o callback vive num ref: trocar a função não reinicia o ciclo nem duplica timer
export function useVisiblePolling(cb: () => void, ms: number) {
  const ref = useRef(cb);
  ref.current = cb;

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => { if (!timer) timer = setInterval(() => ref.current(), ms); };
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
    const onVis = () => {
      if (document.visibilityState === "visible") { ref.current(); start(); } else stop();
    };

    ref.current(); // primeira carga sempre
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVis);
    return () => { stop(); document.removeEventListener("visibilitychange", onVis); };
  }, [ms]);
}

// Ritmo do polling, num lugar só. Antes: mesas 5s, pedidos 4s, preparo 8s — uma tela aberta 24h
// fazia ~39 mil chamadas/dia sozinha. Estes números cortam ~60% sem que o salão perceba: a tela de
// quem AGE atualiza na resposta da própria ação; o intervalo só serve pro outro aparelho descobrir.
export const POLL = {
  mesas: 12_000,
  pedidos: 10_000,
  preparo: 15_000,
} as const;

// Com o TEMPO REAL de pé (31/07), o polling deixa de ser o mecanismo e vira REDE DE SEGURANÇA:
// o servidor avisa, a tela busca. O ciclo lento só existe pra cobrir websocket caído/bloqueado —
// wi-fi de bar cai, e o sistema não pode ficar cego. Use: conectado ? POLL_REDE : POLL.x
export const POLL_REDE = 60_000;
