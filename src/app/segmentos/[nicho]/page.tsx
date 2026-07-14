import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { IconArrowRight, IconMoto, IconTable, IconWallet } from "@/components/Icons";
import { NICHOS, getNicho, type Nicho } from "@/config/marketing";
import { ACCENT, CREAM, INK, MUT, PANEL_COLORS, SiteGlows, SiteNav, PhoneFrame, ColorPanel, Pill, PrecoSection, FaqSection, CtaFinal, SiteFooter, JsonLd } from "@/components/site/parts";
import { Reveal } from "@/components/site/Reveal";
import CadastroModal from "@/components/site/CadastroModal";

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

function SegmentLP({ nicho: n }: { nicho: Nicho }) {
  return (
    <main className="relative min-h-screen overflow-hidden" style={{ background: CREAM, color: INK }}>
      <SiteGlows />
      <SiteNav />

      {/* HERO */}
      <section className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-10 lg:grid-cols-2 lg:pt-14">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-black/[0.06] bg-white px-3 py-1.5 text-[13px] font-semibold shadow-sm" style={{ color: MUT }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: ACCENT }} /> {n.nome}
          </div>
          <h1 className="text-[2.4rem] font-extrabold leading-[1.06] tracking-tight sm:text-5xl" style={{ color: INK }}>
            {n.heroH1}<br />
            <span className="relative inline-block" style={{ color: INK }}>
              <span className="absolute inset-x-[-6px] bottom-1.5 -z-10 h-4 -rotate-1 rounded-sm sm:h-5" style={{ background: "#FDE68A" }} />
              {n.heroAccent}
            </span>
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed" style={{ color: MUT }}>{n.heroSub}</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/cadastro" className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-bold text-white transition hover:opacity-90" style={{ background: ACCENT, boxShadow: `0 12px 34px ${ACCENT}66` }}>
              Começar agora <IconArrowRight width={18} height={18} />
            </Link>
            <a href="#precos" className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-6 py-3.5 text-[15px] font-bold shadow-sm transition hover:bg-[#FFF3E6]" style={{ color: INK }}>Ver preço</a>
          </div>
          <div className="mt-8 flex flex-wrap gap-2">{n.destaques.map((d) => <Pill key={d} label={d} />)}</div>
        </div>
        <div className="flex justify-center lg:justify-end">
          {n.cardapioImg ? (
            <PhoneFrame src={n.cardapioImg} alt={`Cardápio de ${n.nome} no ComandaPRO`} caption={n.cardapioCaption} />
          ) : (
            <div className="w-full max-w-sm rounded-3xl border border-black/[0.06] bg-white p-8 shadow-sm" style={{ boxShadow: `0 30px 80px -30px ${ACCENT}55` }}>
              <div className="text-sm font-bold uppercase tracking-wider" style={{ color: ACCENT }}>Feito pra {n.nome}</div>
              <ul className="mt-4 space-y-3">
                {n.destaques.map((d) => (
                  <li key={d} className="flex items-center gap-2.5" style={{ color: INK }}><span style={{ color: ACCENT }}>›</span> {d}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* DOR */}
      <section className="relative z-10 mx-auto max-w-5xl px-5 py-16">
        <h2 className="text-center text-2xl font-extrabold tracking-tight sm:text-3xl" style={{ color: INK }}>A rotina de quem toca {n.nome.toLowerCase()}</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {n.dores.map((d) => (
            <div key={d} className="rounded-2xl border border-black/[0.06] bg-white p-5 text-sm leading-relaxed text-[#5A4F45] shadow-sm">{d}</div>
          ))}
        </div>
        <p className="mt-8 text-center text-lg font-semibold text-[#5A4F45]">O ComandaPRO resolve as três — <span style={{ color: ACCENT }}>num sistema só.</span></p>
      </section>

      {/* FUNCIONALIDADES — painéis coloridos (estilo Expresso), com print real */}
      <section id="funcionalidades" className="relative z-10 mx-auto max-w-6xl space-y-8 px-5 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-bold uppercase tracking-wider" style={{ color: ACCENT }}>Como funciona</span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl" style={{ color: INK }}>Do pedido ao caixa, sem trocar de sistema</h2>
        </div>
        <ColorPanel
          color={PANEL_COLORS[0]} eyebrow="01 · Delivery próprio" EyeIcon={IconMoto}
          title="Todo pedido cai no seu balcão." accent="Zero comissão."
          desc="Entrega pelo seu link, com sua taxa por bairro. O cliente escolhe Pix, cartão ou dinheiro com troco e acompanha por código de rastreio. Entrou pedido, o sistema apita e imprime sozinho."
          pills={["0% de comissão", "Taxa por bairro", "Rastreio por código", "Apita e imprime"]}
          img="/site/tela-pedidos.jpg" imgAlt="Painel de pedidos de delivery no ComandaPRO"
        />
        <ColorPanel
          color={PANEL_COLORS[1]} eyebrow="02 · Comanda & mesa" EyeIcon={IconTable} reverse
          title="Cada mesa com a conta certa," accent="na hora."
          desc="Comanda por mesa, o garçom lança pelo celular e cada item vai roteado pra cozinha ou pro bar. A conta divide sem erro na hora de fechar."
          pills={["Comanda por mesa", "App do garçom", "Divisão de conta"]}
          img="/site/tela-mesas.jpg" imgAlt="Mapa de mesas com comandas abertas no ComandaPRO"
        />
        <ColorPanel
          color={PANEL_COLORS[2]} eyebrow="03 · Caixa & gestão" EyeIcon={IconWallet}
          title="Você fecha o dia com número na mão," accent="não no achismo."
          desc="Toda venda — mesa, balcão e delivery — cai no mesmo caixa. Você vê a receita por forma de pagamento, o que saiu do estoque e o lucro do período."
          pills={["Caixa unificado", "Receita por forma de pagamento", "Baixa de estoque + CMV"]}
          img="/site/tela-financeiro.jpg" imgAlt="Painel financeiro do ComandaPRO"
        />
      </section>

      <Reveal><PrecoSection incluso={INCLUSO} /></Reveal>
      <Reveal><FaqSection faqs={n.faqs} /></Reveal>
      <Reveal><CtaFinal heading={`Bota sua ${n.nome.toLowerCase()} num sistema só.`} /></Reveal>
      <SiteFooter />
      <JsonLd name={`ComandaPRO para ${n.nome}`} faqs={n.faqs} />
      <CadastroModal />
    </main>
  );
}

export default async function SegmentoPage({ params }: { params: Promise<{ nicho: string }> }) {
  const { nicho } = await params;
  const n = getNicho(nicho);
  if (!n) notFound();
  return <SegmentLP nicho={n} />;
}
