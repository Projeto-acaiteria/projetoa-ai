"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import PixInlineCheckout from "@/components/billing/PixInlineCheckout";
import type { CobrancaBanner } from "@/lib/auth/subscription";

// Faixa de cobrança no topo do painel — espelha o BillingDueBanner do AgendaPRO (18/07): o cliente
// paga PELA PRÓPRIA TELA do app. Mesma escala do cron:
//   D-3/-2/-1 → "vence em X dias" (azul)
//   D-0       → "vence hoje" (âmbar)
//   vencida   → "venceu — pague pra não bloquear" (vermelho · ainda na carência)
//
// TUDO acontece neste modal, inclusive o cadastro. O AgendaPRO manda quem não tem cadastro no
// Asaas pra outra tela (`/admin/configuracoes?tab=plano`) e a primeira versão daqui copiou isso
// mandando pra /admin/bloqueado — Eduardo bateu o olho e cortou: tirar o dono do painel pra pedir
// dois campos é passeio à toa, e a tela preta de paywall dá a impressão de que já bloqueou.
// Agora: sem cadastro → os campos aparecem AQUI → o mesmo botão emite a cobrança e troca pelo QR.
// A /admin/bloqueado continua existindo pra quem já perdeu a carência (aí o painel está travado
// mesmo e não há tela por trás).

type PixData = { qrImage: string | null; qrPayload: string | null; valorCents: number; label: string };

// CPF tem 11 dígitos, CNPJ 14 — qualquer coisa no meio o Asaas recusa com 400.
const docValido = (v: string) => {
  const d = v.replace(/\D/g, "").length;
  return d === 11 || d === 14;
};

