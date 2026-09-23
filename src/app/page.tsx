import type { Metadata } from "next";
import Link from "next/link";
import { IconArrowRight, IconTable, IconReceipt, IconMoto, IconWallet, IconCard, IconBox, IconChart, IconPrinter, IconCheck, IconBag, IconGift, IconStar, IconWhatsapp } from "@/components/Icons";
import { BILLING } from "@/config/billing";
import { NICHOS } from "@/config/marketing";
import { Reveal } from "@/components/site/Reveal";
import { Logo } from "@/components/site/Logo";
import CadastroModal from "@/components/site/CadastroModal";

export const dynamic = "force-static";

// Home com metadata keyword-rich (o AgendaPRO não tem no home — ganho fácil de AEO).
export const metadata: Metadata = {
  title: "ComandaPRO — Sistema para Food Service: Cardápio, Comanda, Delivery e Caixa",
  description:
    "Sistema completo para açaiteria, bar, pizzaria, sushi e hamburgueria: cardápio digital, comanda, mesa, delivery próprio sem comissão, PDV e caixa — num sistema só. 14 dias grátis.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "ComandaPRO — Do primeiro pedido ao fechamento do caixa, num sistema só",
    description: "Cardápio digital, comanda, mesa, delivery próprio sem comissão e caixa integrados. Feito pra food service.",
    type: "website",
  },
};

// FAQ em linguagem natural = munição de AEO (o que LLM/Google extraem). Alimenta a UI E o JSON-LD.
const FAQS: { q: string; a: string }[] = [
  { q: "Quem monta o meu cardápio?", a: "A gente. Você cria a conta e chama no WhatsApp; montamos o cardápio com você — produtos, preços, tamanhos e adicionais — sem custo a mais, está incluso na mensalidade. Se o seu negócio precisar de alguma função específica, a gente estuda com você." },
  { q: "Preciso pagar comissão por pedido?", a: "Não. Você paga só a mensalidade. O pedido chega pelo seu link e o valor da venda é todo seu — sem o marketplace levando percentual." },
  { q: "Meu cliente precisa baixar aplicativo?", a: "Não. Ele faz o pedido pelo link do seu cardápio, direto no navegador do celular, sem instalar nada." },
  { q: "Serve pro meu tipo de negócio?", a: "Sim. Açaiteria, bar, petiscaria, hamburgueria, pizzaria, sushi e mais — cada negócio liga só as funcionalidades que usa." },
  { q: "O cliente consegue pedir pela mesa?", a: "Consegue, se você quiser. Cada mesa tem um QR: o cliente monta o pedido, envia, e ele sai na impressora certa (bar ou cozinha) com o número da mesa e a observação. Pela mesma tela ele chama o garçom ou pede a conta. Se preferir, desliga e o cardápio fica só pra consulta." },
  { q: "Preciso de impressora? Qual serve?", a: "Serve qualquer impressora térmica 80mm (não precisa ser fiscal). Tem um instalador de 1 clique que configura tudo, e a via da cozinha e a do balcão vão roteadas pra impressora certa de cada estação." },
  { q: "Consigo vender por peso, tipo açaí e marmita?", a: "Sim. O ComandaPRO trabalha com venda por peso (R$/kg) integrando a balança ou digitando as gramas." },
  { q: "Como funciona a maquininha de cartão?", a: "O sistema registra a forma de pagamento (Pix, cartão ou dinheiro com troco) em cada venda, pro seu caixa fechar certo. A maquininha continua sendo a sua, à parte — o ComandaPRO não processa o cartão nem cobra taxa sobre a venda." },
  { q: "Tem suporte se eu precisar?", a: "Tem. Suporte humano direto no WhatsApp — você fala com a gente, não com robô." },
  { q: "Quanto custa?", a: `A partir de R$ ${BILLING.planos.anual.equivMes}/mês no plano anual (R$ ${BILLING.planos.mensal.equivMes}/mês no mensal), com ${BILLING.trialDias} dias grátis e sem taxa de setup.` },
  { q: "Preciso de vários sistemas diferentes?", a: "Não. Cardápio, comanda, mesa, cozinha, delivery, caixa e estoque estão num sistema só, e todos conversam entre si." },
];

// Modelo de entrada (Eduardo, 22/09/2026): o dono cria a conta e chama no WhatsApp; A GENTE monta o
// cardápio, incluso na mensalidade. Função sob medida = estudada caso a caso (nunca prometer grátis).
const WHATSAPP = `https://wa.me/5563992920080?text=${encodeURIComponent("Oi! Vim pelo site do ComandaPRO e quero montar meu cardápio.")}`;
// Loja de demonstração (dados fictícios, 15 produtos) — o "Ver demonstração" abre um cardápio de verdade.
const DEMO_URL = "/burger-house-demo";

const INCLUSO = [
  "Cardápio montado por nós, incluso",
  "Cardápio digital + delivery próprio",
  "Comanda, mesa e app do garçom",
  "Cozinha (KDS) e impressão térmica",
  "Balcão / PDV e caixa unificado",
  "Estoque com baixa automática",
  "Fidelidade por pontos",
];

// ── SITE-MÃE do ComandaPRO (comandapro.net.br) — institucional, não é loja nenhuma.
// Navy dark premium + acento índigo (decisão 13/07). Construído seção por seção; por ora: Nav + Hero.
// Blueprint: segundo-cerebro/.../ESTUDO-SITE-COMANDAPRO.md. NÃO é o app (admin/[slug]).

const NAVY = "#05070f";
const ACCENT = "#F5480C";
// Novo tema CLARO / food alegre (decisão 13/07) — em migração seção por seção a partir do hero.
const CREAM = "#FFF9F2"; // fundo creme quente
const INK = "#241C17";   // texto quente escuro
const MUT = "#6B5D52";   // texto secundário quente

// LOGO ComandaPRO — modelo AgendaPRO (wordmark + pílula "PRO" com gradiente), mas identidade
// Logo ComandaPRO — componente compartilhado (site-mãe + segmentadas). Ver src/components/site/Logo.tsx.

