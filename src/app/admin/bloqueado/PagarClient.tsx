"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Plano = { id: string; label: string; cents: number; equivMes: number; meses: number };
type Modalidade = "mensal_cartao" | "mensal_pix" | "semestral_pix" | "anual_pix";

const brl = (cents: number) => "R$ " + (cents / 100).toFixed(2).replace(".", ",");
const brlInt = (cents: number) => "R$ " + Math.round(cents / 100).toLocaleString("pt-BR");

type Opcao = {
  key: Modalidade;
  plano: string;
  forma: "cartao" | "pix";
  titulo: string;
  valor: string;
  subValor: string;
  descricao: string;
  bullets: string[];
  economia: string | null;
  destaque: boolean;
};

// Monta as 4 modalidades a partir dos planos (mensal/semestral/anual) que a página passa.
function buildOpcoes(planos: Plano[]): Opcao[] {
  const by = Object.fromEntries(planos.map((p) => [p.id, p])) as Record<string, Plano>;
  const mensal = by["mensal"];
  const semestral = by["semestral"];
  const anual = by["anual"];
  const economiaSem = mensal && semestral ? mensal.equivMes * semestral.meses * 100 - semestral.cents : 0;
  const economiaAnual = mensal && anual ? mensal.equivMes * anual.meses * 100 - anual.cents : 0;

  const opcoes: Opcao[] = [];
  if (mensal) {
    opcoes.push({
      key: "mensal_cartao",
      plano: "mensal",
      forma: "cartao",
      titulo: "Mensal · Cartão automático",
      valor: brlInt(mensal.cents),
      subValor: "por mês",
      descricao: "Cobrança automática no cartão todo mês",
      bullets: ["Sem precisar lembrar", "Cancela quando quiser"],
      economia: null,
      destaque: false,
    });
    opcoes.push({
      key: "mensal_pix",
      plano: "mensal",
      forma: "pix",
      titulo: "Mensal · PIX",
      valor: brlInt(mensal.cents),
      subValor: "por mês",
      descricao: "PIX a cada mês — você controla quando paga",
      bullets: ["Sem precisar de cartão", "Você paga quando quiser"],
      economia: null,
      destaque: false,
    });
  }
  if (semestral && mensal) {
    opcoes.push({
      key: "semestral_pix",
      plano: "semestral",
      forma: "pix",
      titulo: "Semestral à vista · PIX",
      valor: brlInt(semestral.cents),
      subValor: `${semestral.meses} meses`,
      descricao: `Cobre ${semestral.meses} meses · normalmente ${brlInt(mensal.equivMes * semestral.meses * 100)}`,
      bullets: ["Sai mais barato por mês", "6 meses sem mexer"],
      economia: economiaSem > 0 ? brlInt(economiaSem) : null,
      destaque: false,
    });
  }
  if (anual && mensal) {
    opcoes.push({
      key: "anual_pix",
      plano: "anual",
      forma: "pix",
      titulo: "Anual à vista · PIX",
      valor: brlInt(anual.cents),
      subValor: `${anual.meses} meses`,
      descricao: `Cobre ${anual.meses} meses · normalmente ${brlInt(mensal.equivMes * anual.meses * 100)}`,
      bullets: ["Maior economia", "12 meses sem mexer"],
      economia: economiaAnual > 0 ? brlInt(economiaAnual) : null,
      destaque: true,
    });
  }
  return opcoes;
}

