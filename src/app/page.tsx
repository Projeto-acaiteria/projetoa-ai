import Link from "next/link";

export const dynamic = "force-static";

// Landing do PRODUTO (comandapro.net.br/) — não é loja nenhuma. Apresenta o ComandaPRO e
// leva pro cadastro (loja nova) ou login (dono). As lojas vivem em /<slug>.
const SEGMENTOS = ["Açaiteria", "Restaurante", "Marmitaria", "Bar", "Pizzaria", "Hamburgueria", "Sorveteria", "Sushi"];
const DIFERENCIAIS = [
  { t: "0% de comissão", d: "Pedido pelo seu link, sem o iFood levar quase 30% de cada venda. Você paga só a mensalidade." },
  { t: "Tudo num sistema só", d: "Cardápio digital, comanda, mesa, KDS, delivery, balcão, caixa e estoque — integrados." },
  { t: "Multi-segmento", d: "Açaí por peso, pizza meio-a-meio, combos de sushi, comanda de bar. Cada negócio do seu jeito." },
  { t: "Delivery próprio", d: "Link da loja, taxa por bairro, rastreio por código e confirmação no WhatsApp." },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#2a0f3d] to-[#140820] text-white">
      {/* topo */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <span className="text-lg font-extrabold tracking-wide">ComandaPRO</span>
        <Link href="/login" className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold transition hover:bg-white/5">Entrar</Link>
      </header>

      {/* hero */}
      <section className="mx-auto max-w-3xl px-5 pb-10 pt-12 text-center sm:pt-20">
        <span className="inline-block rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70">7 dias grátis · sem comissão por pedido</span>
        <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          O sistema completo do seu <span className="text-purple-300">food service</span>.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-white/70 sm:text-lg">
          Cardápio digital, comanda, mesa, delivery e balcão — num sistema só. Receba pedidos pelo seu link, sem o marketplace levar quase 30% de cada venda.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/cadastro" className="w-full rounded-xl bg-purple-600 px-7 py-3.5 text-center font-bold transition hover:bg-purple-500 sm:w-auto">Criar minha loja grátis</Link>
          <Link href="/login" className="w-full rounded-xl border border-white/15 px-7 py-3.5 text-center font-bold text-white/90 transition hover:bg-white/5 sm:w-auto">Já tenho conta</Link>
        </div>
        {/* segmentos atendidos */}
        <div className="mt-9 flex flex-wrap justify-center gap-2">
          {SEGMENTOS.map((s) => (
            <span key={s} className="rounded-full bg-white/8 px-3 py-1 text-xs font-medium text-white/65">{s}</span>
          ))}
        </div>
      </section>

      {/* diferenciais */}
      <section className="mx-auto max-w-4xl px-5 pb-16">
        <div className="grid gap-3 sm:grid-cols-2">
          {DIFERENCIAIS.map((f) => (
            <div key={f.t} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h3 className="text-base font-extrabold text-white">{f.t}</h3>
              <p className="mt-1 text-sm text-white/65">{f.d}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
          <h2 className="text-xl font-extrabold">Pronto pra colocar sua loja no ar?</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-white/65">Crie sua conta, monte o cardápio e comece a receber pedidos hoje. 7 dias grátis.</p>
          <Link href="/cadastro" className="mt-5 inline-block rounded-xl bg-purple-600 px-7 py-3 font-bold transition hover:bg-purple-500">Criar minha loja grátis</Link>
        </div>
      </section>

      <footer className="border-t border-white/10 px-5 py-6 text-center text-xs text-white/40">
        ComandaPRO · comandapro.net.br
      </footer>
    </main>
  );
}
