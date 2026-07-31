"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/auth/client";

// Lado da TELA no tempo real: assina o canal da loja e chama de volta quando o servidor avisa que
// algo mudou. Devolve `conectado` — quem usa deve deixar o polling como REDE DE SEGURANÇA e só
// afrouxar o ritmo enquanto o canal está de pé. Wi-Fi de bar cai; o sistema não pode ficar cego.
//
// Junta avisos que chegam em rajada (lançar 5 itens = 5 toques) numa busca só.
export function useStorePulse(
  storeId: string | null | undefined,
  onPulse: (topic: string) => void,
  opts: { topics?: string[]; debounceMs?: number } = {},
): { conectado: boolean } {
  const { topics, debounceMs = 400 } = opts;
  const cb = useRef(onPulse);
  cb.current = onPulse;
  const topicsKey = (topics ?? []).join(",");
  const [conectado, setConectado] = useState(false);

  useEffect(() => {
    if (!storeId) return;
    const sb = createClient();
    const canal = sb.channel(`loja:${storeId}`);
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pendente: string | null = null;

    canal.on("broadcast", { event: "pulse" }, (msg) => {
      const t = String((msg.payload as { t?: string } | undefined)?.t ?? "");
      const querAssunto = !topicsKey || topicsKey.split(",").includes(t);
      if (!querAssunto) return;
      pendente = t;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { const x = pendente; pendente = null; if (x) cb.current(x); }, debounceMs);
    });

    canal.subscribe((status) => setConectado(status === "SUBSCRIBED"));

    return () => {
      if (timer) clearTimeout(timer);
      setConectado(false);
      void sb.removeChannel(canal);
    };
  }, [storeId, topicsKey, debounceMs]);

  return { conectado };
}
