"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { printTicket } from "@/lib/print";
import { stationTicketHtml } from "@/lib/ticket";
import { getStationPrinter } from "@/lib/qz";

// Vigia HEADLESS no Caixa: o Caixa (sempre aberto no balcão) vira a ESTAÇÃO DE IMPRESSÃO.
// Como o pedido pode vir de qualquer fonte (caixa/garçom/QR) e o celular do garçom/cliente NÃO
// imprime, a via de preparo tem que sair numa máquina com impressora que vigia os pedidos novos.
// Lê /api/kds (pedidos já roteados por estação) e imprime os pendentes novos na impressora de cada
// estação — SÓ se essa estação tem impressora configurada nesta máquina (senão pula, sem popup do
// navegador). Ligado por padrão; desliga ("0") em setup distribuído com telas Preparo próprias. — ComandaPRO 3.9
type KdsItem = { name: string; size_label: string | null; qty: number; mods: { name: string; price_cents: number }[] | null; note?: string | null };
type KdsOrder = { id: number; station: string; status: string; created_at: string; table_label: string; note: string | null; items: KdsItem[] };

export const CAIXA_PREP_KEY = "autoprint:caixa-preparo";

export default function CaixaPrepPrinter({ stations, loja }: { stations: string[]; loja: string }) {
  const [on, setOn] = useState(true);
  const printedRef = useRef<Set<number>>(new Set());
  const baselined = useRef(false);

  useEffect(() => {
    const read = () => setOn(localStorage.getItem(CAIXA_PREP_KEY) !== "0"); // default LIGADO
    read();
    window.addEventListener("storage", read);
    return () => window.removeEventListener("storage", read);
  }, []);

  const load = useCallback(async () => {
    if (!on || !stations.length) return;
    if (!stations.some((s) => getStationPrinter(s))) return; // só a máquina do caixa (com impressora de estação) vigia/imprime
    try {
      const r = await fetch(`/api/kds?stations=${encodeURIComponent(stations.join(","))}`, { cache: "no-store" });
      const d = await r.json();
      const list: KdsOrder[] = d.orders ?? [];
      // 1ª carga = baseline (não imprime o backlog); depois imprime só o que chega novo
      if (!baselined.current) {
        list.forEach((o) => printedRef.current.add(o.id));
        baselined.current = true;
        return;
      }
      for (const o of list) {
        if (o.status !== "pendente" || printedRef.current.has(o.id)) continue;
        printedRef.current.add(o.id); // marca já (mesmo se pular a impressão, não re-tenta em loop)
        if (!getStationPrinter(o.station)) continue; // sem impressora dessa estação AQUI → pula (sem iframe)
        void printTicket(
          stationTicketHtml({
            loja,
            station: o.station,
            tableLabel: o.table_label,
            dateLabel: new Date(o.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
            orderId: o.id,
            items: o.items.map((i) => ({ qty: i.qty, name: i.name, sizeLabel: i.size_label, mods: i.mods, note: i.note })),
            note: o.note,
          }),
          o.station,
        );
      }
    } catch {
      /* mantém — próxima rodada tenta de novo */
    }
  }, [on, stations, loja]);

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  return null; // headless
}
