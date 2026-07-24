-- mt-35: LEDGER DE IDEMPOTÊNCIA (Fatia 1 do offline-first — ver OFFLINE-FIRST-PLANO.md).
-- Cada operação de escrita crítica pode carregar um op_id gerado no CLIENTE e reusado em todo replay.
-- O servidor grava a op UMA vez; replay/retry devolve o MESMO resultado em vez de duplicar (o risco
-- do offline: rede cai depois que o servidor gravou → cliente reenvia → pedido/cobrança em dobro).
--
-- DORMENTE: hoje nenhum cliente manda op_id → nada muda no fluxo online. Só entra em ação quando o
-- offline for ligado. Aditivo e seguro pros tenants em produção (Cantinho/Medellín).
create table if not exists processed_ops (
  op_id      text primary key,          -- gerado no cliente (time+rand/uuid), reusado no replay
  store_id   uuid not null references stores(id) on delete cascade,
  kind       text not null,             -- 'lancar' | 'pagamento' | 'fechar' | ...
  result     jsonb,                     -- a MESMA resposta da 1ª vez (ex.: { tabId }); null = em processamento
  created_at timestamptz not null default now()
);

create index if not exists processed_ops_store_created_idx on processed_ops (store_id, created_at);

alter table processed_ops enable row level security;
drop policy if exists store_owner on public.processed_ops;
create policy store_owner on public.processed_ops for all to authenticated
  using (store_id in (select id from stores where owner_id = auth.uid()))
  with check (store_id in (select id from stores where owner_id = auth.uid()));
