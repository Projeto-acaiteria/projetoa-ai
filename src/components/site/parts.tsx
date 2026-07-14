// Peças COMPARTILHADAS do site institucional (mãe + segmentadas /segmentos/[nicho]).
// Evita a dívida copy-paste do AgendaPRO: 1 fonte pros blocos reutilizados.
// TEMA CLARO (creme quente + painéis coloridos), coerente com o site-mãe (page.tsx).
import Link from "next/link";
import { IconArrowRight, IconCheck, IconMoto, IconReceipt, IconTable, IconPrinter, IconWallet, IconGift, IconChart, IconBag } from "@/components/Icons";
import { BILLING } from "@/config/billing";
import { NICHOS } from "@/config/marketing";
import { Logo } from "@/components/site/Logo";

// ── Tokens quentes (mesmos do site-mãe) ──
export const ACCENT = "#6366F1"; // índigo
export const CREAM = "#FFF9F2";  // fundo creme quente
export const INK = "#241C17";    // texto quente escuro
export const MUT = "#6B5D52";    // texto secundário quente

// Paleta COERENTE dos painéis (cool: índigo → azul → violeta → sky → índigo), unificada pelo amarelo
// do destaque + cards brancos + marca d'água. Mesma do site-mãe. Estilo Expresso.
export const PANEL_COLORS = [
  "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)",
  "linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)",
  "linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)",
  "linear-gradient(135deg, #0EA5E9 0%, #0369A1 100%)",
  "linear-gradient(135deg, #6D5DF6 0%, #4F46E5 100%)",
];

export function SiteGlows() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="site-glow absolute -right-32 -top-32 h-[38rem] w-[38rem] rounded-full opacity-70 blur-3xl" style={{ background: "radial-gradient(circle, #FFE0C2 0%, transparent 70%)", animation: "aurora-a 26s ease-in-out infinite" }} />
      <div className="site-glow absolute -left-40 top-24 h-[32rem] w-[32rem] rounded-full opacity-60 blur-3xl" style={{ background: `radial-gradient(circle, ${ACCENT}33 0%, transparent 70%)`, animation: "aurora-b 32s ease-in-out infinite" }} />
      <div className="site-glow absolute left-1/2 top-[52%] h-[30rem] w-[30rem] rounded-full opacity-50 blur-3xl" style={{ background: "radial-gradient(circle, #FFD1E3 0%, transparent 70%)", animation: "aurora-c 30s ease-in-out infinite" }} />
    </div>
  );
}

// Header colorido sticky (idêntico ao site-mãe) — logo + nav + dropdown de segmentos.
export function SiteNav() {
  return (
    <div className="sticky top-0 z-30 text-white shadow-lg" style={{ background: "linear-gradient(90deg, #6D5DF6 0%, #8B5CF6 55%, #A855F7 100%)" }}>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
        <div className="flex items-center gap-10">
          <Link href="/" aria-label="ComandaPRO"><Logo light /></Link>
          <nav className="hidden items-center gap-7 text-[15px] font-semibold text-white/85 lg:flex">
            <a href="#funcionalidades" className="transition hover:text-white">Funcionalidades</a>
            <div className="group relative">
              <button className="flex items-center gap-1 transition hover:text-white">
                Segmentos
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <div className="invisible absolute left-1/2 top-full z-30 w-56 -translate-x-1/2 pt-3 opacity-0 transition group-hover:visible group-hover:opacity-100">
                <div className="rounded-2xl border border-black/[0.06] bg-white p-2 shadow-xl">
                  {NICHOS.map((n) => (
                    <Link key={n.slug} href={`/segmentos/${n.slug}`} className="block rounded-xl px-3 py-2 text-sm font-semibold transition hover:bg-[#FFF3E6]" style={{ color: INK }}>{n.nome}</Link>
                  ))}
                </div>
              </div>
            </div>
            <a href="#precos" className="transition hover:text-white">Preço</a>
            <a href="#faq" className="transition hover:text-white">Dúvidas</a>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="hidden text-[15px] font-semibold text-white/85 transition hover:text-white sm:block">Entrar</Link>
          <Link href="/cadastro" className="rounded-full bg-white px-5 py-2.5 text-sm font-extrabold transition hover:bg-white/90" style={{ color: "#6D5DF6" }}>Começar agora</Link>
        </div>
      </header>
    </div>
  );
}

