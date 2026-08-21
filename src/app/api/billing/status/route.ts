import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { getCurrentStore } from "@/lib/auth/store";
import { liberarPorPagamento } from "@/lib/billing/liberar";
import * as asaas from "@/lib/asaas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/billing/status — o checkout inline faz polling aqui a cada 5s. Quando o pagamento
// confirma e vira status='active', o painel libera sozinho (sem refresh manual). — ComandaPRO 3.8
//
// 3.9: não depende MAIS só do webhook. Enquanto a loja não está ativa e existe cobrança em aberto,
// esta rota PERGUNTA ao Asaas se o pagamento caiu e libera na hora. O webhook continua sendo o
// caminho principal (libera mesmo com a tela fechada); isto aqui cobre o caso de ele não chegar —
// que é justamente o que nunca deu pra provar, porque nenhum tenant tinha pago até hoje.
const PAGOS = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);

export async function GET() {
  const loja = await getCurrentStore();
  if (!loja) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { data: sub } = await db()
    .from("subscriptions")
    .select("status, pago_ate, asaas_payment_id_atual, plano, permanent_courtesy")
    .eq("store_id", loja.id)
    .maybeSingle();

  if (!sub) return NextResponse.json({ subscription: null });

  // Conferência no Asaas: só quando faz diferença (não-ativa, sem cortesia, com cobrança emitida).
  if (sub.status !== "active" && !sub.permanent_courtesy && sub.asaas_payment_id_atual) {
    try {
      const pay = await asaas.getPaymentById(sub.asaas_payment_id_atual);
      const st = pay.data?.status ?? "";
      if (PAGOS.has(st)) {
        // meses vêm do externalReference (store_id|plano|meses) — mesma fonte que o webhook lê,
        // pra semestral/anual somarem o período certo e não virarem 1 mês.
        const meses = parseInt((pay.data?.externalReference ?? "").split("|")[2] || "1", 10) || 1;
        await liberarPorPagamento({
          storeId: loja.id,
          paymentId: sub.asaas_payment_id_atual,
          event: `POLL_${st}`,
          meses,
        });
        // relê do banco: quem responde é a row, não o que a gente acha que gravou (λ.prova-na-fonte)
        const { data: novo } = await db()
          .from("subscriptions")
          .select("status, pago_ate")
          .eq("store_id", loja.id)
          .maybeSingle();
        return NextResponse.json({ subscription: novo ?? null, via: "asaas" });
      }
    } catch {
      // Asaas fora do ar / rate limit: devolve o que o banco tem e a próxima rodada tenta de novo
    }
  }

  return NextResponse.json({ subscription: { status: sub.status, pago_ate: sub.pago_ate } });
}
