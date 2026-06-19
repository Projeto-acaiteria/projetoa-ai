-- ComandaPRO multi-tenant — Fase 1, fatia 1: tabela-mãe de tenant + Cantinho = loja #1.
-- Aditivo puro (não toca tabelas existentes). owner_id nullable por ora (auth entra na Fase 2).

create table if not exists stores (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,                 -- URL pública /[slug]
  name        text not null,
  tagline     text,                                 -- ex "Açaiteria" (white-label do cupom)
  owner_id    uuid references auth.users(id),       -- dono (1 conta = 1 loja); preenchido na Fase 2
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Cantinho do Açaí (Vidal) = loja #1. Idempotente.
insert into stores (slug, name, tagline)
select 'cantinho-do-acai', 'Cantinho do Açaí', 'Açaiteria'
where not exists (select 1 from stores where slug = 'cantinho-do-acai');