// Moldura de celular com print real (cardápio público, mobile).
export function PhoneFrame({ src, alt, caption }: { src: string; alt: string; caption?: string }) {
  return (
    <div className="w-full max-w-[270px]">
      <div className="site-lift overflow-hidden rounded-[32px] border-4 border-black/[0.06] bg-black" style={{ boxShadow: `0 30px 80px -24px ${ACCENT}55, 0 8px 30px rgba(0,0,0,.6)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="h-[430px] w-full object-cover object-top" />
      </div>
      {caption && <div className="mt-3 text-center text-xs font-semibold text-[#8A7B6E]">{caption}</div>}
    </div>
  );
}

// Moldura de navegador com print real (telas do dono, admin desktop).
export function BrowserFrame({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="site-lift w-full overflow-hidden rounded-xl border border-black/[0.06]" style={{ boxShadow: `0 30px 80px -28px ${ACCENT}44, 0 8px 30px rgba(0,0,0,.35)` }}>
      <div className="flex items-center gap-1.5 bg-[#151a26] px-3 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-2 truncate rounded bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/70">comandapro.net.br/admin</span>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="w-full" />
    </div>
  );
}

export function Pill({ label }: { label: string }) {
  return <span className="rounded-full border border-black/[0.06] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#5A4F45] shadow-sm">{label}</span>;
}

// Marca d'água de ícones de comida espalhados (fundo dos painéis coloridos).
function PanelWatermark() {
  const items = [IconMoto, IconReceipt, IconTable, IconPrinter, IconWallet, IconGift, IconChart, IconBag];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 28 }).map((_, i) => {
        const I = items[i % items.length];
        return (
          <span key={i} className="absolute text-white" style={{ top: `${(i * 34 + 6) % 100}%`, left: `${(i * 47 + 4) % 100}%`, opacity: 0.09, transform: `rotate(${(i * 25) % 40 - 20}deg)` }}>
            <I width={40} height={40} />
          </span>
        );
      })}
    </div>
  );
}

// Mock de tela claro (card branco) pra painéis sem screenshot real (couvert/dose, venda por peso).
type Row = { label: string; value?: string; on?: boolean };
export function ScreenMock({ title, badge, rows, footer }: { title: string; badge?: string; rows: Row[]; footer?: { label: string; value: string } }) {
  return (
    <div className="site-lift w-full max-w-sm rounded-[22px] border border-black/[0.06] bg-white p-2.5" style={{ boxShadow: `0 26px 70px -24px ${ACCENT}30, 0 10px 30px rgba(80,40,20,.14)` }}>
      <div className="rounded-[15px] bg-[#FBF7F1] p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-bold" style={{ color: INK }}>{title}</span>
          {badge && <span className="rounded-full bg-black/[0.05] px-2.5 py-1 text-[11px] font-semibold text-[#6B5D52]">{badge}</span>}
        </div>
        <div className="space-y-1.5">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 shadow-sm">
              <span className="text-[13px] font-semibold" style={{ color: r.on ? ACCENT : INK }}>{r.label}</span>
              {r.value && <span className="text-[13px] font-bold tabular-nums" style={{ color: r.on ? ACCENT : "#6B5D52" }}>{r.value}</span>}
            </div>
          ))}
        </div>
        {footer && (
          <div className="mt-3 flex items-center justify-between rounded-lg bg-white px-3 py-2.5 shadow-sm">
            <span className="text-[12px] font-semibold text-[#6B5D52]">{footer.label}</span>
            <span className="text-sm font-extrabold tabular-nums" style={{ color: INK }}>{footer.value}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// PAINEL COLORIDO de funcionalidade (estilo Expresso): cor cheia + marca d'água + texto branco com
// palavra-destaque amarela + pills contornadas + card branco de UI real ao lado. Igual ao site-mãe.
export function ColorPanel({ color, eyebrow, EyeIcon, title, accent, desc, pills, img, imgAlt, mock, reverse }: {
  color: string; eyebrow: string; EyeIcon: React.ComponentType<{ width?: number; height?: number }>; title: string; accent: string; desc: string; pills: string[]; img?: string; imgAlt?: string; mock?: React.ReactNode; reverse?: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-[32px] px-7 py-9 text-white shadow-xl lg:px-12 lg:py-12" style={{ background: color }}>
      <PanelWatermark />
      <div className={`relative grid items-center gap-8 lg:grid-cols-2 lg:gap-12 ${reverse ? "lg:[&>*:first-child]:order-2" : ""}`}>
        <div>
          <div className="mb-4 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white/90">
            <EyeIcon width={16} height={16} /> {eyebrow}
          </div>
          <h3 className="text-3xl font-extrabold leading-[1.1] tracking-tight sm:text-4xl">
            {title} <span style={{ color: "#FFD84D" }}>{accent}</span>
          </h3>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-white/85">{desc}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {pills.map((p) => (
              <span key={p} className="rounded-full border border-white/40 px-3.5 py-1.5 text-[13px] font-bold text-white">{p}</span>
            ))}
          </div>
          <a href="#precos" className="mt-6 inline-flex items-center gap-2 text-[15px] font-extrabold text-white underline-offset-4 hover:underline">Conhecer módulo →</a>
        </div>
        <div className="flex justify-center">
          {mock ?? (
            <div className="w-full overflow-hidden rounded-2xl bg-white p-1.5 shadow-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt={imgAlt} className="w-full rounded-xl" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export type Faq = { q: string; a: string };

export function PrecoSection({ incluso }: { incluso: string[] }) {
  return (
    <section id="precos" className="relative z-10 mx-auto max-w-6xl px-5 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <span className="text-sm font-bold uppercase tracking-wider" style={{ color: ACCENT }}>Preço</span>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl" style={{ color: INK }}>Um plano. Tudo incluso.</h2>
        <p className="mt-4 text-lg text-[#6B5D52]">Sem taxa de setup, sem comissão por pedido, sem contrato de permanência.</p>
      </div>
      <div className="mx-auto mt-12 max-w-md rounded-3xl border border-black/[0.06] bg-white p-8 text-center shadow-sm" style={{ boxShadow: `0 30px 80px -30px ${ACCENT}55` }}>
        <div className="text-sm font-semibold text-[#6B5D52]">a partir de</div>
        <div className="mt-1 flex items-end justify-center gap-1">
          <span className="text-5xl font-extrabold tracking-tight" style={{ color: INK }}>R$ {BILLING.planos.anual.equivMes}</span>
          <span className="mb-1 text-lg font-semibold text-[#6B5D52]">/mês</span>
        </div>
        <div className="mt-1 text-sm text-[#6B5D52]">no plano anual · R$ {BILLING.planos.mensal.equivMes}/mês no mensal</div>
        <ul className="mt-6 space-y-2 text-left">
          {incluso.map((i) => (
            <li key={i} className="flex items-center gap-2.5 text-sm text-[#241C17]">
              <span style={{ color: ACCENT }}><IconCheck width={17} height={17} /></span> {i}
            </li>
          ))}
        </ul>
        <Link href="/cadastro" className="mt-7 flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 text-[15px] font-bold text-white transition hover:opacity-90" style={{ background: ACCENT, boxShadow: `0 12px 34px ${ACCENT}66` }}>
          Começar {BILLING.trialDias} dias grátis <IconArrowRight width={18} height={18} />
        </Link>
        <div className="mt-3 text-xs text-[#8A7B6E]">{BILLING.trialDias} dias grátis · sem cartão pra testar</div>
      </div>
    </section>
  );
}

export function FaqSection({ faqs }: { faqs: Faq[] }) {
  return (
    <section id="faq" className="relative z-10 mx-auto max-w-3xl px-5 py-20">
      <div className="text-center">
        <span className="text-sm font-bold uppercase tracking-wider" style={{ color: ACCENT }}>Dúvidas</span>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl" style={{ color: INK }}>Perguntas frequentes</h2>
      </div>
      <div className="mt-10 space-y-3">
        {faqs.map((f) => (
          <details key={f.q} className="group rounded-2xl border border-black/[0.06] bg-white px-5 py-4 shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between font-bold" style={{ color: INK }}>
              {f.q}
              <span className="ml-4 transition group-open:rotate-45" style={{ color: ACCENT }}>+</span>
            </summary>
            <p className="mt-3 text-[#5A4F45]">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function CtaFinal({ heading, sub }: { heading: string; sub?: string }) {
  return (
    <section id="demonstracao" className="relative z-10 mx-auto max-w-4xl px-5 py-20 text-center">
      <div className="rounded-[32px] border border-black/[0.06] bg-white px-8 py-16 shadow-sm" style={{ background: `radial-gradient(120% 120% at 50% 0%, ${ACCENT}22 0%, transparent 60%)` }}>
        <h2 className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl" style={{ color: INK }}>{heading}</h2>
        <p className="mx-auto mt-4 max-w-lg text-lg text-[#5A4F45]">{sub ?? `Testa ${BILLING.trialDias} dias grátis. Sem cartão, sem setup, sem comissão.`}</p>
        <Link href="/cadastro" className="mt-8 inline-flex items-center gap-2 rounded-full px-8 py-4 text-[15px] font-bold text-white transition hover:opacity-90" style={{ background: ACCENT, boxShadow: `0 14px 40px ${ACCENT}66` }}>
          Começar agora <IconArrowRight width={18} height={18} />
        </Link>
      </div>
    </section>
  );
}

// Rodapé colorido (índigo escuro) — mesmo do site-mãe.
export function SiteFooter() {
  return (
    <footer className="relative z-10 mt-10 text-white" style={{ background: "linear-gradient(135deg, #2A2358 0%, #1C1740 100%)" }}>
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div>
            <Logo light />
            <p className="mt-2 max-w-xs text-sm text-white/60">Sistema de food service: do primeiro pedido ao fechamento do caixa, num sistema só.</p>
          </div>
          <div>
            <div className="text-sm font-bold text-white">Pra qual negócio</div>
            <ul className="mt-3 space-y-2 text-sm text-white/60">
              {NICHOS.map((n) => (
                <li key={n.slug}><Link href={`/segmentos/${n.slug}`} className="transition hover:text-white">{n.nome}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-sm font-bold text-white">Sistema</div>
            <ul className="mt-3 space-y-2 text-sm text-white/60">
              <li><Link href="/cadastro" className="transition hover:text-white">Começar grátis</Link></li>
              <li><Link href="/login" className="transition hover:text-white">Entrar</Link></li>
              <li><a href="#precos" className="transition hover:text-white">Preço</a></li>
              <li><a href="#faq" className="transition hover:text-white">Dúvidas</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-12 border-t border-white/10 pt-6 text-xs text-white/45">© 2026 ComandaPRO · Impulso Digital</div>
      </div>
    </footer>
  );
}

// JSON-LD (SoftwareApplication + FAQPage): AEO técnico que o AgendaPRO não faz.
export function JsonLd({ name, faqs }: { name: string; faqs: Faq[] }) {
  const data = [
    { "@context": "https://schema.org", "@type": "SoftwareApplication", name, applicationCategory: "BusinessApplication", operatingSystem: "Web", offers: { "@type": "Offer", price: String(BILLING.planos.mensal.equivMes), priceCurrency: "BRL" } },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
  ];
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
