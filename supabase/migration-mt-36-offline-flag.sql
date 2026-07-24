-- mt-36: flag por-tenant do offline-first (Fatia 2). Default FALSE → nasce DESLIGADO em todas as
-- lojas, inclusive Cantinho/Medellín (nenhuma muda de comportamento). Liga por loja quando o offline
-- for provado: demo → Medellín → Cantinho por último. Ver OFFLINE-FIRST-PLANO.md.
alter table store_config add column if not exists offline_enabled boolean not null default false;
