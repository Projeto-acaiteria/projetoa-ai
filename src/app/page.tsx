import type { Metadata } from "next";
import Link from "next/link";
import { IconArrowRight, IconTable, IconReceipt, IconMoto, IconWallet, IconCard, IconBox, IconChart, IconPrinter, IconCheck, IconBag, IconGift } from "@/components/Icons";
import { BILLING } from "@/config/billing";
import { NICHOS } from "@/config/marketing";

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
  { q: "Preciso pagar comissão por pedido?", a: "Não. Você paga só a mensalidade. O pedido chega pelo seu link e o valor da venda é todo seu — sem o marketplace levando percentual." },
  { q: "Meu cliente precisa baixar aplicativo?", a: "Não. Ele faz o pedido pelo link do seu cardápio, direto no navegador do celular, sem instalar nada." },
  { q: "Serve pro meu tipo de negócio?", a: "Sim. Açaiteria, bar, petiscaria, hamburgueria, pizzaria, sushi e mais — cada negócio liga só as funcionalidades que usa." },
  { q: "Funciona com impressora térmica?", a: "Sim. Impressão térmica 80mm, roteando a via da cozinha e do balcão para a impressora certa de cada estação." },
  { q: "Consigo vender por peso, tipo açaí e marmita?", a: "Sim. O ComandaPRO trabalha com venda por peso (R$/kg) integrando a balança ou digitando as gramas." },
  { q: "Quanto custa?", a: `A partir de R$ ${BILLING.planos.anual.equivMes}/mês no plano anual (R$ ${BILLING.planos.mensal.equivMes}/mês no mensal), com ${BILLING.trialDias} dias grátis e sem taxa de setup.` },
  { q: "Preciso de vários sistemas diferentes?", a: "Não. Cardápio, comanda, mesa, cozinha, delivery, caixa e estoque estão num sistema só, e todos conversam entre si." },
];

const INCLUSO = [
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
const ACCENT = "#6366F1";

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
      className="w-full max-w-md rounded-[26px] border border-white/10 bg-white/[0.03] p-3 shadow-2xl backdrop-blur"
      style={{ boxShadow: `0 30px 80px -20px ${ACCENT}55, 0 10px 40px rgba(0,0,0,.5)` }}
    >
      <div className="rounded-[18px] bg-[#0b1020] p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <IconTable width={16} height={16} /> Mesas
          </div>
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-slate-300">Salão · agora</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {mesas.map((m) => (
            <div
              key={m.n}
              className={`rounded-xl border p-2 text-center ${
                m.on ? "border-transparent bg-[#6366F1]/15" : "border-white/10 bg-white/[0.02]"
              }`}
            >
              <div className="text-[11px] font-bold text-slate-400">Mesa {m.n}</div>
              <div className={`mt-1 text-[11px] font-extrabold tabular-nums ${m.on ? "text-white" : "text-slate-600"}`}>
                {m.v ?? "livre"}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2.5">
          <span className="text-[11px] font-semibold text-slate-400">Aberto no salão</span>
          <span className="text-sm font-extrabold text-white tabular-nums">R$ 584,00</span>
        </div>
      </div>
    </div>
  );
}

// ── Seção DOR: dor antes da solução (método Expresso). Cada dor é respondida por uma
// funcionalidade mais abaixo na página. Tom de dono, direto.
const DORES = [
  { Icon: IconCard, t: "O iFood leva quase 30% de cada pedido", d: "Você trabalha, o cliente paga — e o app fica com o pedaço que era seu lucro." },
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
          <div key={d.t} className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: "rgba(245,158,11,.12)", color: "#F59E0B" }}>
              <d.Icon width={20} height={20} />
            </div>
            <div>
              <div className="font-bold text-white">{d.t}</div>
              <p className="mt-1 text-sm leading-relaxed text-slate-400">{d.d}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-10 text-center text-lg font-semibold text-slate-300">
        O ComandaPRO resolve as quatro — <span style={{ color: ACCENT }}>num sistema só.</span>
      </p>
    </section>
  );
}

