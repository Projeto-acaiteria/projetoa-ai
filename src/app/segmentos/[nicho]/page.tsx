import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { IconArrowRight, IconMoto, IconTable, IconWallet } from "@/components/Icons";
import { NICHOS, getNicho, type Nicho } from "@/config/marketing";
import { NAVY, ACCENT, SiteGlows, SiteNav, PhoneFrame, BrowserFrame, Pill, PrecoSection, FaqSection, CtaFinal, SiteFooter, JsonLd } from "@/components/site/parts";

export const dynamic = "force-static";
export function generateStaticParams() {
  return NICHOS.map((n) => ({ nicho: n.slug }));
}
export async function generateMetadata({ params }: { params: Promise<{ nicho: string }> }): Promise<Metadata> {
  const { nicho } = await params;
  const n = getNicho(nicho);
  if (!n) return { title: "Segmento — ComandaPRO" };
  return {
    title: n.seoTitle,
    description: n.seoDescription,
    alternates: { canonical: `/segmentos/${n.slug}` },
    openGraph: { title: n.seoTitle, description: n.seoDescription, type: "website" },
  };
}

const INCLUSO = [
  "Cardápio digital + delivery próprio",
  "Comanda, mesa e app do garçom",
  "Cozinha (KDS) e impressão térmica",
  "Balcão / PDV e caixa unificado",
  "Estoque com baixa automática",
  "Fidelidade por pontos",
];

// Bloco de funcionalidade com print real (mesmo método do site-mãe).
function FeatureRow({ n, eyebrow, Icon, title, accent, desc, pills, img, reverse }: {
  n: string; eyebrow: string; Icon: React.ComponentType<{ width?: number; height?: number }>; title: string; accent: string; desc: string; pills: string[]; img: string; reverse?: boolean;
}) {
  return (
    <div className={`grid items-center gap-10 lg:grid-cols-2 ${reverse ? "lg:[&>*:first-child]:order-2" : ""}`}>
      <div>
        <div className="mb-4 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider" style={{ color: ACCENT }}>
          <Icon width={16} height={16} /> {n} · {eyebrow}
        </div>
        <h3 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">{title} <span style={{ color: ACCENT }}>{accent}</span></h3>
        <p className="mt-4 max-w-md text-slate-300">{desc}</p>
        <div className="mt-5 flex flex-wrap gap-2">{pills.map((p) => <Pill key={p} label={p} />)}</div>
      </div>
      <div className="flex justify-center"><BrowserFrame src={img} alt={`${eyebrow} no ComandaPRO`} /></div>
    </div>
  );
}

function SegmentLP({ nicho: n }: { nicho: Nicho }) {
  return (
    <main className="relative min-h-screen overflow-hidden text-white" style={{ background: NAVY }}>
      <SiteGlows />
      <SiteNav />

      {/* HERO */}
      <section className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-10 lg:grid-cols-2 lg:pt-16">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[13px] font-semibold text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: ACCENT }} /> {n.nome}
          </div>
          <h1 className="text-[2.4rem] font-extrabold leading-[1.06] tracking-tight sm:text-5xl">
            {n.heroH1}<br /><span style={{ color: ACCENT }}>{n.heroAccent}</span>
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-slate-300">{n.heroSub}</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/cadastro" className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-bold text-white transition hover:opacity-90" style={{ background: ACCENT, boxShadow: `0 12px 34px ${ACCENT}66` }}>
              Começar agora <IconArrowRight width={18} height={18} />
            </Link>
            <a href="#precos" className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-6 py-3.5 text-[15px] font-bold text-white transition hover:bg-white/[0.07]">Ver preço</a>
          </div>
          <div className="mt-8 flex flex-wrap gap-2">{n.destaques.map((d) => <Pill key={d} label={d} />)}</div>
        </div>
        <div className="flex justify-center lg:justify-end">
          {n.cardapioImg ? (
            <PhoneFrame src={n.cardapioImg} alt={`Cardápio de ${n.nome} no ComandaPRO`} caption={n.cardapioCaption} />
          ) : (
            <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/[0.03] p-8" style={{ boxShadow: `0 30px 80px -30px ${ACCENT}55` }}>
              <div className="text-sm font-bold uppercase tracking-wider" style={{ color: ACCENT }}>Feito pra {n.nome}</div>
              <ul className="mt-4 space-y-3">
                {n.destaques.map((d) => (
                  <li key={d} className="flex items-center gap-2.5 text-slate-200"><span style={{ color: ACCENT }}>›</span> {d}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* DOR */}
      <section className="relative z-10 mx-auto max-w-5xl px-5 py-16">
        <h2 className="text-center text-2xl font-extrabold tracking-tight sm:text-3xl">A rotina de quem toca {n.nome.toLowerCase()}</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {n.dores.map((d) => (
            <div key={d} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm leading-relaxed text-slate-300">{d}</div>
          ))}
        </div>
        <p className="mt-8 text-center text-lg font-semibold text-slate-300">O ComandaPRO resolve as três — <span style={{ color: ACCENT }}>num sistema só.</span></p>
      </section>

      {/* FUNCIONALIDADES (prints reais, iguais aos da mãe) */}
      <section id="funcionalidades" className="relative z-10 mx-auto max-w-6xl space-y-16 px-5 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-bold uppercase tracking-wider" style={{ color: ACCENT }}>Como funciona</span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Do pedido ao caixa, sem trocar de sistema</h2>
        </div>
        <FeatureRow n="01" eyebrow="Delivery próprio" Icon={IconMoto} title="Todo pedido cai no seu balcão." accent="Zero comissão." desc="Entrega pelo seu link, com sua taxa por bairro. O cliente escolhe Pix, cartão ou dinheiro com troco e acompanha por código de rastreio. Entrou pedido, o sistema apita e imprime sozinho." pills={["0% de comissão", "Taxa por bairro", "Rastreio por código", "Apita e imprime"]} img="/site/tela-pedidos.jpg" />
        <FeatureRow n="02" eyebrow="Comanda & mesa" Icon={IconTable} title="Cada mesa com a conta certa," accent="na hora." desc="Comanda por mesa, o garçom lança pelo celular e cada item vai roteado pra cozinha ou pro bar. A conta divide sem erro na hora de fechar." pills={["Comanda por mesa", "App do garçom", "Divisão de conta"]} img="/site/tela-mesas.jpg" reverse />
        <FeatureRow n="03" eyebrow="Caixa & gestão" Icon={IconWallet} title="Você fecha o dia com número na mão," accent="não no achismo." desc="Toda venda — mesa, balcão e delivery — cai no mesmo caixa. Você vê a receita por forma de pagamento, o que saiu do estoque e o lucro do período." pills={["Caixa unificado", "Receita por forma de pagamento", "Baixa de estoque + CMV"]} img="/site/tela-financeiro.jpg" />
      </section>

      <PrecoSection incluso={INCLUSO} />
      <FaqSection faqs={n.faqs} />
      <CtaFinal heading={`Bota sua ${n.nome.toLowerCase()} num sistema só.`} />
      <SiteFooter />
      <JsonLd name={`ComandaPRO para ${n.nome}`} faqs={n.faqs} />
    </main>
  );
}

export default async function SegmentoPage({ params }: { params: Promise<{ nicho: string }> }) {
  const { nicho } = await params;
  const n = getNicho(nicho);
  if (!n) notFound();
  return <SegmentLP nicho={n} />;
}
