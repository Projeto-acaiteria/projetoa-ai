-- Ativação multi-tenant: config (app_settings/menu/loyalty) deixa de ser singleton id=1.
-- unique(store_id) = 1 config por loja (permite upsert/leitura por store_id).
do $$
declare t text;
begin
  foreach t in array array['app_settings','app_menu','app_loyalty'] loop
    begin
      execute format('alter table public.%I add constraint %I unique (store_id)', t, t || '_store_id_uq');
    exception when duplicate_object then null; when others then null; end;
  end loop;
end $$;
