-- Ativação: remove os CHECK singleton (id=1) dos config — cada loja passa a ter sua linha.
-- Seguro p/ a produção antiga (que usa id=1, válido com ou sem o check).
do $$
declare r record;
begin
  for r in select conrelid::regclass::text as t, conname from pg_constraint
    where contype='c' and conname like '%singleton%'
      and conrelid::regclass::text in ('app_settings','app_menu','app_loyalty')
  loop
    execute format('alter table %s drop constraint %I', r.t, r.conname);
  end loop;
end $$;
