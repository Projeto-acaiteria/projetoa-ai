"use client";

import { useEffect, useState } from "react";
import { SEGMENTOS, type BusinessType, type Features } from "@/config/segments";

// Onboarding do ComandaPRO (Fase 4 · UI). Wizard: (1) negócio + tipo → liga features/template,
// (2) link público, (3) dono. POST /api/cadastro cria conta+loja+config+trial. Tema roxo premium.

const SEG_DESC: Record<BusinessType, string> = {
  acaiteria: "Monta no copo, vende por peso, fidelidade e link de delivery.",
  sorveteria: "Balcão por peso, fidelidade e pedido por link.",
  marmitaria: "Comida a quilo / marmita, cardápio com foto e link.",
  restaurante: "Mesas, comanda e cozinha/bar com pedido roteado.",
  pizzaria: "Pizzas inteiras ou meio-a-meio, bordas, mesa e delivery.",
  sushi: "Combinados, temaki e à la carte — mesa e delivery.",
  hamburgueria: "Lanches, combos e adicionais — balcão, mesa e delivery.",
  petiscaria: "Mesas, balcão e estações — comanda estilo bar.",
  bar: "Comanda, couvert de show, dose/garrafa e estações.",
  assistencia_tecnica: "Ordens de serviço, técnicos, peças e comissão por reparo.",
};

const FEATURE_LABEL: Partial<Record<keyof Features, string>> = {
  sellsByWeight: "Venda por peso (R$/kg)",
  hasBalcao: "Balcão / walk-in",
  hasTables: "Mesas e comanda",
  hasDelivery: "Pedido por link",
  coverEnabled: "Couvert artístico",
  stockDose: "Dose / garrafa",
  hasStations: "Estações (cozinha/bar)",
  loyaltyEnabled: "Fidelidade (pontos)",
};
const TEMPLATE_LABEL = { acai: "Cardápio montagem", bar: "Comanda estilo bar", grid: "Cardápio com foto" };

