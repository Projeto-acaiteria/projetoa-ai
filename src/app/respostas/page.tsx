/* Índice da central de respostas. Existe pra dar link interno às respostas (página órfã demora
   a ser indexada) e pro Google entender que elas são um conjunto (ItemList). */
import Link from "next/link";
import type { Metadata } from "next";
import { RESPOSTAS } from "@/lib/respostas";
import { BASE, CREAM, INK, MUT, INK_SOFT, ORG_LD, Ld, RespHeader, RespFooter, Crumbs } from "./ui";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Respostas — dúvidas de quem toca açaiteria, bar, pizzaria e restaurante | ComandaPRO",
  description:
    "Respostas diretas sobre preço de sistema, delivery sem comissão, comanda digital, venda por peso e pizza meio a meio.",
  alternates: { canonical: "/respostas" },
};

export default function RespostasIndex() {
  const dados = [
    ORG_LD,
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Respostas para quem administra negócio de food service",
      itemListElement: RESPOSTAS.map((r, i) => ({ "@type": "ListItem", position: i + 1, name: r.pergunta, url: `${BASE}/respostas/${r.slug}` })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "ComandaPRO", item: `${BASE}/` },
        { "@type": "ListItem", position: 2, name: "Respostas", item: `${BASE}/respostas` },
      ],
    },
  ];

  return (
    <main className="min-h-screen" style={{ background: CREAM, color: INK }}>
      <Ld data={dados} />
      <RespHeader />
      <div className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
        <Crumbs items={[{ nome: "ComandaPRO", href: "/" }, { nome: "Respostas" }]} />
        <h1 className="text-[2rem] font-extrabold leading-tight tracking-tight sm:text-5xl">Respostas</h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed sm:text-lg" style={{ color: MUT }}>
          As dúvidas que mais aparecem em conversa com dono de açaiteria, bar, pizzaria e restaurante.
          Respondidas direto — úteis mesmo pra quem não vai usar o sistema.
        </p>
        <div className="mt-10 space-y-3">
          {RESPOSTAS.map((r) => (
            <Link
              key={r.slug}
              href={`/respostas/${r.slug}`}
              className="block rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm transition hover:border-black/15"
            >
              <h2 className="text-base font-bold leading-snug sm:text-lg">{r.pergunta}</h2>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: INK_SOFT }}>{r.curta[0]}</p>
            </Link>
          ))}
        </div>
      </div>
      <RespFooter />
    </main>
  );
}
