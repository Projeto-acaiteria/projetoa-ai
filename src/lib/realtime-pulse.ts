import "server-only";

// TEMPO REAL (31/07) — o servidor AVISA em vez de ser perguntado.
//
// Antes: cada tela aberta perguntava de 12 em 12 segundos, a noite toda, mesmo com o bar vazio —
// 1,2M de invocações/mês na Vercel (limite 1M) só de polling ocioso. Agora o servidor manda um
// toque no canal da loja quando algo muda de verdade, e a tela busca UMA vez.
//
// O que trafega é só o assunto ("mesas", "preparo", "impressao") — NUNCA dado de venda. Quem
// calcula continua sendo o servidor: a tela recebe o toque e chama a mesma rota de sempre. Isso
// mantém a conta num lugar só (duplicar conta no cliente já gerou 2 bugs em julho).
//
// Broadcast por HTTP de propósito: abrir websocket dentro de função serverless seria caro e lento.
// Um POST resolve (medido: 202 aceito, aviso chega ao navegador em ~420ms).

import { after } from "next/server";

export type PulseTopic = "mesas" | "preparo" | "impressao" | "pedidos";

export const canalDaLoja = (storeId: string) => `loja:${storeId}`;

/** Avisa DEPOIS que a resposta já saiu. É esta que o caminho crítico usa: o garçom vê o item na
 *  tela na hora, e o toque pras outras telas viaja em seguida — sem somar espera no gesto que ele
 *  repete a noite inteira. Fora de requisição (scripts/seed), `after` não existe → manda direto. */
export function pulseDepois(storeId: string, topic: PulseTopic): void {
  try {
    after(() => pulse(storeId, topic));
  } catch {
    void pulse(storeId, topic);
  }
}

/** Avisa as telas daquela loja que algo mudou. NUNCA lança: aviso é conforto, não pode derrubar
 *  a venda que já foi gravada. Se falhar, o polling de segurança das telas cobre. */
export async function pulse(storeId: string, topic: PulseTopic): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !storeId) return;
  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        messages: [{ topic: canalDaLoja(storeId), event: "pulse", payload: { t: topic }, private: false }],
      }),
      // o aviso não pode segurar a resposta da venda
      signal: AbortSignal.timeout(2500),
    });
  } catch (e) {
    console.error("pulse:", topic, e instanceof Error ? e.message : e);
  }
}