// ── Seção FUNCIONALIDADES: agrupadas pela JORNADA DO DONO (método Expresso). Cada bloco =
// headline-benefício + mini-tela renderizada (honesta; trocar por print real depois) + pills.
type Row = { label: string; value?: string; on?: boolean };
function ScreenMock({ title, badge, rows, footer }: { title: string; badge?: string; rows: Row[]; footer?: { label: string; value: string } }) {
  return (
    <div className="w-full max-w-sm rounded-[22px] border border-white/10 bg-white/[0.03] p-2.5 shadow-2xl backdrop-blur" style={{ boxShadow: `0 26px 70px -24px ${ACCENT}44, 0 8px 30px rgba(0,0,0,.5)` }}>
      <div className="rounded-[15px] bg-[#0b1020] p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-bold text-white">{title}</span>
          {badge && <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-slate-300">{badge}</span>}
        </div>
        <div className="space-y-1.5">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
              <span className={`text-[13px] font-semibold ${r.on ? "text-white" : "text-slate-300"}`}>{r.label}</span>
              {r.value && <span className={`text-[13px] font-bold tabular-nums ${r.on ? "" : "text-slate-300"}`} style={r.on ? { color: ACCENT } : undefined}>{r.value}</span>}
            </div>
          ))}
        </div>
        {footer && (
          <div className="mt-3 flex items-center justify-between rounded-lg bg-white/[0.05] px-3 py-2.5">
            <span className="text-[12px] font-semibold text-slate-400">{footer.label}</span>
            <span className="text-sm font-extrabold text-white tabular-nums">{footer.value}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Moldura de NAVEGADOR com print real das telas do dono (admin desktop).
function BrowserFrame({ src, alt }: { src: string; alt: string }) {
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

// Moldura de celular com PRINT REAL do sistema (não mockup).
function PhoneFrame({ src, alt, caption }: { src: string; alt: string; caption?: string }) {
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

const JORNADA = [
  {
    n: "01", Icon: IconBag, eyebrow: "O pedido",
    title: "Seu cliente monta o pedido exato.", accent: "E o preço nunca sai errado.",
    desc: "No seu link, o cliente monta sozinho — açaí no copo, pizza meio a meio, combo com adicionais — e vê o preço subir ao vivo. Quem calcula é o servidor, não o navegador: não tem como o cliente forçar preço errado.",
    pills: ["Açaí no copo", "Pizza meio a meio", "Combos e adicionais", "Sem app pra baixar"],
    mock: <PhoneFrame src="/site/cardapio-acai.jpg" alt="Cardápio digital do Cantinho do Açaí no ComandaPRO" caption="Cardápio real · Cantinho do Açaí" />,
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
    desc: "Uma comanda por mesa, o garçom lança pelo celular e cada item já vai roteado pra cozinha ou pro bar. Couvert, dose e a taxa de 10% entram automático, e a conta divide sem erro na hora de fechar.",
    pills: ["Comanda por mesa", "App do garçom", "Couvert e dose", "Taxa de serviço 10%", "Divisão de conta"],
    mock: <BrowserFrame src="/site/tela-mesas.jpg" alt="Mapa de mesas com comandas abertas e total por mesa no ComandaPRO" />,
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

function FuncionalidadesSection() {
  return (
    <section id="funcionalidades" className="relative z-10 mx-auto max-w-6xl px-5 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <span className="text-sm font-bold uppercase tracking-wider" style={{ color: ACCENT }}>Como funciona</span>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Do pedido ao caixa, sem trocar de sistema</h2>
        <p className="mt-4 text-lg text-slate-400">Cada etapa do seu dia numa tela só — e todas conversam entre si.</p>
      </div>

      <div className="mt-16 space-y-16">
        {JORNADA.map((f, i) => (
          <div key={f.n} className={`grid items-center gap-10 lg:grid-cols-2 ${i % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""}`}>
            <div>
              <div className="mb-4 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider" style={{ color: ACCENT }}>
                <f.Icon width={16} height={16} /> {f.n} · {f.eyebrow}
              </div>
              <h3 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
                {f.title} <span style={{ color: ACCENT }}>{f.accent}</span>
              </h3>
              <p className="mt-4 max-w-md text-slate-300">{f.desc}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {f.pills.map((p) => (
                  <span key={p} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] font-semibold text-slate-300">{p}</span>
                ))}
              </div>
            </div>
            <div className="flex justify-center">{f.mock}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── MULTI-SEGMENTO: prova com cardápios REAIS (Cantinho açaí × Medellín bar) lado a lado.
function MultiSegmentoSection() {
  const casos = [
    { src: "/site/cardapio-acai.jpg", alt: "Cardápio de açaiteria no ComandaPRO", nome: "Açaiteria", d: "Monta no copo, vende por peso, adicional grátis-até-N e fidelidade por pontos." },
    { src: "/site/cardapio-bar.jpg", alt: "Cardápio de bar no ComandaPRO", nome: "Bar & Petiscaria", d: "Comanda por mesa, couvert, dose e garrafa, taxa de serviço e divisão de conta." },
  ];
  return (
    <section className="relative z-10 mx-auto max-w-6xl px-5 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <span className="text-sm font-bold uppercase tracking-wider" style={{ color: ACCENT }}>Multi-segmento</span>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Um sistema. A cara do seu negócio.</h2>
        <p className="mt-4 text-lg text-slate-400">O cardápio, as regras e as telas mudam conforme o que você vende — não é sistema genérico. Estes são dois clientes reais rodando no ComandaPRO agora:</p>
      </div>
      <div className="mx-auto mt-12 grid max-w-3xl gap-10 sm:grid-cols-2">
        {casos.map((c) => (
          <div key={c.nome} className="flex flex-col items-center text-center">
            <PhoneFrame src={c.src} alt={c.alt} />
            <div className="mt-4 text-lg font-extrabold text-white">{c.nome}</div>
            <p className="mt-1 max-w-xs text-sm text-slate-400">{c.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── FIDELIDADE / PONTUAÇÃO (o Eduardo destacou). Regras reais do loyalty.ts.
function FidelidadeSection() {
  return (
    <section className="relative z-10 mx-auto max-w-6xl px-5 py-20">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider" style={{ color: ACCENT }}>
            <IconGift width={16} height={16} /> Fidelidade
          </div>
          <h3 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
            Cada compra vira <span style={{ color: ACCENT }}>motivo pra voltar.</span>
          </h3>
          <p className="mt-4 max-w-md text-slate-300">
            O cliente ganha pontos por compra e troca por um item seu — nunca por dinheiro nem desconto. Ele consulta o saldo pelo telefone, vê quanto falta pro prêmio, e o próprio cupom imprime &ldquo;faltam X pontos pro açaí grátis&rdquo;. Você define as regras: pontos por real ou fixos por compra, valor mínimo, dia turbo e validade.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {["Pontos por compra", "Resgate por item", "Meus pontos por telefone", "Dia turbo (2×)", "Nunca vira dinheiro"].map((p) => (
              <span key={p} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] font-semibold text-slate-300">{p}</span>
            ))}
          </div>
        </div>
        <div className="flex justify-center">
          <ScreenMock title="Meus pontos" badge="cliente" rows={[{ label: "Seu saldo", value: "120 pts", on: true }, { label: "Copo 350ml grátis", value: "100 pts" }, { label: "Cerveja grátis", value: "180 pts" }]} footer={{ label: "Falta pro próximo prêmio", value: "60 pts" }} />
        </div>
      </div>
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
          {INCLUSO.map((i) => (
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
          <details key={f.q} className="group rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between font-bold text-white">
              {f.q}
              <span className="ml-4 text-slate-500 transition group-open:rotate-45" style={{ color: ACCENT }}>+</span>
            </summary>
            <p className="mt-3 text-slate-300">{f.a}</p>
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
      <div className="rounded-[32px] border border-white/10 bg-white/[0.03] px-8 py-16" style={{ background: `radial-gradient(120% 120% at 50% 0%, ${ACCENT}22 0%, transparent 60%)` }}>
        <h2 className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">Bota o seu food service num sistema só.</h2>
        <p className="mx-auto mt-4 max-w-lg text-lg text-slate-300">Testa {BILLING.trialDias} dias grátis. Sem cartão, sem setup, sem comissão.</p>
        <Link href="/cadastro" className="mt-8 inline-flex items-center gap-2 rounded-full px-8 py-4 text-[15px] font-bold text-white transition hover:opacity-90" style={{ background: ACCENT, boxShadow: `0 14px 40px ${ACCENT}66` }}>
          Começar agora <IconArrowRight width={18} height={18} />
        </Link>
      </div>
    </section>
  );
}

// ── Rodapé (links pras segmentadas + institucional)
function SiteFooter() {
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
        <div className="mt-10 border-t border-white/10 pt-6 text-xs text-slate-500">© {new Date().getFullYear()} ComandaPRO · Impulso Digital</div>
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

function Chip({ Icon, label }: { Icon: React.ComponentType<{ width?: number; height?: number }>; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[13px] font-semibold text-slate-300">
      <span style={{ color: ACCENT }}><Icon width={15} height={15} /></span>
      {label}
    </div>
  );
}

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden text-white" style={{ background: NAVY }}>
      {/* glows de fundo */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full opacity-30 blur-3xl" style={{ background: `radial-gradient(circle, ${ACCENT} 0%, transparent 70%)` }} />
        <div className="absolute -right-32 top-40 h-[28rem] w-[28rem] rounded-full opacity-20 blur-3xl" style={{ background: "radial-gradient(circle, #22D3EE 0%, transparent 70%)" }} />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      </div>

      {/* NAV */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <span className="text-lg font-extrabold tracking-tight">ComandaPRO</span>
        <nav className="flex items-center gap-3">
          <Link href="/login" className="hidden text-sm font-semibold text-slate-300 hover:text-white sm:block">Entrar</Link>
          <Link
            href="/cadastro"
            className="rounded-full px-4 py-2 text-sm font-bold text-white shadow-lg transition hover:opacity-90"
            style={{ background: ACCENT, boxShadow: `0 8px 24px ${ACCENT}55` }}
          >
            Começar agora
          </Link>
        </nav>
      </header>

      {/* HERO */}
      <section className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-10 lg:grid-cols-2 lg:pt-16">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[13px] font-semibold text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: ACCENT }} /> Food service, do jeito certo
          </div>
          <h1 className="text-[2.6rem] font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            Do primeiro pedido ao<br />fechamento do caixa.<br />
            <span style={{ color: ACCENT }}>Num sistema só.</span>
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-slate-300">
            Cardápio, comanda, mesa, cozinha, delivery e caixa integrados — sem gambiarra de 5 apps que não conversam.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/cadastro"
              className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-bold text-white transition hover:opacity-90"
              style={{ background: ACCENT, boxShadow: `0 12px 34px ${ACCENT}66` }}
            >
              Começar agora <IconArrowRight width={18} height={18} />
            </Link>
            <a
              href="#demonstracao"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-6 py-3.5 text-[15px] font-bold text-white transition hover:bg-white/[0.07]"
            >
              Ver demonstração
            </a>
          </div>
          <div className="mt-8 flex flex-wrap gap-2">
            <Chip Icon={IconReceipt} label="Comanda & mesa" />
            <Chip Icon={IconMoto} label="Delivery próprio" />
            <Chip Icon={IconWallet} label="Caixa & PDV" />
          </div>
        </div>

        <div className="flex justify-center lg:justify-end">
          <MesasMockup />
        </div>
      </section>

      <DorSection />
      <FuncionalidadesSection />
      <MultiSegmentoSection />
      <FidelidadeSection />
      <PrecoSection />
      <FaqSection />
      <CtaFinal />
      <SiteFooter />
      <JsonLd />
    </main>
  );
}