// Mockup HONESTO do mapa de mesas (representa a UI real; trocar por print real depois).
function MesasMockup() {
  const mesas = [
    { n: 1, v: "R$ 92,00", on: true },
    { n: 2, v: "R$ 148,50", on: true },
    { n: 3, v: null, on: false },
    { n: 4, v: "R$ 54,00", on: true },
    { n: 5, v: null, on: false },
    { n: 6, v: "R$ 213,00", on: true },
    { n: 7, v: null, on: false },
    { n: 8, v: "R$ 76,50", on: true },
  ];
  return (
    <div
      className="site-lift w-full max-w-md rounded-[26px] border border-black/[0.06] bg-white shadow-sm p-3 shadow-2xl backdrop-blur"
      style={{ boxShadow: `0 30px 80px -20px ${ACCENT}55, 0 10px 40px rgba(0,0,0,.5)` }}
    >
      <div className="rounded-[18px] bg-[#0b1020] p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <IconTable width={16} height={16} /> Mesas
          </div>
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-[#5A4F45]">Salão · agora</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {mesas.map((m) => (
            <div
              key={m.n}
              className={`rounded-xl border p-2 text-center ${
                m.on ? "border-transparent bg-[#F5480C]/15" : "border-black/[0.06] bg-white/[0.02]"
              }`}
            >
              <div className="text-[11px] font-bold text-[#6B5D52]">Mesa {m.n}</div>
              <div className={`mt-1 text-[11px] font-extrabold tabular-nums ${m.on ? "text-white" : "text-slate-600"}`}>
                {m.v ?? "livre"}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between rounded-xl bg-white shadow-sm px-3 py-2.5">
          <span className="text-[11px] font-semibold text-[#6B5D52]">Aberto no salão</span>
          <span className="text-sm font-extrabold text-white tabular-nums">R$ 584,00</span>
        </div>
      </div>
    </div>
  );
}

// ── Seção SEGMENTOS: cards de acesso às segmentadas (destaque no topo). Foto de comida + nicho.
const SEG_IMG: Record<string, { img: string; tag: string }> = {
  acaiteria: { img: "/site/food-acai.jpg", tag: "Monta no copo · venda por peso" },
  bar: { img: "/site/food-bar.jpg", tag: "Comanda por mesa · couvert e dose" },
  hamburgueria: { img: "/site/food-burger.jpg", tag: "Combos e adicionais · delivery e fidelidade" },
  pizzaria: { img: "/site/food-pizza.jpg", tag: "Meio a meio · combos e bordas" },
  sushi: { img: "/site/food-sushi.jpg", tag: "Combos · barcas · rodízio" },
  // foto: Unsplash (Zulu Fernando, id YCIsQDGfd40) — até 22/09 o nicho estava sem entrada aqui e a foto saía quebrada
  restaurante: { img: "/site/food-restaurante.jpg", tag: "Comanda por mesa · comida a quilo" },
};
function SegmentosSection() {
  return (
    <section id="segmentos" className="relative z-10 mx-auto max-w-6xl px-5 py-12">
      <div className="mx-auto max-w-2xl text-center">
        <span className="text-sm font-bold uppercase tracking-wider" style={{ color: ACCENT }}>Pra qual negócio</span>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl" style={{ color: INK }}>Escolha o seu segmento</h2>
        <p className="mt-4 text-lg text-[#6B5D52]">Cada tipo de food service tem o seu jeito — e a gente monta o seu cardápio desse jeito.</p>
      </div>
      <div className="mt-10 flex flex-wrap justify-center gap-5">
        {NICHOS.map((n) => {
          const s = SEG_IMG[n.slug];
          return (
            <Link key={n.slug} href={`/segmentos/${n.slug}`} className="site-lift group w-full overflow-hidden rounded-3xl border border-black/[0.06] bg-white shadow-sm sm:w-[calc(50%-0.625rem)] lg:w-[260px]">
              <div className="h-40 w-full overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s?.img} alt={n.nome} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
              </div>
              <div className="p-5">
                <div className="flex min-h-[3.5rem] items-start text-lg font-extrabold leading-tight" style={{ color: INK }}>{n.nome}</div>
                <p className="mt-1 text-sm text-[#6B5D52]">{s?.tag}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-bold" style={{ color: ACCENT }}>Ver <IconArrowRight width={14} height={14} /></span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

// ── Seção DOR: dor antes da solução (método Expresso). Cada dor é respondida por uma
// funcionalidade mais abaixo na página. Tom de dono, direto.
const DORES = [
  { Icon: IconCard, t: "O app de delivery fica com uma parte de cada pedido", d: "Some a comissão do último mês no extrato: é o pedaço que era seu lucro — até no cliente que já conhecia a sua loja." },
  { Icon: IconReceipt, t: "Pedido no caderno e no WhatsApp", d: "Comanda perdida, item esquecido, cozinha fazendo o que não foi pedido. No corre, o erro sai caro." },
  { Icon: IconBox, t: "Um sistema pro delivery, outro pra mesa, outro pro caixa", d: "Nenhum conversa com o outro. Você digita a mesma coisa três vezes e ainda dá diferença." },
  { Icon: IconChart, t: "Fim da noite e você não sabe o resultado", d: "Quanto vendeu, quanto sobrou no caixa, o que saiu do estoque. Decisão no achismo." },
];

function DorSection() {
  return (
    <section className="relative z-10 mx-auto max-w-6xl px-5 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <span className="text-sm font-bold uppercase tracking-wider" style={{ color: "#F59E0B" }}>A rotina hoje</span>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Você se reconhece nessas situações?</h2>
      </div>
      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {DORES.map((d) => (
          <div key={d.t} className="flex gap-4 rounded-2xl border border-black/[0.06] bg-white shadow-sm p-5">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: "rgba(245,158,11,.12)", color: "#F59E0B" }}>
              <d.Icon width={20} height={20} />
            </div>
            <div>
              <div className="font-bold" style={{ color: INK }}>{d.t}</div>
              <p className="mt-1 text-sm leading-relaxed text-[#6B5D52]">{d.d}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-10 text-center text-lg font-semibold text-[#5A4F45]">
        O ComandaPRO resolve as quatro — <span style={{ color: ACCENT }}>num sistema só.</span>
      </p>
    </section>
  );
}

// ── COMO COMEÇAR: o modelo de entrada (cria a conta → chama no WhatsApp → a gente monta).
const PASSOS = [
  { n: "1", t: "Crie sua conta", d: `Leva um minuto e você tem ${BILLING.trialDias} dias grátis pra testar, sem cartão.` },
  { n: "2", t: "Chame a gente no WhatsApp", d: "Conta o que você vende, como atende e como cobra. Você fala com quem faz o sistema, não com robô." },
  { n: "3", t: "A gente monta o seu cardápio", d: "Produtos, preços, tamanhos e adicionais do seu jeito — incluso na mensalidade. Precisa de algo específico? A gente estuda com você." },
];
function ComoComecarSection() {
  return (
    <section id="como-comecar" className="relative z-10 mx-auto max-w-6xl px-5 py-16">
      <div className="mx-auto max-w-2xl text-center">
        <span className="text-sm font-bold uppercase tracking-wider" style={{ color: ACCENT }}>Como começar</span>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Você não monta nada sozinho.</h2>
        <p className="mt-4 text-lg text-[#6B5D52]">A parte que mais trava — cadastrar o cardápio — é com a gente.</p>
      </div>
      <div className="mt-12 grid gap-4 sm:grid-cols-3">
        {PASSOS.map((p) => (
          <div key={p.n} className="rounded-2xl border border-black/[0.06] bg-white p-6 shadow-sm">
            <div className="grid h-10 w-10 place-items-center rounded-full text-base font-extrabold text-white" style={{ background: ACCENT }}>{p.n}</div>
            <div className="mt-4 text-lg font-bold" style={{ color: INK }}>{p.t}</div>
            <p className="mt-1 text-sm leading-relaxed text-[#6B5D52]">{p.d}</p>
          </div>
        ))}
      </div>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Link href="/cadastro" className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-bold text-white transition hover:opacity-90" style={{ background: ACCENT }}>
          Criar minha conta <IconArrowRight width={18} height={18} />
        </Link>
        <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-6 py-3.5 text-[15px] font-bold shadow-sm transition hover:bg-[#FFF3E6]" style={{ color: INK }}>
          <span style={{ color: "#16A34A" }}><IconWhatsapp width={18} height={18} /></span> Falar no WhatsApp
        </a>
      </div>
    </section>
  );
}

// ── Seção FUNCIONALIDADES: agrupadas pela JORNADA DO DONO (método Expresso). Cada bloco =
// headline-benefício + mini-tela renderizada (honesta; trocar por print real depois) + pills.
type Row = { label: string; value?: string; on?: boolean };
function ScreenMock({ title, badge, rows, footer }: { title: string; badge?: string; rows: Row[]; footer?: { label: string; value: string } }) {
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

// Marca d'água de ícones de comida (tone-on-tone) — estilo Expresso.
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

// PAINEL COLORIDO de funcionalidade (estilo Expresso): cor cheia + marca d'água + texto branco
// com palavra-destaque + pills contornadas + card branco de UI real ao lado.
function ColorPanel({ color, eyebrow, EyeIcon, title, accent, desc, pills, img, imgAlt, mock, reverse }: {
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
          <a href="#precos" className="mt-6 inline-flex items-center gap-2 text-[15px] font-extrabold text-white underline-offset-4 hover:underline">Ver preço →</a>
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

// Moldura de NAVEGADOR com print real das telas do dono (admin desktop).
function BrowserFrame({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="site-lift w-full overflow-hidden rounded-xl border border-black/[0.06]" style={{ boxShadow: `0 30px 80px -28px ${ACCENT}44, 0 8px 30px rgba(0,0,0,.55)` }}>
      <div className="flex items-center gap-1.5 bg-[#151a26] px-3 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-2 truncate rounded bg-white/10 px-2 py-0.5 text-[10px] font-medium text-[#6B5D52]">comandapro.net.br/admin</span>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="w-full" />
    </div>
  );
}

// Moldura de celular com PRINT REAL do sistema (não mockup).
// href = cardápio público de verdade (abre em aba nova). Print vira porta pro produto funcionando.
function PhoneFrame({ src, alt, caption, href }: { src: string; alt: string; caption?: string; href?: string }) {
  return (
    <div className="w-full max-w-[270px]">
      {(() => {
        const frame = (
          <div className="site-lift overflow-hidden rounded-[32px] border-4 border-black/[0.06] bg-black" style={{ boxShadow: `0 30px 80px -24px ${ACCENT}55, 0 8px 30px rgba(0,0,0,.6)` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={alt} loading="lazy" decoding="async" width={390} height={650} className="h-[430px] w-full object-cover object-top" />
          </div>
        );
        return href ? (
          <a href={href} target="_blank" rel="noopener" aria-label={`Abrir ${alt}`} className="block transition hover:-translate-y-1">{frame}</a>
        ) : frame;
      })()}
      {caption && <div className="mt-3 text-center text-xs font-semibold text-white/85">{caption}</div>}
      {href && (
        <div className="mt-4 flex justify-center">
          <a href={href} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold shadow-md transition hover:opacity-90" style={{ color: "#241C17" }}>
            Abrir cardápio <IconArrowRight width={15} height={15} />
          </a>
        </div>
      )}
    </div>
  );
}

function MesaQrMock() {
  // Ilustração (não é print): o que o cliente vê no QR da mesa + o cupom que sai na estação.
  return (
    <div className="relative mx-auto w-full max-w-[340px] pb-24">
      <div className="rounded-3xl bg-white p-4 text-[#241C17] shadow-2xl">
        <div className="flex items-center justify-between">
          <span className="text-sm font-extrabold">Mesa 12</span>
          <span className="rounded-full bg-[#FFF3E6] px-2.5 py-1 text-[11px] font-bold" style={{ color: ACCENT }}>pelo QR</span>
        </div>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between rounded-xl bg-[#FAF6F1] px-3 py-2"><span>2× Caipirinha</span><span className="font-bold">R$ 36,00</span></div>
          <div className="flex justify-between rounded-xl bg-[#FAF6F1] px-3 py-2"><span>1× Porção de fritas</span><span className="font-bold">R$ 32,00</span></div>
        </div>
        <div className="mt-3 rounded-xl py-2.5 text-center text-sm font-extrabold text-white" style={{ background: ACCENT }}>Enviar pedido</div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-center text-xs font-bold">
          <div className="rounded-xl border border-black/10 py-2">Chamar garçom</div>
          <div className="rounded-xl border border-black/10 py-2">Pedir a conta</div>
        </div>
      </div>
      <div className="absolute bottom-0 right-2 w-[170px] rotate-3 rounded-lg bg-white p-3 font-mono text-[11px] leading-tight text-black shadow-xl">
        <div className="border-b border-dashed border-black/40 pb-1 text-center font-bold">BAR</div>
        <div className="py-1 text-center text-base font-extrabold">MESA 12</div>
        <div>2x Caipirinha</div>
        <div className="font-bold underline">OBS: pouco gelo</div>
      </div>
    </div>
  );
}

const JORNADA = [
  {
    n: "01", Icon: IconBag, eyebrow: "O pedido",
    title: "Seu cliente monta o pedido exato.", accent: "E o preço nunca sai errado.",
    desc: "No seu link, o cliente monta sozinho — açaí no copo, pizza meio a meio, combo com adicionais — e vê o preço subir ao vivo. O sistema confere o valor de novo antes de aceitar o pedido — ninguém consegue mexer no preço pelo celular.",
    pills: ["Açaí no copo", "Pizza meio a meio", "Combos e adicionais", "Sem app pra baixar"],
    mock: <PhoneFrame src="/site/cardapio-pizzaria.jpg" alt="Cardápio digital de pizzaria no ComandaPRO" caption="Cardápio de exemplo · pizzaria" href="/pizzaria-teste-dell" />,
  },
  {
    n: "02", Icon: IconMoto, eyebrow: "Delivery próprio",
    title: "Todo pedido cai no seu balcão.", accent: "Zero comissão.",
    desc: "Entrega pelo seu link, com a sua taxa por bairro e pedido mínimo. O cliente escolhe Pix, cartão ou dinheiro com troco e acompanha por um código de rastreio. Entrou pedido, o sistema apita e imprime sozinho — em qualquer tela que você esteja.",
    pills: ["0% de comissão", "Taxa por bairro", "Pix / cartão / dinheiro com troco", "Rastreio por código", "Apita e imprime sozinho"],
    mock: <BrowserFrame src="/site/tela-pedidos.jpg" alt="Painel de pedidos de delivery do ComandaPRO — kanban em preparo, saiu e concluído" />,
  },
  {
    n: "03", Icon: IconTable, eyebrow: "Comanda & mesa",
    title: "Cada mesa com a conta certa,", accent: "na hora.",
    desc: "Uma comanda por mesa, cada garçom com o seu acesso lança pelo celular e cada item já vai roteado pra cozinha ou pro bar — tudo registrado. Couvert, dose e a taxa de 10% entram automático, e a conta divide sem erro na hora de fechar.",
    pills: ["Comanda por mesa", "App do garçom", "Couvert e dose", "Taxa de serviço 10%", "Divisão de conta"],
    mock: <BrowserFrame src="/site/tela-mesas.jpg" alt="Mapa de mesas com comandas abertas e total por mesa no ComandaPRO" />,
  },
  {
    n: "03b", Icon: IconTable, eyebrow: "Cardápio na mesa",
    title: "O cliente pede da mesa.", accent: "O bar já recebe impresso.",
    desc: "O cliente escaneia o QR da mesa, monta o pedido e envia — sem chamar ninguém. O drink sai na impressora do bar e o prato na da cozinha, com o número da mesa grande e a observação do cliente. Pela mesma tela ele chama o garçom ou pede a conta, e o aviso aparece na hora no painel. Tudo opcional: se preferir, o cardápio fica só pra consulta e quem lança é o garçom.",
    pills: ["QR por mesa", "Sai na impressora certa", "Mesa e observação no cupom", "Chamar garçom", "Pedir a conta", "Liga e desliga"],
    mock: <MesaQrMock />,
  },
  {
    n: "04", Icon: IconPrinter, eyebrow: "Cozinha",
    title: "A via de preparo sai", accent: "na impressora certa.",
    desc: "Pedido de cozinha imprime na cozinha, de bar no bar — a via de preparo sai sem preço, só o que a equipe faz. Funciona em qualquer térmica 80mm: o sistema calibra a largura até parar de cortar.",
    pills: ["Roteamento por estação", "Via de preparo sem preço", "Qualquer térmica 80mm", "Corte automático", "Gaveta na venda em dinheiro"],
    mock: <ScreenMock title="Via da cozinha" badge="#1043" rows={[{ label: "1x Açaí 500ml", on: true }, { label: "  sem banana, extra granola" }, { label: "1x Pizza meio a meio", on: true }, { label: "  calabresa / frango" }]} footer={{ label: "Mesa", value: "06" }} />,
  },
  {
    n: "05", Icon: IconWallet, eyebrow: "Caixa & gestão",
    title: "O caixa fecha conferido,", accent: "no fim da noite.",
    desc: "Toda venda — mesa, balcão e delivery — cai no mesmo caixa. Abre com fundo de troco, registra sangria e suprimento, e no fim confere dinheiro, cartão e Pix mostrando quebra ou sobra. E cada venda já baixa o estoque e congela o custo (CMV) sozinha.",
    pills: ["Caixa unificado", "Fundo de troco", "Sangria e suprimento", "Conferência tripla", "Baixa de estoque + CMV"],
    mock: <BrowserFrame src="/site/tela-financeiro.jpg" alt="Painel financeiro do ComandaPRO com entradas, saldo e receita por forma de pagamento" />,
  },
];

// Paleta COERENTE — família QUENTE (coral → laranja → telha → framboesa), unificada pelo destaque
// amarelo + cards brancos + marca d'água. Coerente com o logo coral. Estilo painéis do Expresso.
const PANEL_COLORS = [
  "linear-gradient(135deg, #FF8A3D 0%, #F5480C 100%)",
  "linear-gradient(135deg, #FB923C 0%, #EA580C 100%)",
  "linear-gradient(135deg, #F97316 0%, #C2410C 100%)",
  "linear-gradient(135deg, #FB7185 0%, #E11D48 100%)",
  "linear-gradient(135deg, #F5480C 0%, #B91C1C 100%)",
];
function FuncionalidadesSection() {
  return (
    <section id="funcionalidades" className="relative z-10 mx-auto max-w-6xl px-5 py-16">
      <div className="mx-auto max-w-2xl text-center">
        <span className="text-sm font-bold uppercase tracking-wider" style={{ color: ACCENT }}>Como funciona</span>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl" style={{ color: INK }}>Do pedido ao caixa, sem trocar de sistema</h2>
        <p className="mt-4 text-lg text-[#6B5D52]">Cada etapa do seu dia num sistema só — e todas conversam entre si.</p>
      </div>
      <div className="mt-14 space-y-8">
        {JORNADA.map((f, i) => (
          <ColorPanel
            key={f.n}
            color={PANEL_COLORS[i % PANEL_COLORS.length]}
            eyebrow={f.eyebrow} EyeIcon={f.Icon}
            title={f.title} accent={f.accent} desc={f.desc} pills={f.pills}
            mock={<div className="w-full">{f.mock}</div>}
            reverse={i % 2 === 1}
          />
        ))}
      </div>
    </section>
  );
}

// ── MULTI-SEGMENTO: prova com cardápios REAIS (Cantinho açaí × Medellín bar) lado a lado.
function MultiSegmentoSection() {
  const casos = [
    { src: "/site/cardapio-acai.jpg", alt: "Cardápio do Cantinho do Açaí no ComandaPRO", href: "/cantinho-do-acai", nome: "Açaiteria", d: "Monta no copo, vende por peso, os primeiros adicionais grátis e fidelidade por pontos." },
    { src: "/site/cardapio-bar.jpg", alt: "Cardápio do Medellín Music Bar no ComandaPRO", href: "/medellin", nome: "Bar & Petiscaria", d: "Comanda por mesa, couvert, dose e garrafa, taxa de serviço e divisão de conta." },
  ];
  return (
    <section className="relative z-10 mx-auto max-w-6xl px-5 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <span className="text-sm font-bold uppercase tracking-wider" style={{ color: ACCENT }}>Multi-segmento</span>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Um sistema. A cara do seu negócio.</h2>
        <p className="mt-4 text-lg text-[#6B5D52]">O cardápio, as regras e as telas mudam conforme o que você vende — não é sistema genérico. Estes são dois clientes reais rodando no ComandaPRO agora — toque pra abrir o cardápio deles:</p>
      </div>
      <div className="mx-auto mt-12 grid max-w-3xl gap-10 sm:grid-cols-2">
        {casos.map((c) => (
          <div key={c.nome} className="flex flex-col items-center text-center">
            <PhoneFrame src={c.src} alt={c.alt} href={c.href} />
            <div className="mt-4 text-lg font-extrabold" style={{ color: INK }}>{c.nome}</div>
            <p className="mt-1 max-w-xs text-sm text-[#6B5D52]">{c.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── FIDELIDADE / PONTUAÇÃO (o Eduardo destacou). Regras reais do loyalty.ts.
// Painel colorido (mesmo estilo Expresso das funcionalidades) — fecha a coerência visual da home.
function FidelidadeSection() {
  return (
    <section className="relative z-10 mx-auto max-w-6xl px-5 py-8">
      <ColorPanel
        color={PANEL_COLORS[4]}
        eyebrow="Fidelidade"
        EyeIcon={IconGift}
        title="Cada compra vira"
        accent="motivo pra voltar."
        desc="O cliente ganha pontos por compra e troca por um item seu — nunca por dinheiro nem desconto. Ele consulta o saldo pelo telefone, vê quanto falta pro prêmio, e o próprio cupom imprime 'faltam X pontos pro açaí grátis'. Você define as regras: pontos por real ou fixos por compra, valor mínimo, dia turbo e validade."
        pills={["Pontos por compra", "Resgate por item", "Meus pontos por telefone", "Dia turbo (2×)", "Nunca vira dinheiro"]}
        mock={<ScreenMock title="Meus pontos" badge="cliente" rows={[{ label: "Seu saldo", value: "120 pts", on: true }, { label: "Copo 350ml grátis", value: "100 pts" }, { label: "Combo grátis", value: "180 pts" }]} footer={{ label: "Falta pro próximo prêmio", value: "60 pts" }} />}
      />
    </section>
  );
}

// ── PREÇO (número real do billing.ts — fonte única, nunca hardcodar).
function PrecoSection() {
  return (
    <section id="precos" className="relative z-10 mx-auto max-w-6xl px-5 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <span className="text-sm font-bold uppercase tracking-wider" style={{ color: ACCENT }}>Preço</span>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Um plano. Tudo incluso.</h2>
        <p className="mt-4 text-lg text-[#6B5D52]">Cardápio montado por nós, sem taxa de setup, sem comissão por pedido e sem contrato de permanência.</p>
      </div>
      <div className="mx-auto mt-12 max-w-md rounded-3xl border border-black/[0.06] bg-white shadow-sm p-8 text-center" style={{ boxShadow: `0 30px 80px -30px ${ACCENT}55` }}>
        <div className="text-sm font-semibold text-[#6B5D52]">a partir de</div>
        <div className="mt-1 flex items-end justify-center gap-1">
          <span className="text-5xl font-extrabold tracking-tight">R$ {BILLING.planos.anual.equivMes}</span>
          <span className="mb-1 text-lg font-semibold text-[#6B5D52]">/mês</span>
        </div>
        <div className="mt-1 text-sm text-[#6B5D52]">no plano anual · R$ {BILLING.planos.mensal.equivMes}/mês no mensal</div>
        <ul className="mt-6 space-y-2 text-left">
          {INCLUSO.map((i) => (
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

// ── FAQ com <details> nativo: semântico, sem JS, ótimo pra Google/LLM ler.
function FaqSection() {
  return (
    <section id="faq" className="relative z-10 mx-auto max-w-3xl px-5 py-20">
      <div className="text-center">
        <span className="text-sm font-bold uppercase tracking-wider" style={{ color: ACCENT }}>Dúvidas</span>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Perguntas frequentes</h2>
      </div>
      <div className="mt-10 space-y-3">
        {FAQS.map((f) => (
          <details key={f.q} className="group rounded-2xl border border-black/[0.06] bg-white shadow-sm px-5 py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between font-bold" style={{ color: INK }}>
              {f.q}
              <span className="ml-4 text-[#8A7B6E] transition group-open:rotate-45" style={{ color: ACCENT }}>+</span>
            </summary>
            <p className="mt-3 text-[#5A4F45]">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

// ── CTA final
function CtaFinal() {
  return (
    <section id="demonstracao" className="relative z-10 mx-auto max-w-4xl px-5 py-20 text-center">
      <div className="rounded-[32px] border border-black/[0.06] bg-white shadow-sm px-8 py-16" style={{ background: `radial-gradient(120% 120% at 50% 0%, ${ACCENT}22 0%, transparent 60%)` }}>
        <h2 className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">Bota o seu food service num sistema só.</h2>
        <p className="mx-auto mt-4 max-w-lg text-lg text-[#5A4F45]">Testa {BILLING.trialDias} dias grátis. Sem cartão, sem setup, sem comissão.</p>
        <Link href="/cadastro" className="mt-8 inline-flex items-center gap-2 rounded-full px-8 py-4 text-[15px] font-bold text-white transition hover:opacity-90" style={{ background: ACCENT, boxShadow: `0 14px 40px ${ACCENT}66` }}>
          Começar agora <IconArrowRight width={18} height={18} />
        </Link>
        <div className="mt-5">
          <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-[15px] font-bold transition hover:underline" style={{ color: INK }}>
            <span style={{ color: "#16A34A" }}><IconWhatsapp width={18} height={18} /></span> ou fale com a gente no WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
}

// ── Rodapé (links pras segmentadas + institucional)
function SiteFooter() {
  return (
    <footer className="relative z-10 mt-10 text-white" style={{ background: "linear-gradient(135deg, #241C17 0%, #141018 100%)" }}>
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
              <li><Link href="/respostas" className="transition hover:text-white">Respostas</Link></li>
              <li><a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="transition hover:text-white">WhatsApp</a></li>
              <li><a href="#precos" className="transition hover:text-white">Preço</a></li>
              <li><a href="#faq" className="transition hover:text-white">Dúvidas</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-12 border-t border-white/10 pt-6 text-xs text-white/45">© {new Date().getFullYear()} ComandaPRO · Impulso Digital</div>
      </div>
    </footer>
  );
}

// ── JSON-LD (SoftwareApplication + FAQPage): AEO técnico que o AgendaPRO não faz.
function JsonLd() {
  const data = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "ComandaPRO",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description: "Sistema de food service: cardápio digital, comanda, mesa, delivery próprio sem comissão, PDV e caixa num sistema só.",
      offers: { "@type": "Offer", price: String(BILLING.planos.mensal.equivMes), priceCurrency: "BRL" },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ];
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

// ── HERO + PRODUTO AO VIVO (redesign 23/09/2026) ─────────────────────────────────────────────
// Movimento só com transform/opacity (DESIGN.md) e desligado em prefers-reduced-motion.
const HERO_CSS = `
@keyframes cp-draw { from { stroke-dashoffset: 1 } to { stroke-dashoffset: 0 } }
@keyframes cp-rise { from { opacity: 0; transform: translateY(18px) } to { opacity: 1; transform: none } }
@keyframes cp-zoom { from { transform: scale(1.08) } to { transform: scale(1) } }
@keyframes cp-toast { 0%,8% { opacity:0; transform: translateY(-16px) } 14%,70% { opacity:1; transform:none } 78%,100% { opacity:0; transform: translateY(-8px) } }
@keyframes cp-ticket { 0%,22% { opacity:0; transform: translateY(40px) rotate(-3deg) } 32%,72% { opacity:1; transform: translateY(0) rotate(-3deg) } 82%,100% { opacity:0; transform: translateY(12px) rotate(-3deg) } }
@keyframes cp-card { 0%,4% { opacity:0; transform: translateX(28px) scale(.96) } 12%,74% { opacity:1; transform:none } 84%,100% { opacity:0; transform: translateX(0) scale(.98) } }
@keyframes cp-ping { 0% { transform: scale(1); opacity:.7 } 80%,100% { transform: scale(2.4); opacity:0 } }
.cp-draw path { stroke-dasharray: 1; stroke-dashoffset: 1; animation: cp-draw .9s cubic-bezier(.65,0,.35,1) .7s forwards }
.cp-rise { opacity: 0; animation: cp-rise .7s cubic-bezier(.175,.885,.32,1.1) forwards }
.cp-zoom { animation: cp-zoom 2.4s cubic-bezier(.2,.7,.2,1) forwards }
.cp-toast { animation: cp-toast 7s ease-in-out infinite }
.cp-ticket { animation: cp-ticket 7s ease-in-out infinite }
.cp-card { animation: cp-card 7s ease-in-out infinite }
.cp-ping { animation: cp-ping 1.6s cubic-bezier(0,0,.2,1) infinite }
@media (prefers-reduced-motion: reduce) {
  .cp-draw path { animation: none; stroke-dashoffset: 0 }
  .cp-rise, .cp-zoom, .cp-toast, .cp-ticket, .cp-card, .cp-ping { animation: none; opacity: 1; transform: none }
}`;

function HeroMovimento() {
  return (
    <section className="relative z-10 px-3 pt-3 sm:px-4 sm:pt-4">
      <style dangerouslySetInnerHTML={{ __html: HERO_CSS }} />
      <div className="relative isolate overflow-hidden rounded-[28px] sm:rounded-[36px]" style={{ background: "#1a120d" }}>
        {/* foto: Unsplash (Nicolas J Leclercq, id KBjDo_QA1lY), espelhada pra deixar a esquerda livre pro texto */}
        <picture>
          <source media="(min-width: 768px)" srcSet="/site/hero-cozinha-1920.jpg" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/site/hero-cozinha-900.jpg" alt="Cozinha de restaurante em plena correria" fetchPriority="high"
            className="cp-zoom absolute inset-0 -z-10 h-full w-full object-cover" />
        </picture>
        {/* legibilidade: escurece de baixo (celular) e da esquerda (desktop) */}
        <div aria-hidden className="absolute inset-0 -z-10" style={{ background: "linear-gradient(180deg, rgba(20,12,8,.1) 0%, rgba(20,12,8,.35) 45%, rgba(20,12,8,.9) 100%)" }} />
        <div aria-hidden className="absolute inset-0 -z-10 hidden md:block" style={{ background: "linear-gradient(90deg, rgba(20,12,8,.8) 0%, rgba(20,12,8,.5) 32%, rgba(20,12,8,0) 60%)" }} />

        <div className="mx-auto flex min-h-[640px] max-w-[1560px] flex-col justify-end px-6 pb-10 pt-40 sm:min-h-[700px] md:justify-center md:pb-16 md:pt-16 lg:px-14 2xl:min-h-[760px] 2xl:px-20">
          <div className="max-w-[640px] text-white 2xl:max-w-[760px]">
            <h1>
              <span className="cp-rise block text-sm font-bold uppercase tracking-[0.18em] text-white/70" style={{ animationDelay: ".05s" }}>
                Sistema pra food service
              </span>
              <span className="cp-rise mt-4 block text-[3.1rem] font-extrabold leading-[0.98] tracking-tight sm:text-7xl lg:text-[5.4rem] 2xl:text-[6.4rem]" style={{ animationDelay: ".15s" }}>
                Feito pro{" "}
                <span className="relative inline-block whitespace-nowrap">
                  movimento.
                  {/* traço à mão (SVG) — desenha depois do título entrar */}
                  <svg aria-hidden viewBox="0 0 300 90" preserveAspectRatio="none" className="cp-draw pointer-events-none absolute -left-[8%] -top-[8%] h-[128%] w-[116%]">
                    <path pathLength={1} d="M40 20 C 110 4, 238 6, 282 26 C 304 38, 296 66, 250 78 C 180 92, 60 90, 22 70 C 2 58, 6 34, 36 24 C 60 16, 90 12, 120 12" fill="none" stroke={ACCENT} strokeWidth="4" strokeLinecap="round" />
                  </svg>
                </span>
              </span>
            </h1>
            <p className="cp-rise mt-6 max-w-[520px] text-lg leading-relaxed text-white/85 sm:text-xl 2xl:max-w-[600px] 2xl:text-2xl" style={{ animationDelay: ".3s" }}>
              Cardápio, comanda, mesa, cozinha, delivery e caixa no mesmo lugar. Você cria a conta e a gente monta o seu cardápio, incluso na mensalidade.
            </p>
            <div className="cp-rise mt-8 flex flex-wrap items-center gap-3" style={{ animationDelay: ".42s" }}>
              <Link href="/cadastro" className="inline-flex items-center gap-2 rounded-full px-7 py-4 text-[15px] font-bold text-white transition hover:opacity-90" style={{ background: ACCENT, boxShadow: `0 14px 34px ${ACCENT}66` }}>
                Começar agora <IconArrowRight width={18} height={18} />
              </Link>
              <a href={DEMO_URL} target="_blank" rel="noopener" className="inline-flex items-center gap-2 rounded-full border border-white/35 px-7 py-4 text-[15px] font-bold text-white backdrop-blur-sm transition hover:bg-white/10">
                Ver cardápio de demonstração
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* rodando em: clientes reais (os dois já aparecem no site como clientes reais) */}
      <div className="mx-auto flex max-w-[1560px] flex-wrap items-center gap-x-8 gap-y-2 px-6 py-6 lg:px-14 2xl:px-20">
        <span className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: MUT }}>Rodando agora em</span>
        <a href="/cantinho-do-acai" target="_blank" rel="noopener" className="text-lg font-extrabold tracking-tight transition hover:opacity-70" style={{ color: INK }}>Cantinho do Açaí</a>
        <a href="/medellin" target="_blank" rel="noopener" className="font-serif text-lg font-bold transition hover:opacity-70" style={{ color: INK }}>Medellín Music Bar</a>
      </div>
    </section>
  );
}

// Produto em ação (padrão Square/Stripe): o painel real grande, em fundo escuro, com o pedido
// chegando animado. Cada animação conta um pedaço do fluxo: chega o aviso → o card entra na coluna →
// o cupom sai na estação. Não é vídeo: é CSS em cima do print real (leve, sem autoplay de mídia).
function ProdutoAoVivo() {
  return (
    <section className="relative z-10 px-3 sm:px-4">
      <div className="relative overflow-hidden rounded-[28px] px-5 py-14 sm:rounded-[36px] sm:px-10 sm:py-20" style={{ background: "radial-gradient(120% 90% at 80% 0%, #2a1d16 0%, #120c09 60%)" }}>
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
        <div className="relative mx-auto max-w-6xl">
          <h2 className="max-w-3xl text-3xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-5xl">
            Entrou pedido, todo mundo vê.{" "}
            <span style={{ color: "#A8998C" }}>O salão, a cozinha e o caixa na mesma tela, na hora.</span>
          </h2>

          <div className="relative mt-12 sm:mt-16">
            <div className="overflow-hidden rounded-2xl border border-white/10 shadow-2xl" style={{ boxShadow: `0 40px 120px -30px ${ACCENT}55, 0 20px 60px rgba(0,0,0,.6)` }}>
              <div className="flex items-center gap-1.5 bg-[#1d1511] px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" /><span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" /><span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                <span className="ml-3 truncate rounded-md bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-white/60">comandapro.net.br/admin · Pedidos</span>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/site/tela-pedidos.jpg" alt="Painel de pedidos do ComandaPRO com pedidos em preparo, prontos e concluídos" loading="lazy" className="w-full" />
            </div>

            {/* aviso de pedido novo */}
            <div className="cp-toast absolute -top-5 right-2 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-2xl sm:-top-6 sm:right-8">
              <span className="relative flex h-3 w-3"><span className="cp-ping absolute inline-flex h-full w-full rounded-full" style={{ background: ACCENT }} /><span className="relative inline-flex h-3 w-3 rounded-full" style={{ background: ACCENT }} /></span>
              <div className="text-left">
                <div className="text-sm font-extrabold" style={{ color: INK }}>Novo pedido · Mesa 12</div>
                <div className="text-xs" style={{ color: MUT }}>2× Caipirinha · 1× Fritas</div>
              </div>
            </div>

            {/* card entrando na coluna (desktop) */}
            <div className="cp-card absolute left-[23%] top-[37%] hidden w-[23%] min-w-[200px] rounded-xl border-2 bg-white p-3 shadow-2xl md:block" style={{ borderColor: ACCENT }}>
              <div className="flex items-center justify-between text-xs font-bold"><span style={{ color: INK }}>#233 · Mesa 12</span><span className="rounded-full px-2 py-0.5 text-white" style={{ background: ACCENT }}>novo</span></div>
              <div className="mt-2 space-y-1 text-xs" style={{ color: MUT }}><div>2× Caipirinha</div><div>1× Porção de fritas</div></div>
            </div>

            {/* cupom saindo na estação */}
            <div className="cp-ticket absolute -bottom-8 left-3 w-[150px] rounded-md bg-white p-3 font-mono text-[11px] leading-tight text-black shadow-2xl sm:-bottom-10 sm:left-auto sm:right-10 sm:w-[180px]">
              <div className="border-b border-dashed border-black/40 pb-1 text-center font-bold">BAR</div>
              <div className="py-1.5 text-center text-lg font-extrabold">MESA 12</div>
              <div>2x Caipirinha</div>
              <div className="font-bold underline">OBS: pouco gelo</div>
            </div>
          </div>

          <div className="mt-20 grid gap-8 text-white/80 sm:grid-cols-3">
            {[
              { t: "O aviso chega na hora", d: "Pedido do link, da mesa ou do balcão apita no painel, em qualquer tela." },
              { t: "Cada estação recebe o seu", d: "Drink sai no bar, prato sai na cozinha, com a mesa e a observação." },
              { t: "O caixa já sabe", d: "Quando a mesa fecha, a venda entra no caixa e baixa o estoque." },
            ].map((x) => (
              <div key={x.t} className="border-t border-white/15 pt-5">
                <div className="text-base font-bold text-white">{x.t}</div>
                <p className="mt-1.5 text-sm leading-relaxed">{x.d}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Chip({ Icon, label }: { Icon: React.ComponentType<{ width?: number; height?: number }>; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-black/[0.06] bg-white shadow-sm px-3 py-1.5 text-[13px] font-semibold text-[#5A4F45]">
      <span style={{ color: ACCENT }}><Icon width={15} height={15} /></span>
      {label}
    </div>
  );
}

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden" style={{ background: CREAM, color: INK }}>
      {/* washes de cor quentes — food, vivo (não mais preto chapado) */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="site-glow absolute -right-32 -top-32 h-[38rem] w-[38rem] rounded-full opacity-70 blur-3xl" style={{ background: "radial-gradient(circle, #FFE0C2 0%, transparent 70%)", animation: "aurora-a 26s ease-in-out infinite" }} />
        <div className="site-glow absolute -left-40 top-24 h-[32rem] w-[32rem] rounded-full opacity-60 blur-3xl" style={{ background: `radial-gradient(circle, ${ACCENT}33 0%, transparent 70%)`, animation: "aurora-b 32s ease-in-out infinite" }} />
        <div className="site-glow absolute left-1/2 top-[52%] h-[30rem] w-[30rem] rounded-full opacity-50 blur-3xl" style={{ background: "radial-gradient(circle, #FFD1E3 0%, transparent 70%)", animation: "aurora-c 30s ease-in-out infinite" }} />
      </div>

      {/* NAV com menu (header colorido, sticky) */}
      <div className="sticky top-0 z-30 text-white shadow-lg" style={{ background: "linear-gradient(90deg, #FF8A3D 0%, #F5480C 100%)" }}>
        <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-10">
            <Logo light />
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
              <Link href="/respostas" className="transition hover:text-white">Respostas</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" aria-label="Falar no WhatsApp" className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-white/90 transition hover:text-white">
              <IconWhatsapp width={18} height={18} /> <span className="hidden md:inline">WhatsApp</span>
            </a>
            <Link href="/login" className="hidden text-[15px] font-semibold text-white/85 transition hover:text-white sm:block">Entrar</Link>
            <Link href="/cadastro" className="rounded-full bg-white px-5 py-2.5 text-sm font-extrabold transition hover:bg-white/90" style={{ color: "#F5480C" }}>Começar agora</Link>
          </div>
        </header>
      </div>

      {/* HERO (23/09) — foto real em tela cheia (padrão Toast), título curto com traço à mão.
          Substitui a montagem de telas pequena, que era a maior "cara de template". */}
      <HeroMovimento />
      <ProdutoAoVivo />
      <Reveal><SegmentosSection /></Reveal>
      <Reveal><DorSection /></Reveal>
      <Reveal><ComoComecarSection /></Reveal>
      <Reveal><FuncionalidadesSection /></Reveal>
      <Reveal><MultiSegmentoSection /></Reveal>
      <Reveal><FidelidadeSection /></Reveal>
      <Reveal><PrecoSection /></Reveal>
      <Reveal><FaqSection /></Reveal>
      <Reveal><CtaFinal /></Reveal>
      <SiteFooter />
      <JsonLd />
      <CadastroModal />
    </main>
  );
}
