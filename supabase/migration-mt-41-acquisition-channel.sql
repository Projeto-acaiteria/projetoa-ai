-- mt-41 · Canal de aquisição no cadastro (23/09/2026).
-- "Como você descobriu o ComandaPRO?" — opcional, respondido pelo dono no cadastro.
-- Mesmo campo e mesmos valores do AgendaPRO (businesses.acquisition_channel, v67), menos o
-- "salao99_migrante" que é de salão. No AgendaPRO foi esse campo que revelou o ChatGPT como o
-- canal que mais traz cliente — aqui serve pra medir se o trabalho de AEO/SEO do site dá resultado.
--
-- Só acréscimo: coluna nula, lojas existentes ficam NULL (não sabemos o canal delas).

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS acquisition_channel text;

ALTER TABLE public.stores
  DROP CONSTRAINT IF EXISTS stores_acquisition_channel_check;

ALTER TABLE public.stores
  ADD CONSTRAINT stores_acquisition_channel_check
  CHECK (acquisition_channel IS NULL OR acquisition_channel IN
    ('indicacao', 'google', 'instagram', 'tiktok', 'chatgpt_ia', 'whatsapp_organico', 'outro'));
