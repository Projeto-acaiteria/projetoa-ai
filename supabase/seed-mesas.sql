-- Seed das mesas do salão. Idempotente — pra aumentar, troque o 40 e rode de novo
-- (ou use o botão "adicionar mesas" no salão, que chama ensureTables(n)).
insert into tables (number, area)
select g, 'salao' from generate_series(1, 40) g
on conflict (number) do nothing;
