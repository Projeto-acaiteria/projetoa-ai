-- mt-38: acesso do GARÇOM por CÓDIGO, sem email nem senha.
--
-- Motivo (Medellín, 28/07/2026): a casa troca de garçom quase toda semana e achou complicado
-- cadastrar + inventar email/senha + digitar no celular do cara. O sistema antigo deles só gerava
-- um link. Aqui o dono gera um CÓDIGO de 6 dígitos; o garçom instala o app e digita o código.
--
-- Uso ÚNICO e com validade curta: o código morre ao ser usado (used_at) ou quando expira. Um código
-- vazado no grupo do zap depois de usado não serve pra ninguém. Revogar o acesso = desativar o
-- store_members (getCurrentStore exige active=true), não depende desta tabela.
--
-- Sem policy pra authenticated DE PROPÓSITO (mesmo padrão de subscriptions/billing_events): só o
-- service-role lê/escreve. O garçom nunca consulta esta tabela — ele manda o código pra uma rota.

create table if not exists public.staff_invites (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores(id) on delete cascade,
  staff_id    uuid not null references public.staff(id) on delete cascade,
  code        text not null,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- busca do código na hora de entrar (só os vivos)
create index if not exists staff_invites_code_idx on public.staff_invites (code) where used_at is null;
create index if not exists staff_invites_staff_idx on public.staff_invites (staff_id);

-- dois códigos iguais VIVOS ao mesmo tempo tornariam o login ambíguo → o gerador tem que sortear outro
create unique index if not exists staff_invites_code_vivo_uq on public.staff_invites (code) where used_at is null;

alter table public.staff_invites enable row level security;
revoke all on public.staff_invites from anon, authenticated;

comment on table public.staff_invites is
  'Convite de acesso do garçom: código de 6 dígitos, uso único, validade curta. O garçom instala o app e digita o código — sem email/senha. Revogação real é store_members.active=false.';