const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g"); // marcas de acento (NFD) — sem char literal no fonte
// versão FINAL (auto-sugestão / blur): tira hífen do início E do fim.
function slugify(s: string) {
  return s.normalize("NFD").replace(DIACRITICS, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
}
// versão de DIGITAÇÃO: NÃO tira o hífen do fim — senão não dá pra digitar "marmitaria-do-teo"
// (a cada tecla o "-" sumia). Só normaliza acento/caixa/inválidos e colapsa hífens repetidos.
function slugifyTyping(s: string) {
  return s.normalize("NFD").replace(DIACRITICS, "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-+/, "").slice(0, 50);
}
// máscara de telefone BR enquanto digita: (99) 99999-9999 (ou 8 díg). Backend guarda só dígitos.
function formatPhone(s: string) {
  const d = s.replace(/\D+/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
function featureChips(f: Features): string[] {
  return (Object.keys(FEATURE_LABEL) as (keyof Features)[]).filter((k) => f[k]).map((k) => FEATURE_LABEL[k]!);
}

const inp = "w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2.5 text-white outline-none focus:border-indigo-400 placeholder:text-white/30";

export default function CadastroPage() {
  const [step, setStep] = useState(1);
  const [negocio, setNegocio] = useState("");
  const [segmento, setSegmento] = useState<BusinessType | "">("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [whatsapp, setWhatsapp] = useState("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [check, setCheck] = useState<null | { available: boolean; reason?: string }>(null);
  const [checking, setChecking] = useState(false);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [pronto, setPronto] = useState<{ slug: string } | null>(null);
  const slugFinal = slugify(slug); // versão limpa (sem hífen nas pontas) p/ check, preview e submit
  const waDigits = whatsapp.replace(/\D+/g, "").length;

  // auto-sugere o link a partir do nome (até o dono editar manualmente)
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(negocio));
  }, [negocio, slugTouched]);

  // checa disponibilidade do link ao vivo (debounce)
  useEffect(() => {
    if (step !== 2 || slugFinal.length < 3) { setCheck(null); return; }
    setChecking(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/cadastro/check?slug=${encodeURIComponent(slugFinal)}`);
        setCheck(await r.json());
      } finally { setChecking(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [slugFinal, step]);

  const senhaOk = senha.length >= 8 && /[A-Z]/.test(senha) && /[0-9]/.test(senha);
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);

  async function enviar() {
    setErro(""); setEnviando(true);
    try {
      const r = await fetch("/api/cadastro", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ negocio, segmento, slug: slugFinal, whatsapp, nome, email, senha }),
      });
      const d = await r.json();
      if (!r.ok) { setErro(d.error ?? "Não consegui criar a loja."); return; }
      setPronto({ slug: d.slug });
    } catch {
      setErro("Erro de conexão. Tente de novo.");
    } finally { setEnviando(false); }
  }

  const segData = segmento ? SEGMENTOS[segmento] : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1e1b4b] to-[#0f172a] px-4 py-10 text-white">
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-wide">ComandaPRO</h1>
          <p className="mt-1 text-sm text-white/60">Crie sua loja em 1 minuto · 7 dias grátis</p>
        </div>

        {pronto ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-3xl">✓</div>
            <h2 className="text-xl font-bold">Loja criada!</h2>
            <p className="mt-2 text-sm text-white/70">Seu cardápio público:</p>
            <p className="mt-1 break-all font-mono text-sm text-indigo-300">{typeof window !== "undefined" ? window.location.origin : ""}/{pronto.slug}</p>
            <a href="/login" className="mt-6 inline-block rounded-lg bg-indigo-600 px-6 py-2.5 font-semibold transition hover:bg-indigo-500">Entrar no painel</a>
            <p className="mt-3 text-xs text-white/40">Use o e-mail e a senha que você acabou de cadastrar.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur sm:p-8">
            {/* progresso */}
            <div className="mb-6 flex gap-2">
              {[1, 2, 3].map((n) => (
                <div key={n} className={`h-1.5 flex-1 rounded-full ${n <= step ? "bg-indigo-500" : "bg-white/10"}`} />
              ))}
            </div>

            {step === 1 && (
              <>
                <h2 className="mb-1 text-lg font-bold">Sobre o negócio</h2>
                <p className="mb-4 text-sm text-white/60">O tipo já liga as funções certas pra você (dá pra ajustar depois).</p>
                <label className="mb-1 block text-sm text-white/80">Nome do negócio</label>
                <input value={negocio} onChange={(e) => setNegocio(e.target.value)} placeholder="Ex: Açaí do João" className={`${inp} mb-4`} autoFocus />

                <label className="mb-2 block text-sm text-white/80">Tipo de negócio</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(SEGMENTOS) as BusinessType[]).map((id) => (
                    <button key={id} onClick={() => setSegmento(id)}
                      className={`rounded-xl border p-3 text-left transition hover:-translate-y-0.5 ${segmento === id ? "border-indigo-400 bg-indigo-500/20" : "border-white/10 bg-white/5 hover:border-indigo-400 hover:bg-white/10"}`}>
                      <div className="text-sm font-bold">{SEGMENTOS[id].label}</div>
                      <div className="mt-0.5 text-[11px] leading-snug text-white/55">{SEG_DESC[id]}</div>
                    </button>
                  ))}
                </div>

                {segData && (
                  <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-indigo-300">Já vem ligado</div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[11px] font-semibold">{TEMPLATE_LABEL[segData.menuTemplate]}</span>
                      {featureChips(segData.features).map((c) => (
                        <span key={c} className="rounded-full bg-white/10 px-2 py-0.5 text-[11px]">{c}</span>
                      ))}
                    </div>
                  </div>
                )}

                <button onClick={() => setStep(2)} disabled={!negocio.trim() || !segmento}
                  className="mt-6 w-full rounded-lg bg-indigo-600 py-2.5 font-semibold transition hover:bg-indigo-500 disabled:opacity-40">Continuar</button>
              </>
            )}

            {step === 2 && (
              <>
                <h2 className="mb-1 text-lg font-bold">Seu link público</h2>
                <p className="mb-4 text-sm text-white/60">É o endereço do cardápio que o cliente acessa.</p>
                <div className="flex items-center rounded-lg border border-white/15 bg-white/10 px-3">
                  <span className="text-sm text-white/40">/</span>
                  <input value={slug} onChange={(e) => { setSlug(slugifyTyping(e.target.value)); setSlugTouched(true); }} onBlur={() => setSlug((s) => slugify(s))}
                    placeholder="acai-do-joao" className="w-full bg-transparent px-1 py-2.5 text-white outline-none placeholder:text-white/30" />
                </div>
                <div className="mt-1.5 h-5 text-xs">
                  {slugFinal.length < 3 ? <span className="text-white/40">mínimo 3 letras/números</span>
                    : checking ? <span className="text-white/40">verificando…</span>
                    : check?.available ? <span className="text-emerald-300">✓ disponível</span>
                    : check?.reason === "reservado" ? <span className="text-red-300">esse link é reservado</span>
                    : check && !check.available ? <span className="text-red-300">já está em uso</span> : null}
                </div>
                {/* preview do link final — o dono vê exatamente o que vai divulgar */}
                {check?.available && (
                  <p className="mt-1 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/70">Seu cardápio: <b className="text-indigo-300">comandapro.net.br/{slugFinal}</b></p>
                )}

                <label className="mb-1 mt-4 block text-sm text-white/80">WhatsApp da loja</label>
                <input value={whatsapp} onChange={(e) => setWhatsapp(formatPhone(e.target.value))} placeholder="(99) 99999-9999" inputMode="tel" className={inp} />
                <div className="mt-1 h-4 text-xs">
                  {waDigits > 0 && waDigits < 10
                    ? <span className="text-amber-300">número incompleto — inclua o DDD (ex: (11) 98888-7777)</span>
                    : <span className="text-white/45">É por onde você confirma os pedidos com o cliente. Com DDD.</span>}
                </div>

                <div className="mt-6 flex gap-2">
                  <button onClick={() => setStep(1)} className="rounded-lg border border-white/15 px-4 py-2.5 font-semibold text-white/80 hover:bg-white/5">Voltar</button>
                  <button onClick={() => setStep(3)} disabled={!check?.available || whatsapp.replace(/\D+/g, "").length < 10}
                    className="flex-1 rounded-lg bg-indigo-600 py-2.5 font-semibold transition hover:bg-indigo-500 disabled:opacity-40">Continuar</button>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <h2 className="mb-1 text-lg font-bold">Seu acesso</h2>
                <p className="mb-4 text-sm text-white/60">Você vai usar isso pra entrar no painel.</p>
                <label className="mb-1 block text-sm text-white/80">Seu nome</label>
                <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Como você se chama" className={`${inp} mb-4`} autoFocus />
                <label className="mb-1 block text-sm text-white/80">E-mail</label>
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" placeholder="voce@email.com" className={`${inp} mb-1`} />
                <div className="mb-3 h-4 text-xs">{email && !emailOk && <span className="text-red-300">e-mail inválido</span>}</div>
                <label className="mb-1 block text-sm text-white/80">Senha</label>
                <input value={senha} onChange={(e) => setSenha(e.target.value)} type="password" autoComplete="new-password" placeholder="8+ caracteres, 1 maiúscula, 1 número" className={`${inp} mb-1`} />
                <div className="mb-2 h-4 text-xs">
                  {senha && !senhaOk ? <span className="text-amber-300">precisa de 8+ caracteres, 1 maiúscula e 1 número</span>
                    : senha && senhaOk ? <span className="text-emerald-300">✓ senha boa</span> : null}
                </div>

                {erro && <p className="mb-3 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-200">{erro}</p>}

                <div className="mt-2 flex gap-2">
                  <button onClick={() => setStep(2)} className="rounded-lg border border-white/15 px-4 py-2.5 font-semibold text-white/80 hover:bg-white/5">Voltar</button>
                  <button onClick={enviar} disabled={enviando || !nome.trim() || !emailOk || !senhaOk}
                    className="flex-1 rounded-lg bg-indigo-600 py-2.5 font-semibold transition hover:bg-indigo-500 disabled:opacity-40">
                    {enviando ? "Criando…" : "Criar minha loja"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <p className="mt-6 text-center text-sm text-white/50">Já tem conta? <a href="/login" className="font-semibold text-indigo-300 hover:text-indigo-200">Entrar</a></p>
      </div>
    </div>
  );
}
