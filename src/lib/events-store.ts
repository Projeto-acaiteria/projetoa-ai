// Cover artístico / agenda de shows (bar 2ª onda). Casa cadastra o show da noite (artista + cover por
// pessoa + repasse). A comanda guarda o cover em snapshot na abertura. Server-side, por loja.
import { db } from "@/lib/supabase";
import { resolveStoreId } from "@/lib/auth/current";
import { todayBR, inicioDiaBR, addDiasBR } from "@/lib/date-br";

const num = (v: unknown) => Number(v ?? 0);

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
  const today = todayBR();
  const { data } = await db().from("events").select("*").eq("store_id", sid).eq("active", true).eq("event_date", today).limit(1).maybeSingle();
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
    // soma o cover snapshot das comandas abertas no dia do show
    const { data } = await db()
      .from("tabs")
      .select("cover_cents, opened_at")
      .eq("store_id", sid)
      .gte("opened_at", inicioDiaBR(e.event_date))
      .lt("opened_at", inicioDiaBR(addDiasBR(e.event_date, 1)));
    const rows = (data ?? []) as { cover_cents: number }[];
    out.push({ ...e, arrecadado_cents: rows.reduce((s, r) => s + num(r.cover_cents), 0), comandas: rows.filter((r) => num(r.cover_cents) > 0).length });
  }
  return out;
}
