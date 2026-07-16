"use client";

import { useEffect, useState } from "react";
import { SEGMENTOS, type BusinessType, type Features } from "@/config/segments";
import { Logo } from "@/components/site/Logo";
import { BRAND } from "@/config/brand";
import { BILLING } from "@/config/billing";

// Onboarding do ComandaPRO (Fase 4 · UI). Wizard: (1) negócio + tipo → liga features/template,
// (2) link público, (3) dono. POST /api/cadastro cria conta+loja+config+trial. Marca coral (claro).

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

const inp =
  "w-full rounded-xl border px-3.5 py-3 outline-none transition focus:ring-4 placeholder:text-[#B8B2BB]";
const inpStyle = { borderColor: BRAND.line, color: BRAND.ink, ["--tw-ring-color" as string]: BRAND.coralRing };

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

  // Pré-preenche a partir do modal de captura da home (?negocio=&nome=&wa=) — self-service em 2 min.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const neg = q.get("negocio"), nm = q.get("nome"), wa = q.get("wa");
    if (neg) setNegocio(neg);
    if (nm) setNome(nm);
    if (wa) setWhatsapp(formatPhone(wa));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const coralBtn = "w-full rounded-xl py-3 font-bold text-white transition enabled:hover:opacity-90 disabled:opacity-40";
  const coralBtnStyle = { background: BRAND.coralGrad, boxShadow: BRAND.shadowCoral };

  return (
    <div className="min-h-screen px-4 py-10" style={{ background: BRAND.bgSoft }}>
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo />
          <p className="mt-3 text-sm" style={{ color: BRAND.mut }}>Crie sua loja em 1 minuto · {BILLING.trialDias} dias grátis</p>
        </div>

        {pronto ? (
          <div className="rounded-3xl border bg-white p-8 text-center" style={{ borderColor: BRAND.line, boxShadow: BRAND.shadowCard }}>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full text-3xl text-white" style={{ background: BRAND.coralGrad }}>✓</div>
            <h2 className="text-xl font-bold" style={{ color: BRAND.ink }}>Loja criada!</h2>
            <p className="mt-2 text-sm" style={{ color: BRAND.mut }}>Seu cardápio público:</p>
            <p className="mt-1 break-all font-mono text-sm font-semibold" style={{ color: BRAND.coral }}>{typeof window !== "undefined" ? window.location.origin : ""}/{pronto.slug}</p>
            <a href="/login" className={`${coralBtn} mt-6 inline-block px-6`} style={coralBtnStyle}>Entrar no painel</a>
            <p className="mt-3 text-xs" style={{ color: BRAND.mut }}>Use o e-mail e a senha que você acabou de cadastrar.</p>
          </div>
        ) : (
          <div className="rounded-3xl border bg-white p-6 sm:p-8" style={{ borderColor: BRAND.line, boxShadow: BRAND.shadowCard }}>
            {/* progresso */}
            <div className="mb-6 flex gap-2">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-1.5 flex-1 rounded-full" style={{ background: n <= step ? BRAND.coral : BRAND.line }} />
              ))}
            </div>

            {step === 1 && (
              <>
                <h2 className="mb-1 text-lg font-bold" style={{ color: BRAND.ink }}>Sobre o negócio</h2>
                <p className="mb-4 text-sm" style={{ color: BRAND.mut }}>O tipo já liga as funções certas pra você (dá pra ajustar depois).</p>
                <label className="mb-1 block text-sm font-semibold" style={{ color: BRAND.ink }}>Nome do negócio</label>
                <input value={negocio} onChange={(e) => setNegocio(e.target.value)} placeholder="Ex: Açaí do João" className={`${inp} mb-4`} style={inpStyle} autoFocus />

                <label className="mb-2 block text-sm font-semibold" style={{ color: BRAND.ink }}>Tipo de negócio</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(SEGMENTOS) as BusinessType[]).map((id) => {
                    const on = segmento === id;
                    return (
                      <button key={id} onClick={() => setSegmento(id)}
                        className="rounded-xl border p-3 text-left transition hover:-translate-y-0.5"
                        style={{ borderColor: on ? BRAND.coral : BRAND.line, background: on ? BRAND.coralSoft : "#fff" }}>
                        <div className="text-sm font-bold" style={{ color: BRAND.ink }}>{SEGMENTOS[id].label}</div>
                        <div className="mt-0.5 text-[11px] leading-snug" style={{ color: BRAND.mut }}>{SEG_DESC[id]}</div>
                      </button>
                    );
                  })}
                </div>

                {segData && (
                  <div className="mt-4 rounded-xl border p-3" style={{ borderColor: BRAND.line, background: BRAND.bgSoft }}>
                    <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: BRAND.coral }}>Já vem ligado</div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ background: BRAND.coral }}>{TEMPLATE_LABEL[segData.menuTemplate]}</span>
                      {featureChips(segData.features).map((c) => (
                        <span key={c} className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: BRAND.coralSoft, color: BRAND.ink2 }}>{c}</span>
                      ))}
                    </div>
                  </div>
                )}

                <button onClick={() => setStep(2)} disabled={!negocio.trim() || !segmento} className={`${coralBtn} mt-6`} style={coralBtnStyle}>Continuar</button>
              </>
            )}

            {step === 2 && (
              <>
                <h2 className="mb-1 text-lg font-bold" style={{ color: BRAND.ink }}>Seu link público</h2>
                <p className="mb-4 text-sm" style={{ color: BRAND.mut }}>É o endereço do cardápio que o cliente acessa.</p>
                <div className="flex items-center rounded-xl border px-3" style={{ borderColor: BRAND.line }}>
                  <span className="text-sm" style={{ color: BRAND.mut }}>/</span>
                  <input value={slug} onChange={(e) => { setSlug(slugifyTyping(e.target.value)); setSlugTouched(true); }} onBlur={() => setSlug((s) => slugify(s))}
                    placeholder="acai-do-joao" className="w-full bg-transparent px-1 py-3 outline-none placeholder:text-[#B8B2BB]" style={{ color: BRAND.ink }} />
                </div>
                <div className="mt-1.5 h-5 text-xs">
                  {slugFinal.length < 3 ? <span style={{ color: BRAND.mut }}>mínimo 3 letras/números</span>
                    : checking ? <span style={{ color: BRAND.mut }}>verificando…</span>
                    : check?.available ? <span className="font-semibold" style={{ color: "#0f9d58" }}>✓ disponível</span>
                    : check?.reason === "reservado" ? <span style={{ color: BRAND.coral }}>esse link é reservado</span>
                    : check && !check.available ? <span style={{ color: BRAND.coral }}>já está em uso</span> : null}
                </div>
                {/* preview do link final — o dono vê exatamente o que vai divulgar */}
                {check?.available && (
                  <p className="mt-1 rounded-lg px-3 py-2 text-xs" style={{ background: BRAND.coralSoft, color: BRAND.ink2 }}>Seu cardápio: <b style={{ color: BRAND.coral }}>comandapro.net.br/{slugFinal}</b></p>
                )}

                <label className="mb-1 mt-4 block text-sm font-semibold" style={{ color: BRAND.ink }}>WhatsApp da loja</label>
                <input value={whatsapp} onChange={(e) => setWhatsapp(formatPhone(e.target.value))} placeholder="(99) 99999-9999" inputMode="tel" className={inp} style={inpStyle} />
                <div className="mt-1 h-4 text-xs">
                  {waDigits > 0 && waDigits < 10
                    ? <span style={{ color: "#D97706" }}>número incompleto — inclua o DDD (ex: (11) 98888-7777)</span>
                    : <span style={{ color: BRAND.mut }}>É por onde você confirma os pedidos com o cliente. Com DDD.</span>}
                </div>

                <div className="mt-6 flex gap-2">
                  <button onClick={() => setStep(1)} className="rounded-xl border px-4 py-3 font-semibold" style={{ borderColor: BRAND.line, color: BRAND.ink2 }}>Voltar</button>
                  <button onClick={() => setStep(3)} disabled={!check?.available || whatsapp.replace(/\D+/g, "").length < 10} className={`${coralBtn} flex-1`} style={coralBtnStyle}>Continuar</button>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <h2 className="mb-1 text-lg font-bold" style={{ color: BRAND.ink }}>Seu acesso</h2>
                <p className="mb-4 text-sm" style={{ color: BRAND.mut }}>Você vai usar isso pra entrar no painel.</p>
                <label className="mb-1 block text-sm font-semibold" style={{ color: BRAND.ink }}>Seu nome</label>
                <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Como você se chama" className={`${inp} mb-4`} style={inpStyle} autoFocus />
                <label className="mb-1 block text-sm font-semibold" style={{ color: BRAND.ink }}>E-mail</label>
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" placeholder="voce@email.com" className={`${inp} mb-1`} style={inpStyle} />
                <div className="mb-3 h-4 text-xs">{email && !emailOk && <span style={{ color: BRAND.coral }}>e-mail inválido</span>}</div>
                <label className="mb-1 block text-sm font-semibold" style={{ color: BRAND.ink }}>Senha</label>
                <input value={senha} onChange={(e) => setSenha(e.target.value)} type="password" autoComplete="new-password" placeholder="8+ caracteres, 1 maiúscula, 1 número" className={`${inp} mb-1`} style={inpStyle} />
                <div className="mb-2 h-4 text-xs">
                  {senha && !senhaOk ? <span style={{ color: "#D97706" }}>precisa de 8+ caracteres, 1 maiúscula e 1 número</span>
                    : senha && senhaOk ? <span className="font-semibold" style={{ color: "#0f9d58" }}>✓ senha boa</span> : null}
                </div>

                {erro && <p className="mb-3 rounded-lg px-3 py-2 text-sm" style={{ background: BRAND.coralSoft, color: BRAND.coral }}>{erro}</p>}

                <div className="mt-2 flex gap-2">
                  <button onClick={() => setStep(2)} className="rounded-xl border px-4 py-3 font-semibold" style={{ borderColor: BRAND.line, color: BRAND.ink2 }}>Voltar</button>
                  <button onClick={enviar} disabled={enviando || !nome.trim() || !emailOk || !senhaOk} className={`${coralBtn} flex-1`} style={coralBtnStyle}>
                    {enviando ? "Criando…" : "Criar minha loja"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <p className="mt-6 text-center text-sm" style={{ color: BRAND.mut }}>Já tem conta? <a href="/login" className="font-bold hover:underline" style={{ color: BRAND.coral }}>Entrar</a></p>
      </div>
    </div>
  );
}
