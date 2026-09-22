/* ═══════════════════════════════════════════════════════════════
   PÁGINA DE RESPOSTA — uma pergunta, uma URL (padrão do AgendaPRO)

   Feita pra ser citada, não pra ser bonita:
   · H1 é a pergunta escrita como a pessoa digita
   · logo abaixo, a resposta curta isolada — é o que a IA copia
   · profundidade depois, FAQ no fim, CTA discreta
   · schema Article + FAQPage + Breadcrumb

   CTA discreta de propósito: página que vende no meio da resposta é lida
   como publicidade e não é citada.
   ═══════════════════════════════════════════════════════════════ */
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RESPOSTAS, getResposta } from "@/lib/respostas";
import { getNicho } from "@/config/marketing";
import { BILLING } from "@/config/billing";
import { ACCENT, BASE, CREAM, INK, MUT, INK_SOFT, ORG_LD, Ld, RespHeader, RespFooter, Crumbs } from "../ui";

export const dynamic = "force-static";
export const dynamicParams = false; // só as respostas que existem; o resto é 404

export function generateStaticParams() {
  return RESPOSTAS.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const r = getResposta(slug);
  if (!r) return {};
  return {
    title: r.tituloSeo,
    description: r.descricaoSeo,
    alternates: { canonical: `/respostas/${r.slug}` },
    openGraph: { title: r.tituloSeo, description: r.descricaoSeo, url: `${BASE}/respostas/${r.slug}`, type: "article" },
  };
}

export default async function RespostaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = getResposta(slug);
  if (!r) notFound();

  const url = `${BASE}/respostas/${r.slug}`;
  const seg = r.segmento ? getNicho(r.segmento) : undefined;
  const relacionadas = r.relacionadas.map(getResposta).filter((x) => x !== undefined);

  const dados = [
    ORG_LD,
    {
      "@context": "https://schema.org",
      "@type": "Article",
      "@id": `${url}#article`,
      headline: r.pergunta,
      description: r.descricaoSeo,
      inLanguage: "pt-BR",
      mainEntityOfPage: url,
      author: { "@id": `${BASE}/#organization` },
      publisher: { "@id": `${BASE}/#organization` },
      articleSection: "Gestão de food service",
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: r.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "ComandaPRO", item: `${BASE}/` },
        { "@type": "ListItem", position: 2, name: "Respostas", item: `${BASE}/respostas` },
        { "@type": "ListItem", position: 3, name: r.pergunta, item: url },
      ],
    },
  ];

  return (
    <main className="min-h-screen" style={{ background: CREAM, color: INK }}>
      <Ld data={dados} />
      <RespHeader />
      <div className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
        <Crumbs items={[{ nome: "ComandaPRO", href: "/" }, { nome: "Respostas", href: "/respostas" }]} />

        <h1 className="text-[1.75rem] font-extrabold leading-tight tracking-tight sm:text-[2.5rem]">{r.pergunta}</h1>

        {/* Resposta curta — o que a IA cita. Tem que se sustentar sozinha. */}
        <div className="mt-6 rounded-2xl border bg-white p-5 shadow-sm sm:p-6" style={{ borderColor: `${ACCENT}40` }}>
          <div className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: ACCENT }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: ACCENT }} /> Resposta direta
          </div>
          {r.curta.map((p, i) => (
            <p key={i} className={i === 0 ? "text-base font-semibold leading-relaxed sm:text-lg" : "mt-3 text-sm leading-relaxed sm:text-base"} style={{ color: i === 0 ? INK : INK_SOFT }}>
              {p}
            </p>
          ))}
        </div>

        <article className="mt-10 space-y-9">
          {r.blocos.map((b) => (
            <section key={b.h}>
              <h2 className="mb-3 text-lg font-bold leading-tight sm:text-xl">{b.h}</h2>
              <div className="space-y-3">
                {b.p.map((p, i) => (
                  <p key={i} className="text-sm leading-relaxed sm:text-base" style={{ color: INK_SOFT }}>{p}</p>
                ))}
              </div>
            </section>
          ))}
        </article>

        <section className="mt-12">
          <h2 className="mb-4 text-lg font-bold sm:text-xl">Perguntas relacionadas</h2>
          <div className="space-y-3">
            {r.faqs.map((f) => (
              <div key={f.q} className="rounded-xl border border-black/[0.06] bg-white p-4 sm:p-5">
                <h3 className="mb-2 text-sm font-semibold sm:text-base">{f.q}</h3>
                <p className="text-sm leading-relaxed" style={{ color: INK_SOFT }}>{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA discreta, no fim */}
        <section className="mt-12 rounded-2xl border border-black/[0.06] bg-white p-5 sm:p-6">
          <h2 className="mb-2 text-base font-bold sm:text-lg">Cardápio, comanda, delivery e caixa num sistema só</h2>
          <p className="mb-4 text-sm leading-relaxed" style={{ color: MUT }}>
            ComandaPRO: R$ {BILLING.planos.mensal.equivMes}/mês, sem comissão sobre as vendas e sem taxa de implantação.
            {" "}{BILLING.trialDias} dias grátis pra testar.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/cadastro" className="inline-flex items-center rounded-full px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90" style={{ background: ACCENT }}>
              Testar {BILLING.trialDias} dias grátis
            </Link>
            <Link href={seg ? `/segmentos/${seg.slug}` : "/"} className="inline-flex items-center rounded-full border border-black/10 bg-white px-5 py-2.5 text-sm font-bold transition hover:bg-[#FFF3E6]">
              {seg ? `Ver o sistema para ${seg.nome}` : "Ver o sistema"}
            </Link>
          </div>
        </section>

        {relacionadas.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-4 text-base font-bold sm:text-lg">Leia também</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {relacionadas.map((o) => (
                <Link key={o.slug} href={`/respostas/${o.slug}`} className="rounded-xl border border-black/[0.06] bg-white p-4 text-sm font-semibold leading-snug transition hover:border-black/15">
                  {o.pergunta}
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
      <RespFooter />
    </main>
  );
}
