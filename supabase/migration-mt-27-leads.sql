-- ComandaPRO — CAPTURA DE LEAD (não perder quem preenche o modal e abandona o cadastro).
-- Hoje o modal joga Nome/WhatsApp/Negócio direto na querystring do /cadastro. Se o lead
-- abandona o wizard antes de criar a conta, o contato evapora. Esta tabela persiste o lead
-- no momento em que ele preenche o modal — antes de exigir e-mail/senha/slug.
-- Tabela NOVA + RLS própria → não toca nenhuma tabela existente (risco zero pro Cantinho/Medellín/Starteq).
create table if not exists public.leads (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  whatsapp      text not null,                         -- só dígitos (DDD+número)
  business_name text not null,
  segment       text,                                  -- null: o modal não coleta segmento
  source        text not null default 'home',          -- 'home' | slug do nicho ('bar', 'sushi'…)
  status        text not null default 'novo',          -- 'novo' | 'convertido'
  store_id      uuid references public.stores(id) on delete set null,  -- preenchido quando converte
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
-- dedupe leve: reusar o lead 'novo' do mesmo WhatsApp em vez de duplicar (refresh/reenvio)
create index if not exists leads_whatsapp on public.leads(whatsapp);
create index if not exists leads_status_created on public.leads(status, created_at desc);

-- WhatsApp é dado pessoal. RLS ligada SEM policy pública → nada de anon/authenticated;
-- só as rotas server-side (service-role bypassa RLS) leem/escrevem. O painel do dono
-- lerá via server-side, como o resto do ComandaPRO.
alter table public.leads enable row level security;
