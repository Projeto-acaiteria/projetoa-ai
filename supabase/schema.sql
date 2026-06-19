-- ════════════════════════════════════════════════════════════════
-- Cantinho do Açaí — Schema Supabase
-- Valores em centavos (int). Rodar inteiro de uma vez no SQL Editor.
-- ════════════════════════════════════════════════════════════════

-- ─────────────── ENTIDADES EXISTENTES (delivery / balcão) ───────────────

-- Pedidos (delivery, retirada, balcão). items/consumes em JSONB.
create table if not exists orders (
  id              bigint generated always as identity primary key,
  display         text not null,
  created_at      timestamptz not null default now(),
  customer_name   text not null default '',
  phone           text not null default '',
  address         text,
  bairro          text,
  mode            text not null default 'balcao',          -- retirada | entrega | balcao
  size_label      text not null default '',
  items           jsonb not null default '[]',             -- OrderItem[]
  consumes        jsonb not null default '[]',             -- ficha técnica p/ baixa estoque
  consumed        boolean not null default false,
  subtotal_cents  int not null default 0,
  fee_cents       int not null default 0,
  total_cents     int not null default 0,
  status          text not null default 'recebido',        -- recebido|preparo|saiu|entregue
  points_awarded  int,
  payment_method  text,                                    -- dinheiro|pix|debito|credito
  card_fee_cents  int
);
create index if not exists orders_status_idx on orders(status);
create index if not exists orders_created_idx on orders(created_at);

-- Clientes (fidelidade). history em JSONB.
create table if not exists customers (
  phone       text primary key,                            -- só dígitos
  name        text not null default '',
  points      int not null default 0,
  created_at  timestamptz not null default now(),
  history     jsonb not null default '[]',                 -- PointsTx[]
  birthday    date
);

-- Estoque. history em JSONB.
create table if not exists stock_items (
  id               text primary key,
  name             text not null,
  category         text not null,
  qty              numeric not null default 0,
  unit             text not null default 'un',
  min_qty          numeric not null default 0,
  expiry           date,
  sell_price_cents int,
  updated_at       timestamptz not null default now(),
  history          jsonb not null default '[]'             -- StockMove[]
);

-- Sessões de caixa. movements em JSONB.
create table if not exists cash_sessions (
  id                  bigint generated always as identity primary key,
  opened_at           timestamptz not null default now(),
  operator            text,
  opening_float_cents int not null default 0,
  movements           jsonb not null default '[]',         -- CashMovement[]
  status              text not null default 'aberto',      -- aberto | fechado
  closed_at           timestamptz,
  counted_cents       int,
  expected_cents      int,
  diff_cents          int,
  sales_cash_cents    int,
  sales_total_cents   int
);

-- Despesas variáveis e fixas.
create table if not exists expenses (
  id            text primary key,
  description   text not null,
  category      text not null,
  amount_cents  int not null default 0,
  date          date not null,
  created_at    timestamptz not null default now()
);
create table if not exists fixed_expenses (
  id            text primary key,
  description   text not null,
  category      text not null,
  amount_cents  int not null default 0
);

-- Config single-row (id=1): settings da loja + taxas, cardápio, fidelidade.
create table if not exists app_settings (
  id    int primary key default 1,
  data  jsonb not null default '{}',
  constraint settings_singleton check (id = 1)
);
create table if not exists app_menu (
  id    int primary key default 1,
  data  jsonb not null default '{}',
  constraint menu_singleton check (id = 1)
);
create table if not exists app_loyalty (
  id    int primary key default 1,
  data  jsonb not null default '{}',
  constraint loyalty_singleton check (id = 1)
);

-- ─────────────── MÓDULO DE MESAS (novo) ───────────────

-- Mesas do salão.
create table if not exists tables (
  id      bigint generated always as identity primary key,
  number  int not null unique,
  area    text not null default 'salao'                    -- salao | balcao
);

-- Comandas (uma mesa pode ter uma comanda aberta por vez).
create table if not exists tabs (
  id                bigint generated always as identity primary key,
  table_id          bigint references tables(id) on delete set null,
  label             text,                                  -- nome do cliente / "Balcão 1"
  status            text not null default 'aberta',        -- aberta | fechada
  opened_at         timestamptz not null default now(),
  closed_at         timestamptz,
  service_fee_cents int not null default 0,                -- taxa de serviço no fechamento
  customer_phone    text,                                  -- p/ pontuar fidelidade ao fechar
  customer_name     text
);
create index if not exists tabs_status_idx on tabs(status);

-- Pedidos lançados numa comanda.
create table if not exists tab_orders (
  id          bigint generated always as identity primary key,
  tab_id      bigint not null references tabs(id) on delete cascade,
  note        text,
  status      text not null default 'pendente',            -- pendente|preparando|pronto|entregue
  created_at  timestamptz not null default now()
);

-- Itens de cada pedido da comanda. consumes = ficha técnica p/ baixa estoque.
create table if not exists tab_order_items (
  id               bigint generated always as identity primary key,
  tab_order_id     bigint not null references tab_orders(id) on delete cascade,
  name             text not null,
  size_label       text,
  qty              int not null default 1,
  unit_price_cents int not null default 0,
  consumes         jsonb not null default '[]'
);

-- Pagamentos da comanda (multi-pagamento).
create table if not exists tab_payments (
  id           bigint generated always as identity primary key,
  tab_id       bigint not null references tabs(id) on delete cascade,
  method       text not null,                              -- dinheiro|pix|credito|debito
  amount_cents int not null default 0,
  fee_percent  numeric default 0,
  paid_at      timestamptz not null default now()
);

-- Chamados de mesa (pediu a conta / chamar atendente).
create table if not exists service_calls (
  id            bigint generated always as identity primary key,
  table_number  int,
  tab_id        bigint references tabs(id) on delete set null,
  type          text not null default 'conta',             -- conta | atendente
  status        text not null default 'pendente',          -- pendente | atendido
  created_at    timestamptz not null default now()
);
create index if not exists service_calls_status_idx on service_calls(status);

-- ─────────────── REALTIME + RLS (modo single-tenant/demo) ───────────────
-- Mesas precisam de realtime (grade ao vivo). RLS permissiva pro anon ler;
-- o service_role (server) bypassa RLS de qualquer forma.
alter publication supabase_realtime add table tabs, tab_orders, tab_order_items, tab_payments, service_calls;

do $$
declare t text;
begin
  foreach t in array array['orders','customers','stock_items','cash_sessions','expenses','fixed_expenses',
    'app_settings','app_menu','app_loyalty','tables','tabs','tab_orders','tab_order_items','tab_payments','service_calls']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists demo_all on %I', t);
    execute format('create policy demo_all on %I for all using (true) with check (true)', t);
  end loop;
end $$;