export default function BillingDueBanner({
  cobranca,
  lojaNome,
}: {
  cobranca: CobrancaBanner;
  lojaNome: string;
}) {
  const { diasAteVencer, status, graceDays, plano, planoLabel, valorCents, travado } = cobranca;

  const [loading, setLoading] = useState(false);
  // travado = mensalidade VENCIDA: o pop-up sobe sozinho e não sai da tela enquanto não pagar.
  // Não tem ✕, clique fora não fecha e Esc não fecha. A saída é o pagamento (o polling do
  // PixInlineCheckout vê virar active e dá refresh, aí cobrancaBanner some) ou o WhatsApp.
  const [aberto, setAberto] = useState(travado);
  const [pix, setPix] = useState<PixData | null>(null);
  const [pago, setPago] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pedirCadastro, setPedirCadastro] = useState(cobranca.precisaCadastro);
  const [nome, setNome] = useState(lojaNome);
  const [doc, setDoc] = useState("");

  const venceu = diasAteVencer < 0 || status === "past_due";
  const venceHoje = diasAteVencer === 0 && !venceu;
  const urgente = venceu || venceHoje;

  const texto = venceu
    ? "Sua mensalidade venceu"
    : venceHoje
      ? "Sua mensalidade vence hoje"
      : diasAteVencer === 1
        ? "Sua mensalidade vence amanhã"
        : `Sua mensalidade vence em ${diasAteVencer} dias`;

  const complemento = venceu
    ? graceDays && graceDays > 0
      ? `Você tem ${graceDays} dia${graceDays === 1 ? "" : "s"} antes do painel bloquear.`
      : "Pague pra não perder o acesso ao painel."
    : "Pague pelo PIX aqui mesmo, sem sair do app.";

  const cor = venceu
    ? { dot: "#E11D48", bg: "#FEECEC", border: "var(--red-no)", txt: "text-[var(--red-no)]", btn: "#E11D48" }
    : venceHoje
      ? { dot: "#D97706", bg: "#FFF8E6", border: "var(--gold)", txt: "text-[#B45309]", btn: "#D97706" }
      : { dot: "#3B82F6", bg: "#EFF6FF", border: "#BFDBFE", txt: "text-[#1D4ED8]", btn: "#2563EB" };

  function mostrarQr(qrImage: string | null, qrPayload: string | null) {
    setPix({ qrImage, qrPayload, valorCents, label: `${planoLabel} · PIX` });
    setPedirCadastro(false);
    setAberto(true);
  }

  // Caminho 1 — já tem cadastro: reaproveita a cobrança em aberto no Asaas (não duplica).
  async function pegarPix() {
    setErro(null);
    setPago(false);

    // Loja sem cadastro no Asaas: o SERVIDOR já disse isso ao montar a faixa (precisaCadastro).
    // Ir ao Asaas só pra ouvir "não tem cadastro" é ida perdida — e quando essa ida falhava por
    // qualquer motivo, o formulário abria com um erro vermelho em cima sem o dono ter feito nada.
    // Abre direto o formulário; o 409 abaixo continua como rede pra estado que mudou no meio.
    if (pedirCadastro) {
      setAberto(true);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/billing/pix-atual", { cache: "no-store" });
      if (res.status === 409) {
        // sem cadastro no Asaas — pede nome + CPF/CNPJ aqui mesmo, sem sair do painel
        setPedirCadastro(true);
        setAberto(true);
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (data?.paid === true) {
        setPago(true);
        setAberto(true);
        setTimeout(() => window.location.reload(), 2000);
        return;
      }
      if (!res.ok || !data?.payment_id) {
        setErro(data?.error ?? "Não deu pra gerar o PIX agora. Tenta de novo em instantes.");
        setAberto(true);
        return;
      }
      mostrarQr(data.qr_image ?? null, data.qr_payload ?? null);
    } catch {
      setErro("Falha de conexão. Tenta de novo em alguns segundos.");
      setAberto(true);
    } finally {
      setLoading(false);
    }
  }

  // Caminho 2 — primeira cobrança: cadastra no Asaas e já devolve o QR, no mesmo clique.
  async function cadastrarEgerar() {
    setErro(null);
    setLoading(true);
    try {
      const res = await fetch("/api/billing/checkout-asaas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plano, forma: "pix", nome: nome.trim(), cpfCnpj: doc.replace(/\D/g, "") }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.tipo === "pix" && (data.qrImage || data.qrPayload)) {
        mostrarQr(data.qrImage ?? null, data.qrPayload ?? null);
        return;
      }
      setErro(data?.error ?? "Não consegui emitir a cobrança. Confere o CPF/CNPJ e tenta de novo.");
    } catch {
      setErro("Falha de conexão. Tenta de novo em alguns segundos.");
    } finally {
      setLoading(false);
    }
  }

  function fechar() {
    if (travado) return; // vencida: só sai pagando
    setAberto(false);
    setErro(null);
  }

  // Vencida: já sobe com o QR pronto pra quem tem cadastro (não obriga a clicar pra ver o valor).
  // Quem não tem cadastro cai no formulário, que já é o estado inicial.
  useEffect(() => {
    if (travado && !pedirCadastro && !pix && !erro && !loading) void pegarPix();
    // roda uma vez ao montar; os estados abaixo só existem pra não reentrar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Esc não fecha pop-up travado — o navegador nem tenta, mas o hábito do usuário é apertar Esc.
  useEffect(() => {
    if (!aberto || !travado) return;
    const bloqueiaEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") e.preventDefault();
    };
    document.addEventListener("keydown", bloqueiaEsc);
    // trava o scroll do painel atrás: a parede tem que parecer parede
    const overflowAntes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", bloqueiaEsc);
      document.body.style.overflow = overflowAntes;
    };
  }, [aberto, travado]);

  const inputStyle = { background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.15)" };

  const whatsappLink =
    "https://wa.me/5563992920080?text=" +
    encodeURIComponent(`Olá! Tive um problema pra pagar a mensalidade do ComandaPRO (${lojaNome}). Pode me ajudar?`);

  return (
    <>
      <div
        className="mb-4 flex items-center justify-between gap-3 rounded-xl border p-3"
        style={{ background: cor.bg, borderColor: cor.border }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: cor.dot }} />
          <span className="truncate text-sm">
            <strong className={`font-semibold ${cor.txt}`}>{texto}.</strong>{" "}
            <span className="hidden text-ink/70 sm:inline">{complemento}</span>
          </span>
        </div>
        <button
          type="button"
          onClick={pegarPix}
          disabled={loading}
          className="flex-shrink-0 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-bold text-white disabled:opacity-60"
          style={{ background: cor.btn }}
        >
          {loading ? "Gerando PIX…" : urgente ? "Pagar agora" : "Ver PIX"}
        </button>
      </div>

      {aberto &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{
              // vencida: fundo mais fechado, porque não é um aviso — é parede
              background: travado ? "rgba(20,15,13,0.92)" : "rgba(20,15,13,0.72)",
              backdropFilter: travado ? "blur(8px)" : "blur(4px)",
            }}
            onClick={fechar}
          >
            <div
              className="relative max-h-[92vh] w-full max-w-sm overflow-y-auto rounded-3xl p-6"
              style={{
                background: "rgba(26, 20, 18, 0.98)",
                border: "1px solid rgba(245, 72, 12, 0.28)",
                boxShadow: "0 30px 80px -30px rgba(245, 72, 12, 0.32)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* sem ✕ quando travado: não existe "depois eu vejo" */}
              {!travado && (
                <button
                  type="button"
                  onClick={fechar}
                  aria-label="Fechar"
                  className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:text-white"
                  style={{ background: "rgba(255,255,255,0.06)" }}
                >
                  ✕
                </button>
              )}

              {travado && !pago && (
                <div className="mb-4 rounded-xl px-3 py-2.5 text-center" style={{ background: "rgba(225,29,72,0.12)", border: "1px solid rgba(225,29,72,0.35)" }}>
                  <p className="text-sm font-bold text-red-300">Mensalidade vencida</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-300">
                    O painel volta a funcionar assim que o pagamento cair — leva segundos.
                  </p>
                </div>
              )}

              {pago ? (
                <div className="space-y-2 py-6 text-center">
                  <p className="text-lg font-bold text-emerald-300">Pagamento já confirmado!</p>
                  <p className="text-sm text-slate-400">Liberando seu painel…</p>
                </div>
              ) : pix ? (
                <>
                  <h2 className="text-center text-lg font-bold text-white">Pagar mensalidade</h2>
                  <PixInlineCheckout qrImage={pix.qrImage} qrPayload={pix.qrPayload} valorCents={pix.valorCents} label={pix.label} />
                </>
              ) : pedirCadastro ? (
                <div className="space-y-3">
                  <div className="text-center">
                    <h2 className="text-lg font-bold text-white">Pagar mensalidade</h2>
                    <p className="mt-1 text-sm text-slate-400">
                      {planoLabel} · <strong className="text-[#FF8A3D]">R$ {(valorCents / 100).toFixed(2).replace(".", ",")}</strong>
                    </p>
                  </div>

                  <p className="text-xs font-semibold text-[#FFB380]">Pra gerar o QR do PIX, preenche 2 dados:</p>
                  <input
                    type="text"
                    placeholder="Nome ou razão social"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="w-full rounded-lg px-3 py-2.5 text-sm text-white outline-none"
                    style={inputStyle}
                  />
                  <input
                    type="text"
                    placeholder="CPF ou CNPJ (só números)"
                    value={doc}
                    onChange={(e) => setDoc(e.target.value.replace(/\D/g, "").slice(0, 14))}
                    inputMode="numeric"
                    className="w-full rounded-lg px-3 py-2.5 text-sm text-white outline-none"
                    style={inputStyle}
                  />
                  <p className="text-[10px] text-slate-400">Fica só com o Asaas pra emitir a cobrança — não compartilhamos.</p>

                  {erro && <p className="text-center text-xs text-red-300">{erro}</p>}

                  <button
                    type="button"
                    onClick={cadastrarEgerar}
                    disabled={loading || !nome.trim() || !docValido(doc)}
                    className="w-full rounded-xl py-3 text-sm font-bold text-white transition-all disabled:opacity-40"
                    style={{ background: "linear-gradient(135deg, #FF8A3D 0%, #F5480C 100%)" }}
                  >
                    {loading ? "Gerando o QR do PIX…" : "Gerar QR do PIX"}
                  </button>
                </div>
              ) : erro ? (
                <div className="space-y-3 py-6 text-center">
                  <p className="text-sm text-red-300">{erro}</p>
                  <button
                    type="button"
                    onClick={pegarPix}
                    className="rounded-lg px-4 py-2 text-sm font-bold text-white"
                    style={{ background: "linear-gradient(135deg, #FF8A3D 0%, #F5480C 100%)" }}
                  >
                    Tentar de novo
                  </button>
                </div>
              ) : null}

              {/* Saída de emergência do pop-up travado. NÃO libera o painel — mas sem isso, uma
                  falha do Asaas deixaria o dono preso numa tela sem nenhuma ação possível, no meio
                  do serviço. Ele fala com a gente e a gente destrava na mão. */}
              {travado && !pago && (
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold text-white"
                  style={{ background: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)" }}
                >
                  Problema com o pagamento? Falar com a Impulso
                </a>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
