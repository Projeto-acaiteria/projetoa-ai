// Peças COMPARTILHADAS do site institucional (mãe + segmentadas /segmentos/[nicho]).
// Evita a dívida copy-paste do AgendaPRO: 1 fonte pros blocos reutilizados.
import Link from "next/link";
import { IconArrowRight, IconCheck } from "@/components/Icons";
import { BILLING } from "@/config/billing";
import { NICHOS } from "@/config/marketing";

export const NAVY = "#05070f";
export const ACCENT = "#6366F1";

export function SiteGlows() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full opacity-30 blur-3xl" style={{ background: `radial-gradient(circle, ${ACCENT} 0%, transparent 70%)` }} />
      <div className="absolute -right-32 top-40 h-[28rem] w-[28rem] rounded-full opacity-20 blur-3xl" style={{ background: "radial-gradient(circle, #22D3EE 0%, transparent 70%)" }} />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
    </div>
  );
}

export function SiteNav() {
  return (
    <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
      <Link href="/" className="text-lg font-extrabold tracking-tight">ComandaPRO</Link>
      <nav className="flex items-center gap-3">
        <Link href="/login" className="hidden text-sm font-semibold text-slate-300 hover:text-white sm:block">Entrar</Link>
        <Link href="/cadastro" className="rounded-full px-4 py-2 text-sm font-bold text-white shadow-lg transition hover:opacity-90" style={{ background: ACCENT, boxShadow: `0 8px 24px ${ACCENT}55` }}>Começar agora</Link>
      </nav>
    </header>
  );
}

// Moldura de celular com print real (cardápio público, mobile).
export function PhoneFrame({ src, alt, caption }: { src: string; alt: string; caption?: string }) {
  return (
    <div className="w-full max-w-[270px]">
      <div className="overflow-hidden rounded-[32px] border-4 border-white/10 bg-black" style={{ boxShadow: `0 30px 80px -24px ${ACCENT}55, 0 8px 30px rgba(0,0,0,.6)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="h-[430px] w-full object-cover object-top" />
      </div>
      {caption && <div className="mt-3 text-center text-xs font-semibold text-slate-500">{caption}</div>}
    </div>
  );
}

// Moldura de navegador com print real (telas do dono, admin desktop).
export function BrowserFrame({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="w-full overflow-hidden rounded-xl border border-white/10" style={{ boxShadow: `0 30px 80px -28px ${ACCENT}44, 0 8px 30px rgba(0,0,0,.55)` }}>
      <div className="flex items-center gap-1.5 bg-[#151a26] px-3 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-2 truncate rounded bg-white/10 px-2 py-0.5 text-[10px] font-medium text-slate-400">comandapro.net.br/admin</span>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="w-full" />
    </div>
  );
}

export function Pill({ label }: { label: string }) {
  return <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] font-semibold text-slate-300">{label}</span>;
}

export type Faq = { q: string; a: string };

export function PrecoSection({ incluso }: { incluso: string[] }) {
  return (
    <section id="precos" className="relative z-10 mx-auto max-w-6xl px-5 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <span className="text-sm font-bold uppercase tracking-wider" style={{ color: ACCENT }}>Preço</span>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Um plano. Tudo incluso.</h2>
        <p className="mt-4 text-lg text-slate-400">Sem taxa de setup, sem comissão por pedido, sem fidelidade.</p>
      </div>
      <div className="mx-auto mt-12 max-w-md rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center" style={{ boxShadow: `0 30px 80px -30px ${ACCENT}55` }}>
        <div className="text-sm font-semibold text-slate-400">a partir de</div>
        <div className="mt-1 flex items-end justify-center gap-1">
          <span className="text-5xl font-extrabold tracking-tight">R$ {BILLING.planos.anual.equivMes}</span>
          <span className="mb-1 text-lg font-semibold text-slate-400">/mês</span>
        </div>
        <div className="mt-1 text-sm text-slate-400">no plano anual · R$ {BILLING.planos.mensal.equivMes}/mês no mensal</div>
        <ul className="mt-6 space-y-2 text-left">
          {incluso.map((i) => (
            <li key={i} className="flex items-center gap-2.5 text-sm text-slate-200">
              <span style={{ color: ACCENT }}><IconCheck width={17} height={17} /></span> {i}
            </li>
          ))}
        </ul>
        <Link href="/cadastro" className="mt-7 flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 text-[15px] font-bold text-white transition hover:opacity-90" style={{ background: ACCENT, boxShadow: `0 12px 34px ${ACCENT}66` }}>
          Começar {BILLING.trialDias} dias grátis <IconArrowRight width={18} height={18} />
        </Link>
        <div className="mt-3 text-xs text-slate-500">{BILLING.trialDias} dias grátis · sem cartão pra testar</div>
      </div>
    </section>
  );
}

export function FaqSection({ faqs }: { faqs: Faq[] }) {
  return (
    <section id="faq" className="relative z-10 mx-auto max-w-3xl px-5 py-20">
      <div className="text-center">
        <span className="text-sm font-bold uppercase tracking-wider" style={{ color: ACCENT }}>Dúvidas</span>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Perguntas frequentes</h2>
      </div>
      <div className="mt-10 space-y-3">
        {faqs.map((f) => (
          <details key={f.q} className="group rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between font-bold text-white">
              {f.q}
              <span className="ml-4 transition group-open:rotate-45" style={{ color: ACCENT }}>+</span>
            </summary>
            <p className="mt-3 text-slate-300">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function CtaFinal({ heading, sub }: { heading: string; sub?: string }) {
  return (
    <section id="demonstracao" className="relative z-10 mx-auto max-w-4xl px-5 py-20 text-center">
      <div className="rounded-[32px] border border-white/10 px-8 py-16" style={{ background: `radial-gradient(120% 120% at 50% 0%, ${ACCENT}22 0%, transparent 60%)` }}>
        <h2 className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">{heading}</h2>
        <p className="mx-auto mt-4 max-w-lg text-lg text-slate-300">{sub ?? `Testa ${BILLING.trialDias} dias grátis. Sem cartão, sem setup, sem comissão.`}</p>
        <Link href="/cadastro" className="mt-8 inline-flex items-center gap-2 rounded-full px-8 py-4 text-[15px] font-bold text-white transition hover:opacity-90" style={{ background: ACCENT, boxShadow: `0 14px 40px ${ACCENT}66` }}>
          Começar agora <IconArrowRight width={18} height={18} />
        </Link>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-white/10">
      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div>
            <span className="text-lg font-extrabold tracking-tight">ComandaPRO</span>
            <p className="mt-2 max-w-xs text-sm text-slate-400">Sistema de food service: do primeiro pedido ao fechamento do caixa, num sistema só.</p>
          </div>
          <div>
            <div className="text-sm font-bold text-white">Pra qual negócio</div>
            <ul className="mt-3 space-y-2 text-sm text-slate-400">
              {NICHOS.map((n) => (
                <li key={n.slug}><Link href={`/segmentos/${n.slug}`} className="hover:text-white">{n.nome}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-sm font-bold text-white">Sistema</div>
            <ul className="mt-3 space-y-2 text-sm text-slate-400">
              <li><Link href="/cadastro" className="hover:text-white">Começar grátis</Link></li>
              <li><Link href="/login" className="hover:text-white">Entrar</Link></li>
              <li><a href="#precos" className="hover:text-white">Preço</a></li>
              <li><a href="#faq" className="hover:text-white">Dúvidas</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 border-t border-white/10 pt-6 text-xs text-slate-500">© 2026 ComandaPRO · Impulso Digital</div>
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
