"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, StatCard, Badge } from "@/components/admin/ui";
import { IconUsers, IconStar, IconClock, IconWhatsapp } from "@/components/Icons";

type Cliente = { phone: string; name: string; points: number; birthday: string | null; lastOrderDate: string | null; orderCount: number };

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const SUMIDO_DIAS = 40;

function diasDesde(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}
const waLink = (phone: string, msg: string) => {
  const p = phone.startsWith("55") ? phone : `55${phone}`;
  return `https://wa.me/${p}?text=${encodeURIComponent(msg)}`;
};

export default function ClientesClient({ storeName }: { storeName: string }) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<"todos" | "aniversariantes" | "sumidos">("todos");
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/api/clientes", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setClientes(d.customers ?? []))
      .finally(() => setLoaded(true));
  }, []);

  const mesAtual = new Date().getMonth(); // 0-11
  const isAniversariante = (c: Cliente) => c.birthday && parseInt(c.birthday.slice(5, 7), 10) - 1 === mesAtual;
  const isSumido = (c: Cliente) => {
    const d = diasDesde(c.lastOrderDate);
    return d !== null && d >= SUMIDO_DIAS;
  };

  const aniversariantes = useMemo(() => clientes.filter(isAniversariante), [clientes, mesAtual]);
  const sumidos = useMemo(() => clientes.filter(isSumido), [clientes]);

  const lista = useMemo(() => {
    const base = tab === "aniversariantes" ? aniversariantes : tab === "sumidos" ? sumidos : clientes;
    const t = q.trim().toLowerCase();
    const dig = q.replace(/\D+/g, "");
    return base
      .filter((c) => !t || c.name.toLowerCase().includes(t) || (dig && c.phone.includes(dig)))
      .sort((a, b) => (b.lastOrderDate ?? "").localeCompare(a.lastOrderDate ?? ""));
  }, [tab, q, clientes, aniversariantes, sumidos]);

  function msgFor(c: Cliente): string {
    if (tab === "aniversariantes" || (tab === "todos" && isAniversariante(c)))
      return `Oi ${c.name}! Esse mês é especial: é o seu aniversário! A ${storeName} quer comemorar com você — passa aqui que tem açaí no capricho te esperando. Parabéns!`;
    if (tab === "sumidos" || (tab === "todos" && isSumido(c)))
      return `Oi ${c.name}! Faz um tempo que você não aparece na ${storeName} e a gente sentiu sua falta. Volta que tem açaí fresquinho${c.points ? ` e seus ${c.points} pontos` : ""} te esperando!`;
    return `Oi ${c.name}! Aqui é da ${storeName}.${c.points ? ` Você tem ${c.points} pontos acumulados.` : ""}`;
  }

  const TABS = [
    { k: "todos", label: "Todos", count: clientes.length },
    { k: "aniversariantes", label: `Aniversariantes de ${MESES[mesAtual]}`, count: aniversariantes.length },
    { k: "sumidos", label: "Sumidos", count: sumidos.length },
  ] as const;

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Clientes" value={String(clientes.length)} hint="cadastrados" Icon={IconUsers} tone="brand" />
        <StatCard label={`Aniversário (${MESES[mesAtual]})`} value={String(aniversariantes.length)} hint="comemore com cupom" Icon={IconStar} tone="accent" />
        <StatCard label="Sumidos" value={String(sumidos.length)} hint={`sem comprar há ${SUMIDO_DIAS}+ dias`} Icon={IconClock} tone="gold" />
      </div>

      {/* abas + busca */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t.k} onClick={() => setTab(t.k)} className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-bold transition ${tab === t.k ? "border-transparent brand-gradient text-white shadow-[var(--shadow-brand)]" : "border-line bg-bg-elevated text-ink-2"}`}>
              {t.label}
              <span className={tab === t.k ? "text-white/80" : "text-[var(--text-faded)]"}>{t.count}</span>
            </button>
          ))}
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nome ou telefone..." className="w-full rounded-xl border border-line bg-bg-elevated px-4 py-2.5 text-sm outline-none focus:border-brand-600 sm:w-64" />
      </div>

      {tab === "aniversariantes" && aniversariantes.length > 0 && (
        <div className="mt-4 rounded-xl bg-[#FBF1DC] p-3 text-sm text-accent">
          {aniversariantes.length} cliente{aniversariantes.length === 1 ? "" : "s"} fazem aniversário em {MESES[mesAtual]}. Mande um carinho no WhatsApp — carinho + oferta = volta certa.
        </div>
      )}
      {tab === "sumidos" && sumidos.length > 0 && (
        <div className="mt-4 rounded-xl bg-[#FBF1DC] p-3 text-sm text-gold">
          {sumidos.length} cliente{sumidos.length === 1 ? "" : "s"} sem comprar há mais de {SUMIDO_DIAS} dias. Chame de volta com uma mensagem.
        </div>
      )}

      {/* lista */}
      <div className="mt-4 space-y-2">
        {loaded && lista.length === 0 && (
          <div className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-[var(--text-muted)]">Nenhum cliente aqui.</div>
        )}
        {lista.map((c) => {
          const dias = diasDesde(c.lastOrderDate);
          return (
            <Card key={c.phone} className="flex flex-wrap items-center gap-3 p-3.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-bg-surface-2 text-brand-600">
                <IconUsers width={18} height={18} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-ink">{c.name}</span>
                  {isAniversariante(c) && <Badge tone="accent">aniversário</Badge>}
                  {isSumido(c) && <Badge tone="gold">sumido</Badge>}
                </div>
                <div className="text-xs text-[var(--text-muted)]">{c.phone}</div>
              </div>
              <div className="text-right text-xs text-[var(--text-muted)]">
                <div><b className="text-brand-600">{c.points}</b> pts</div>
                <div>
                  {c.birthday ? `nasc. ${c.birthday.slice(8, 10)}/${c.birthday.slice(5, 7)}` : "sem aniversário"}
                </div>
                <div>{dias === null ? "nunca comprou" : dias === 0 ? "comprou hoje" : `há ${dias} dia${dias === 1 ? "" : "s"}`}</div>
              </div>
              <a href={waLink(c.phone, msgFor(c))} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl brand-gradient px-3.5 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-brand)]">
                <IconWhatsapp width={16} height={16} /> WhatsApp
              </a>
            </Card>
          );
        })}
      </div>
    </>
  );
}
