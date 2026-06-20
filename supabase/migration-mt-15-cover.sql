-- ComandaPRO — bar 2a onda: COVER ARTISTICO. Evento da noite (artista + cover por pessoa + repasse).
-- A comanda guarda o cover em SNAPSHOT na abertura (people_count x cover ativo) — nao muda se o evento
-- mudar depois. Relatorio: arrecadado vs repasse por evento. cover_enabled ja existe no store_config.
create table if not exists public.events (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid not null references public.stores(id) on delete cascade,
  artist       text not null,
  event_date   date not null,
  cover_cents  int  not null default 0,
  repasse_cents int not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists events_store on public.events(store_id, event_date desc);

alter table public.tabs add column if not exists cover_cents int not null default 0;   -- snapshot (cover x pessoas)
alter table public.tabs add column if not exists people_count int not null default 1;

alter table public.events enable row level security;
drop policy if exists store_owner on public.events;
create policy store_owner on public.events for all to authenticated
  using (store_id in (select id from stores where owner_id = auth.uid()))
  with check (store_id in (select id from stores where owner_id = auth.uid()));
