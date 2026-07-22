// Cover artístico / agenda de shows (bar 2ª onda). Casa cadastra o show da noite (artista + cover por
// pessoa + repasse). A comanda guarda o cover em snapshot na abertura. Server-side, por loja.
import { db } from "@/lib/supabase";
import { resolveStoreId } from "@/lib/auth/current";
import { todayBR, addDiasBR, hourBR } from "@/lib/date-br";

const num = (v: unknown) => Number(v ?? 0);

// A "noite" de um bar vai até de madrugada. Antes deste horário, a noite operacional ainda é a do
// dia ANTERIOR — então o show de sábado segue ativo pra mesa que abre domingo 00:20.
const CUTOFF_NOITE_HORA = 6;
/** Data (YYYY-MM-DD) da noite operacional AGORA no fuso BR. Antes das 6h → dia anterior. */
export function noiteOperacionalBR(): string {
  return hourBR() < CUTOFF_NOITE_HORA ? addDiasBR(todayBR(), -1) : todayBR();
}
/** Janela [início, fim) de timestamps da noite operacional de um show (event_date): das 6h do dia
 *  do show às 6h do dia seguinte. Casa com getActiveEvent — pega a madrugada pós-meia-noite. */
const noiteInicio = (ymd: string): string => `${ymd}T${String(CUTOFF_NOITE_HORA).padStart(2, "0")}:00:00-03:00`;

/** Início (ISO) da noite operacional ATUAL — o "zero do dia" do bar (6h). É a âncora do Caixa e do
 *  dashboard: o bar abre 18h e fecha até 06h, então a venda das 02h ainda é da noite anterior e NÃO
 *  pode cair no dia civil seguinte. Independe da sessão de caixa (que pode ser reaberta no meio da
 *  noite). Loja diurna (açaí) não é afetada: a janela 6h→6h cobre o dia comercial inteiro dela. */
export function inicioNoiteOperacionalISO(): string {
  return noiteInicio(noiteOperacionalBR());
}

export type EventRow = {
  id: string;
  artist: string;
  event_date: string; // YYYY-MM-DD
  cover_cents: number;
  repasse_cents: number;
  active: boolean;
};

const toEvent = (r: Record<string, unknown>): EventRow => ({
  id: String(r.id),
  artist: String(r.artist ?? ""),
  event_date: String(r.event_date ?? ""),
  cover_cents: num(r.cover_cents),
  repasse_cents: num(r.repasse_cents),
  active: Boolean(r.active),
});

export async function listEvents(storeId?: string): Promise<EventRow[]> {
  const sid = storeId ?? (await resolveStoreId());
  const { data } = await db().from("events").select("*").eq("store_id", sid).order("event_date", { ascending: false });
  return ((data ?? []) as Record<string, unknown>[]).map(toEvent);
}

/** Show ativo HOJE — usado pra aplicar o cover na abertura. TRAVA LEGAL: só cobra couvert se há
 *  atração ao vivo no dia (event_date = hoje + active). Sem show hoje, getActiveEvent=null, cover=0. */
export async function getActiveEvent(storeId?: string): Promise<EventRow | null> {
  const sid = storeId ?? (await resolveStoreId());
  // noite operacional (não o dia civil): mesa aberta 00:20 numa noite de show ainda pega o cover.
  const noite = noiteOperacionalBR();
  const { data } = await db().from("events").select("*").eq("store_id", sid).eq("active", true).eq("event_date", noite).limit(1).maybeSingle();
  return data ? toEvent(data as Record<string, unknown>) : null;
}

export type EventInput = { artist: string; event_date: string; cover_cents: number; repasse_cents?: number; active?: boolean };

export async function createEvent(input: EventInput, storeId?: string): Promise<EventRow> {
  const sid = storeId ?? (await resolveStoreId());
  const { data, error } = await db().from("events").insert({
    store_id: sid, artist: input.artist.trim(), event_date: input.event_date,
    cover_cents: Math.max(0, Math.round(input.cover_cents)), repasse_cents: Math.max(0, Math.round(input.repasse_cents ?? 0)), active: input.active ?? true,
  }).select("*").single();
  if (error || !data) throw new Error(error?.message ?? "Falha ao criar o show.");
  return toEvent(data);
}

export async function updateEvent(id: string, patch: Partial<EventInput>, storeId?: string): Promise<void> {
  const sid = storeId ?? (await resolveStoreId());
  await db().from("events").update(patch).eq("id", id).eq("store_id", sid);
}

export async function deleteEvent(id: string, storeId?: string): Promise<void> {
  const sid = storeId ?? (await resolveStoreId());
  await db().from("events").delete().eq("id", id).eq("store_id", sid);
}

/** Relatório de cover por show: arrecadado (snapshot nas comandas do dia do show) vs repasse. */
export async function coverReport(storeId?: string): Promise<Array<EventRow & { arrecadado_cents: number; comandas: number }>> {
  const sid = storeId ?? (await resolveStoreId());
  const events = await listEvents(sid);
  const out: Array<EventRow & { arrecadado_cents: number; comandas: number }> = [];
  for (const e of events) {
    // soma o cover das comandas FECHADAS da noite operacional do show (6h→6h). Só comanda fechada =
    // cover efetivamente arrecadado (mesa aberta ainda pode não pagar/recusar o couvert).
    const { data } = await db()
      .from("tabs")
      .select("cover_cents, opened_at")
      .eq("store_id", sid)
      .eq("status", "fechada")
      .gte("opened_at", noiteInicio(e.event_date))
      .lt("opened_at", noiteInicio(addDiasBR(e.event_date, 1)));
    const rows = (data ?? []) as { cover_cents: number }[];
    out.push({ ...e, arrecadado_cents: rows.reduce((s, r) => s + num(r.cover_cents), 0), comandas: rows.filter((r) => num(r.cover_cents) > 0).length });
  }
  return out;
}
