// Idempotência por op_id (Fatia 1 do offline-first — ver OFFLINE-FIRST-PLANO.md).
// Garante que uma operação de escrita roda no MÁXIMO 1 vez por op_id, mesmo com replay/retry da fila
// offline. DORMENTE: sem opId, roda direto (fluxo online idêntico ao de hoje).
//
// Fluxo com opId: CLAIM por primary key (trava a corrida no banco) → executa o trabalho → grava o
// result. Replay cai no 23505 e devolve o result gravado, sem refazer nada.
import { db } from "@/lib/supabase";

export type IdemOutcome<T> = { result: T; replayed: boolean };

// erro sinalizando "op ainda em processamento" (claim existe, result não gravado) → cliente retenta
export class InflightError extends Error {
  inflight = true;
  constructor() { super("Operação ainda em processamento — tente de novo."); }
}

/** Executa `fn` no máximo uma vez por `opId`.
 *  - sem opId  → roda direto (online; comportamento inalterado).
 *  - com opId  → claim (PK) → fn → grava result; replay devolve o result gravado.
 *  Se o trabalho falhar, o claim é solto (op não criou nada de definitivo → pode retentar). */
export async function withIdempotency<T>(
  opId: string | undefined | null,
  storeId: string,
  kind: string,
  fn: () => Promise<T>,
): Promise<IdemOutcome<T>> {
  if (!opId) return { result: await fn(), replayed: false };
  const d = db();

  // 1) CLAIM — o primary key op_id serializa replays concorrentes
  const { error: claimErr } = await d.from("processed_ops").insert({ op_id: opId, store_id: storeId, kind });
  if (claimErr) {
    if ((claimErr as { code?: string }).code === "23505") {
      // já existe: processado (result presente → replay) ou em voo (result null → retenta)
      const { data } = await d.from("processed_ops").select("result").eq("op_id", opId).eq("store_id", storeId).maybeSingle();
      const stored = (data as { result?: T } | null)?.result;
      if (stored != null) return { result: stored, replayed: true };
      throw new InflightError();
    }
    throw claimErr;
  }

  // 2) nós ganhamos o claim → executa e grava o result (a mesma resposta que o replay vai receber)
  try {
    const result = await fn();
    await d.from("processed_ops").update({ result }).eq("op_id", opId).eq("store_id", storeId);
    return { result, replayed: false };
  } catch (e) {
    // trabalho falhou → solta o claim (só se ainda sem result) pra permitir novo replay
    await d.from("processed_ops").delete().eq("op_id", opId).eq("store_id", storeId).is("result", null);
    throw e;
  }
}

/** Erro com status HTTP explícito — pra o fn dentro de withIdempotency sinalizar 400/409 sem
 *  virar 500 no catch da rota. */
export function httpError(status: number, message: string): Error {
  return Object.assign(new Error(message), { httpStatus: status });
}
