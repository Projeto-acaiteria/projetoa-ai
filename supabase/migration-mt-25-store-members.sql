-- ComandaPRO — contas de FUNCIONÁRIO com papéis (owner/reception/technician).
-- Hoje é 1 conta = 1 loja (stores.owner_id). store_members mapeia MAIS usuários a uma loja, com papel.
-- O dono também vira member (role=owner) no backfill, pra tudo ficar uniforme membership-based.
-- RLS aqui é de TABELA NOVA (não toca nas tabelas existentes → risco zero pro Cantinho).
create table if not exists public.store_members (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references public.stores(id) on delete cascade,
  user_id       uuid not null,                        -- login do funcionário (auth.users)
  role          text not null default 'reception',    -- 'owner' | 'reception' | 'technician'
  technician_id uuid,                                  -- vínculo ao registro de técnico (vertical AT)
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (store_id, user_id)
);
create index if not exists store_members_user on public.store_members(user_id, active);
create index if not exists store_members_store on public.store_members(store_id, active);

-- backfill: todo dono atual vira member role=owner (idempotente)
insert into public.store_members (store_id, user_id, role)
select id, owner_id, 'owner' from public.stores where owner_id is not null
on conflict (store_id, user_id) do nothing;

alter table public.store_members enable row level security;
drop policy if exists store_owner on public.store_members;
-- o usuário lê a PRÓPRIA membership (pra resolver a loja dele); o dono da loja GERE os membros dela.
create policy store_owner on public.store_members for all to authenticated
  using (
    user_id = auth.uid()
    or store_id in (select id from stores where owner_id = auth.uid())
  )
  with check (
    store_id in (select id from stores where owner_id = auth.uid())
  );
