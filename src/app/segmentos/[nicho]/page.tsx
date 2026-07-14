import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { IconArrowRight, IconMoto, IconTable, IconWallet, IconReceipt, IconBag } from "@/components/Icons";
import { NICHOS, getNicho, type Nicho } from "@/config/marketing";
import { SEGMENTOS, type Features } from "@/config/segments";
import { ACCENT, CREAM, INK, MUT, PANEL_COLORS, SiteGlows, SiteNav, PhoneFrame, ColorPanel, ScreenMock, Pill, PrecoSection, FaqSection, CtaFinal, SiteFooter, JsonLd } from "@/components/site/parts";
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

// "Tudo incluso" HONESTO por nicho — só lista o que as features do segmento realmente têm (segments.ts).
function buildIncluso(f: Features): string[] {
  const list = ["Cardápio digital no seu link"];
  if (f.hasDelivery) list.push("Delivery próprio sem comissão");
  if (f.hasTables) list.push("Comanda, mesa e app do garçom");
  if (f.coverEnabled || f.stockDose) list.push("Couvert e dose/garrafa no controle");
  if (f.sellsByWeight) list.push("Venda por peso (R$/kg)");
  list.push("Cozinha (KDS) e impressão térmica 80mm");
  list.push("Balcão / PDV e caixa unificado");
  list.push("Estoque com baixa automática");
  if (f.loyaltyEnabled) list.push("Fidelidade por pontos");
  return list;
}

// Painéis "Como funciona" HONESTOS por nicho — cada painel só aparece se a feature existe.
type PanelDef = { eyebrow: string; EyeIcon: React.ComponentType<{ width?: number; height?: number }>; title: string; accent: string; desc: string; pills: string[]; img?: string; imgAlt?: string; mock?: React.ReactNode };
function buildPanels(f: Features): PanelDef[] {
  const p: PanelDef[] = [];
  if (f.hasDelivery) p.push({ eyebrow: "Delivery próprio", EyeIcon: IconMoto, title: "Todo pedido cai no seu balcão.", accent: "Zero comissão.", desc: "Entrega pelo seu link, com sua taxa por bairro. O cliente escolhe Pix, cartão ou dinheiro com troco e acompanha por código de rastreio. Entrou pedido, o sistema apita e imprime sozinho.", pills: ["0% de comissão", "Taxa por bairro", "Rastreio por código", "Apita e imprime"], img: "/site/tela-pedidos.jpg", imgAlt: "Painel de pedidos de delivery no ComandaPRO" });
  if (f.hasTables) p.push({ eyebrow: "Comanda & mesa", EyeIcon: IconTable, title: "Cada mesa com a conta certa,", accent: "na hora.", desc: f.hasStations ? "Comanda por mesa, o garçom lança pelo celular e cada item vai roteado pra cozinha ou pro bar. A conta divide sem erro na hora de fechar." : "Comanda por mesa, o garçom lança pelo celular e a conta divide sem erro na hora de fechar.", pills: ["Comanda por mesa", "App do garçom", "Divisão de conta"], img: "/site/tela-mesas.jpg", imgAlt: "Mapa de mesas com comandas abertas no ComandaPRO" });
  if (f.coverEnabled || f.stockDose) p.push({ eyebrow: "Couvert & dose", EyeIcon: IconReceipt, title: "Couvert e dose entram", accent: "sem furo no controle.", desc: "O couvert entra por pessoa quando tem atração e a dose ou a garrafa baixa certo do estoque — sem confundir dose com garrafa. A taxa de serviço fecha na conta.", pills: ["Couvert por pessoa", "Dose e garrafa", "Taxa de serviço 10%"], mock: <ScreenMock title="Comanda · Mesa 06" rows={[{ label: "Couvert · 2 pessoas", value: "R$ 20,00" }, { label: "Chopp 300ml · 3", value: "R$ 36,00" }, { label: "Dose de gin", value: "R$ 18,00", on: true }]} footer={{ label: "Taxa de serviço 10%", value: "R$ 7,40" }} /> });
  if (f.sellsByWeight) p.push({ eyebrow: "Venda por peso", EyeIcon: IconBag, title: "Vende por peso", accent: "sem erro de conta.", desc: "Preço por quilo: o sistema lê a balança (protocolo Toledo, via QZ Tray) ou você digita as gramas, e o total sai certo. Ideal pra açaí no copo, marmita e self-service.", pills: ["Preço por kg", "Lê da balança", "ou digita as gramas"], mock: <ScreenMock title="Balcão · por peso" rows={[{ label: "Açaí · R$ 49,90/kg" }, { label: "Peso", value: "320 g" }, { label: "Total", value: "R$ 15,97", on: true }]} /> });
  p.push({ eyebrow: "Caixa & gestão", EyeIcon: IconWallet, title: "Você fecha o dia com número na mão,", accent: "não no achismo.", desc: `Toda venda — ${f.hasDelivery ? "balcão, mesa e delivery" : "balcão e mesa"} — cai no mesmo caixa. Você vê a receita por forma de pagamento, o que saiu do estoque e o lucro do período.`, pills: ["Caixa unificado", "Receita por forma de pagamento", "Baixa de estoque + CMV"], img: "/site/tela-financeiro.jpg", imgAlt: "Painel financeiro do ComandaPRO" });
  return p;
}

function SegmentLP({ nicho: n }: { nicho: Nicho }) {
  const feat = SEGMENTOS[n.businessType].features;
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

      {/* FUNCIONALIDADES — painéis coloridos HONESTOS por nicho (só o que a feature existe) */}
      <section id="funcionalidades" className="relative z-10 mx-auto max-w-6xl space-y-8 px-5 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-bold uppercase tracking-wider" style={{ color: ACCENT }}>Como funciona</span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl" style={{ color: INK }}>Do pedido ao caixa, sem trocar de sistema</h2>
        </div>
        {buildPanels(feat).map((p, i) => (
          <ColorPanel key={p.eyebrow} {...p} eyebrow={`${String(i + 1).padStart(2, "0")} · ${p.eyebrow}`} color={PANEL_COLORS[i % PANEL_COLORS.length]} reverse={i % 2 === 1} />
        ))}
      </section>

      <Reveal><PrecoSection incluso={buildIncluso(feat)} /></Reveal>
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