export default function PagarClient({ planos, lojaNome }: { planos: Plano[]; lojaNome: string }) {
  const opcoes = buildOpcoes(planos);
  const [selectedKey, setSelectedKey] = useState<Modalidade>(opcoes[opcoes.length - 1]?.key ?? "mensal_pix");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [pix, setPix] = useState<{ qrImage: string | null; qrPayload: string | null; valorCents: number; label: string } | null>(null);
  const [needsCustomerData, setNeedsCustomerData] = useState(false);
  const [nome, setNome] = useState(lojaNome ?? "");
  const [cpf, setCpf] = useState("");

  const selected = opcoes.find((o) => o.key === selectedKey) ?? opcoes[0];

  function handleSelect(key: Modalidade) {
    setSelectedKey(key);
    setErro(null);
    setFallbackUrl(null);
    setPix(null);
  }

  async function pagar() {
    if (!selected) return;
    setErro(null);
    setFallbackUrl(null);
    setPix(null);
    setLoading(true);

    // Cartão: abre a aba JÁ no clique (about:blank) pra preservar o user-gesture (Safari iOS bloqueia
    // window.open depois de await). A URL entra quando a API responde. PIX: renderiza inline aqui.
    const isCartao = selected.forma === "cartao";
    const newWindow = isCartao ? window.open("about:blank", "_blank") : null;

    const body: Record<string, unknown> = { plano: selected.plano, forma: selected.forma };
    if (nome.trim() && cpf.replace(/\D/g, "").length >= 11) {
      body.nome = nome.trim();
      body.cpfCnpj = cpf.replace(/\D/g, "");
    }

    try {
      const res = await fetch("/api/billing/checkout-asaas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));

      if (data.needs_customer_data) {
        if (newWindow) newWindow.close();
        setNeedsCustomerData(true);
        setLoading(false);
        return;
      }

      if (data.tipo === "pix" && data.qrImage) {
        if (newWindow) newWindow.close();
        setPix({
          qrImage: data.qrImage,
          qrPayload: data.qrPayload ?? null,
          valorCents: (planos.find((p) => p.id === selected.plano)?.cents) ?? 0,
          label: selected.titulo,
        });
        if (data.invoiceUrl) setFallbackUrl(data.invoiceUrl);
        setLoading(false);
        return;
      }

      if (data.tipo === "cartao" && data.url) {
        if (newWindow && !newWindow.closed) newWindow.location.href = data.url;
        setFallbackUrl(data.url);
        setLoading(false);
        return;
      }

      if (newWindow) newWindow.close();
      setErro(data.error ?? "Não consegui abrir o pagamento. Tenta outra forma ou fala no WhatsApp.");
      setLoading(false);
    } catch {
      if (newWindow) newWindow.close();
      setErro("Falha de conexão. Tenta de novo.");
      setLoading(false);
    }
  }

  // ── Tela de PIX inline (QR + copia-cola + polling) ──────────────────────────
  if (pix) {
    return (
      <PixInline
        qrImage={pix.qrImage}
        qrPayload={pix.qrPayload}
        valorCents={pix.valorCents}
        label={pix.label}
        onTrocar={() => setPix(null)}
      />
    );
  }

  const labelBotao = !selected
    ? "Pagar"
    : selected.forma === "cartao"
      ? `Ativar mensalidade (${selected.valor}/mês)`
      : selected.key === "mensal_pix"
        ? `Pagar mensalidade (${selected.valor}) via PIX`
        : `Pagar ${selected.subValor} (${selected.valor}) via PIX`;

  return (
    <div className="mt-6 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Como você prefere pagar?</p>

      <div className="space-y-2">
        {opcoes.map((opt) => {
          const isSel = opt.key === selectedKey;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => handleSelect(opt.key)}
              className="w-full rounded-xl p-3 text-left transition-all"
              style={{
                background: isSel ? "rgba(245,72,12,0.10)" : "rgba(0,0,0,0.25)",
                border: isSel ? "1.5px solid rgba(245,72,12,0.6)" : "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="mt-0.5 flex-shrink-0 rounded-full"
                  style={{
                    width: 18,
                    height: 18,
                    border: isSel ? "5px solid #F5480C" : "2px solid rgba(255,255,255,0.25)",
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-white">{opt.titulo}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">{opt.descricao}</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-base font-bold leading-none text-[#FF8A3D]">{opt.valor}</p>
                      <p className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-500">{opt.subValor}</p>
                    </div>
                  </div>

                  {opt.economia && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <span
                        className="inline-block rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                        style={{
                          background: opt.destaque
                            ? "linear-gradient(90deg, rgba(245,72,12,0.18), rgba(255,138,61,0.18))"
                            : "rgba(245,72,12,0.15)",
                          color: "#5EEAD4",
                          border: "1px solid rgba(245,72,12,0.35)",
                        }}
                      >
                        {opt.destaque ? "🔥 " : ""}Economiza {opt.economia}
                      </span>
                    </div>
                  )}

                  {isSel && (
                    <ul className="mt-2 space-y-1">
                      {opt.bullets.map((b, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-300">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {needsCustomerData && (
        <div className="space-y-2 rounded-xl p-3" style={{ background: "rgba(245,72,12,0.08)", border: "1.5px solid rgba(245,72,12,0.4)" }}>
          <p className="text-xs font-semibold text-[#FFB380]">Pra emitir a cobrança a gente precisa de 2 dados rápidos:</p>
          <input
            type="text"
            placeholder="Nome ou razão social"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.15)" }}
          />
          <input
            type="text"
            placeholder="CPF ou CNPJ (só números)"
            value={cpf}
            onChange={(e) => setCpf(e.target.value.replace(/\D/g, "").slice(0, 14))}
            inputMode="numeric"
            className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.15)" }}
          />
          <p className="text-[10px] text-slate-400">Fica só com o Asaas pra emitir a cobrança — não compartilhamos.</p>
        </div>
      )}

      <button
        type="button"
        onClick={pagar}
        disabled={loading || (needsCustomerData && (!nome.trim() || cpf.replace(/\D/g, "").length < 11))}
        className="w-full rounded-xl py-3.5 text-sm font-bold text-white transition-all disabled:opacity-40"
        style={{ background: "linear-gradient(135deg, #FF8A3D 0%, #F5480C 100%)", boxShadow: "0 8px 20px -6px rgba(245,72,12,0.5)" }}
      >
        {loading ? "Abrindo pagamento…" : needsCustomerData ? "Continuar pro pagamento" : labelBotao}
      </button>

      {erro && <p className="text-center text-sm text-red-400">{erro}</p>}

      {fallbackUrl && (
        <div className="space-y-2 rounded-lg p-3 text-center" style={{ background: "rgba(245,72,12,0.10)", border: "1px solid rgba(245,72,12,0.35)" }}>
          <p className="text-xs text-[#FFB380]">
            Pagamento aberto em <strong>nova aba</strong>. Fechou sem querer? Reabre:
          </p>
          <a
            href={fallbackUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-lg px-4 py-2 text-sm font-bold text-white"
            style={{ background: "linear-gradient(135deg, #FF8A3D 0%, #F5480C 100%)" }}
          >
            Reabrir pagamento →
          </a>
        </div>
      )}

      <div className="flex items-start gap-2 rounded-lg px-3 py-2.5" style={{ background: "rgba(245,72,12,0.08)", border: "1px solid rgba(245,72,12,0.25)" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F5480C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0">
          <path d="M9 12l2 2 4-4" />
          <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" />
        </svg>
        <p className="text-[11px] leading-snug text-[#FFD8C2]">
          <strong>Garantia de 7 dias.</strong> Cancelou em até 7 dias? A gente devolve a grana sem burocracia.
        </p>
      </div>
    </div>
  );
}

// ── QR PIX inline com polling ─────────────────────────────────────────────────
function PixInline({
  qrImage,
  qrPayload,
  valorCents,
  label,
  onTrocar,
}: {
  qrImage: string | null;
  qrPayload: string | null;
  valorCents: number;
  label: string;
  onTrocar: () => void;
}) {
  const router = useRouter();
  const [copiado, setCopiado] = useState(false);
  const [statusMsg, setStatusMsg] = useState("Aguardando pagamento…");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/billing/status", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.subscription?.status === "active") {
          setStatusMsg("Pagamento confirmado! Liberando seu painel…");
          if (pollRef.current) clearInterval(pollRef.current);
          setTimeout(() => router.refresh(), 1500);
        }
      } catch {
        // silencioso — próxima rodada tenta de novo
      }
    }, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [router]);

  async function copiar() {
    if (!qrPayload) return;
    try {
      await navigator.clipboard.writeText(qrPayload);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      const el = document.getElementById("pix-payload") as HTMLInputElement | null;
      el?.select();
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="space-y-1 pt-1 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="text-3xl font-bold text-[#FF8A3D]">{brl(valorCents)}</p>
      </div>

      {qrImage ? (
        <div className="flex items-center justify-center rounded-2xl bg-white p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`data:image/png;base64,${qrImage}`} alt="QR Code PIX" width={240} height={240} style={{ width: 240, height: 240, display: "block" }} />
        </div>
      ) : (
        <div className="rounded-2xl p-6 text-center text-xs text-amber-300" style={{ background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.30)" }}>
          QR Code não chegou. Usa o código PIX abaixo no app do banco.
        </div>
      )}

      <ol className="list-decimal space-y-1.5 pl-4 text-xs text-slate-300">
        <li>Abre o app do seu banco</li>
        <li>Escolhe pagar com PIX → escaneia o QR ou cola o código</li>
        <li>A gente libera seu painel automático em segundos</li>
      </ol>

      {qrPayload && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Ou cola no banco:</p>
          <div className="flex items-stretch gap-2">
            <input
              id="pix-payload"
              type="text"
              readOnly
              value={qrPayload}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="min-w-0 flex-1 rounded-lg px-3 py-2.5 font-mono text-[11px]"
              style={{ background: "rgba(0,0,0,0.30)", border: "1px solid rgba(255,255,255,0.10)", color: "#cbd5e1" }}
            />
            <button
              type="button"
              onClick={copiar}
              className="flex-shrink-0 rounded-lg px-4 text-xs font-bold text-white transition-all"
              style={{ background: copiado ? "linear-gradient(135deg,#22C55E,#16A34A)" : "linear-gradient(135deg,#FF8A3D,#F5480C)" }}
            >
              {copiado ? "Copiado!" : "Copiar"}
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 rounded-lg px-3 py-2.5" style={{ background: "rgba(245,72,12,0.10)", border: "1px solid rgba(245,72,12,0.30)" }}>
        <span className="relative flex h-2 w-2 flex-shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <p className="text-[11px] leading-snug text-[#FFB380]">{statusMsg}</p>
      </div>

      <button type="button" onClick={onTrocar} className="w-full pt-1 text-[11px] text-slate-400 underline hover:text-slate-200">
        Trocar forma de pagamento
      </button>
    </div>
  );
}
