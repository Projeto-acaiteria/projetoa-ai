import { getCurrentStore } from "@/lib/auth/store";
import { db } from "@/lib/supabase";
import { BILLING } from "@/config/billing";
import PagarClient from "./PagarClient";
import LogoutButton from "./LogoutButton";
import { Logo } from "@/components/site/Logo";

export const dynamic = "force-dynamic";

// Tela de cobrança do ComandaPRO (fora do (protected) — não passa pelo gate de billing, só pelo de
// login). Cobrança DENTRO do app: PIX com QR inline + cartão recorrente, igual AgendaPRO. — ComandaPRO 3.8
export default async function BloqueadoPage() {
  const loja = await getCurrentStore();
  const { data: sub } = loja
    ? await db().from("subscriptions").select("status, pix_link_atual").eq("store_id", loja.id).maybeSingle()
    : { data: null };

  const planos = Object.entries(BILLING.planos).map(([id, p]) => ({
    id,
    label: p.label,
    cents: p.cents,
    equivMes: p.equivMes,
    meses: p.meses,
  }));
  const mensalReais = BILLING.planos.mensal.equivMes;

  const reativar = sub?.status === "cancelled";

  const titulo = reativar
    ? "Assinatura cancelada"
    : sub?.status === "past_due"
      ? "Pagamento em atraso"
      : sub?.status === "trial"
        ? "Última etapa: liberar o painel"
        : "Assinatura pendente";

  const mensagem = reativar
    ? "Sua assinatura foi cancelada. Quer voltar? Escolhe um plano abaixo ou fala com a gente."
    : sub?.status === "past_due"
      ? "Tivemos uma falha na cobrança. Regularize pra manter o painel no ar."
      : sub?.status === "trial"
        ? `Sua conta${loja?.name ? ` da ${loja.name}` : ""} está pronta. Agora é só escolher um plano pra continuar usando.`
        : "Escolha um plano pra continuar usando o painel.";

  const waMsg = `Olá! Quero ativar meu plano do ComandaPRO${loja?.name ? ` (${loja.name})` : ""}. Pode me ajudar?`;
  const whatsappLink = "https://wa.me/5563992920080?text=" + encodeURIComponent(waMsg);

  const auroraBg = {
    background:
      "radial-gradient(ellipse 80% 60% at 20% 20%, rgba(245,72,12,0.28) 0%, transparent 55%), radial-gradient(ellipse 70% 50% at 85% 80%, rgba(255,138,61,0.18) 0%, transparent 55%), #140f0d",
  };
  const cardStyle = {
    background: "rgba(26, 20, 18, 0.78)",
    border: "1px solid rgba(245, 72, 12, 0.28)",
    boxShadow: "0 30px 80px -30px rgba(245, 72, 12, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.06)",
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden p-4" style={auroraBg}>
      <div className="relative w-full max-w-sm">
        <div className="mb-5 flex flex-col items-center text-center">
          <Logo light />
          <div
            className="mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
            style={{
              background: "linear-gradient(135deg, rgba(245,72,12,0.22) 0%, rgba(255,138,61,0.22) 100%)",
              color: "#FF8A3D",
              border: "1px solid rgba(245,72,12,0.32)",
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8 5.8 21.3l2.4-7.4L2 9.4h7.6z" />
            </svg>
            Sem setup · sem fidelidade
          </div>
        </div>

        <div className="space-y-5 rounded-3xl p-6" style={cardStyle}>
          <div className="text-center">
            <h2 className="text-xl font-bold text-white">{titulo}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{mensagem}</p>
          </div>

          {/* Plano em destaque */}
          <div className="rounded-2xl p-4" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(245,72,12,0.22)" }}>
            <div className="mb-3 flex items-start justify-between">
              <div>
                <p className="text-base font-bold text-white">Plano ComandaPRO</p>
                <p className="text-xs text-slate-400">Mensalidade · sem setup</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold leading-none text-[#FF8A3D]">R$ {mensalReais}</p>
                <p className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-500">por mês</p>
              </div>
            </div>
            <div className="flex items-start gap-2 border-t border-white/5 pt-3">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <p className="text-xs leading-snug text-slate-300">Sem setup · sem fidelidade · cancela quando quiser</p>
            </div>
            <div className="mt-2 flex items-start gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <p className="text-xs leading-snug text-slate-300">Garantia de 7 dias após o pagamento</p>
            </div>
          </div>

          {/* Pagamento já iniciado — retoma de onde parou */}
          {sub?.pix_link_atual && (
            <div className="space-y-2 rounded-2xl p-4" style={{ background: "rgba(59,130,246,0.10)", border: "1px solid rgba(59,130,246,0.35)" }}>
              <p className="text-xs font-semibold text-blue-200">Você já iniciou um pagamento.</p>
              <a
                href={sub.pix_link_atual}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block w-full rounded-xl py-2.5 text-center text-sm font-bold text-white"
                style={{ background: "linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%)", boxShadow: "0 8px 20px -6px rgba(59,130,246,0.5)" }}
              >
                Continuar pagamento →
              </a>
            </div>
          )}

          <PagarClient planos={planos} lojaNome={loja?.name ?? ""} />

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">ou</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white"
            style={{ background: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)", boxShadow: "0 8px 20px -6px rgba(37,211,102,0.5)" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
            </svg>
            Falar com a Impulso pelo WhatsApp
          </a>
        </div>

        <div className="mt-6 flex justify-center">
          <LogoutButton />
        </div>
        <p className="mt-4 text-center text-xs text-slate-600">ComandaPRO · Impulso Digital</p>
      </div>
    </main>
  );
}
