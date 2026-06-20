-- Ativação: id dos config deixa de ser fixo '1' → sequence (novos inserts pegam 2,3...).
-- Cantinho mantém id=1; a produção antiga (upsert id:1) continua funcionando. NÃO dropa o id.
do $$
declare t text;
begin
  foreach t in array array['app_settings','app_menu','app_loyalty'] loop
    execute format('create sequence if not exists %I owned by public.%I.id', t || '_id_seq', t);
    execute format('select setval(%L, (select coalesce(max(id),1) from public.%I))', t || '_id_seq', t);
    execute format('alter table public.%I alter column id set default nextval(%L)', t, t || '_id_seq');
  end loop;
end $$;
