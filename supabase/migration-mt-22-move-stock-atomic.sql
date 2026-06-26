-- mt-22: baixa de estoque ATÔMICA. Antes, moveStock era read-modify-write num blob JSON →
-- vendas simultâneas do mesmo insumo perdiam decremento (estoque derivava p/ cima) e o history
-- perdia lançamentos. Esta função faz tudo em UMA statement (upsert): aplica o delta sobre o
-- valor SEMPRE fresco (lock de linha no ON CONFLICT DO UPDATE), nunca perde concorrência.
-- p_base = item-semente (usado só se a row ainda não existe no banco; estado seed).

create or replace function move_stock(
  p_store_id uuid,
  p_id text,
  p_type text,      -- 'entrada' | 'saida'
  p_qty numeric,
  p_reason text,
  p_at text,
  p_base jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delta numeric := case when p_type = 'entrada' then abs(p_qty) else -abs(p_qty) end;
  v_entry jsonb := jsonb_build_array(jsonb_build_object('type', p_type, 'qty', abs(p_qty), 'reason', p_reason, 'at', p_at));
  v_data jsonb;
begin
  insert into stock_items (store_id, id, data)
  values (
    p_store_id, p_id,
    jsonb_set(
      jsonb_set(
        jsonb_set(p_base, '{qty}', to_jsonb(round(greatest(0, (p_base->>'qty')::numeric + v_delta), 3))),
        '{updatedAt}', to_jsonb(p_at)),
      '{history}', v_entry || coalesce(p_base->'history', '[]'::jsonb))
  )
  on conflict (store_id, id) do update
  set data = jsonb_set(
    jsonb_set(
      jsonb_set(stock_items.data, '{qty}', to_jsonb(round(greatest(0, (stock_items.data->>'qty')::numeric + v_delta), 3))),
      '{updatedAt}', to_jsonb(p_at)),
    '{history}', v_entry || coalesce(stock_items.data->'history', '[]'::jsonb))
  returning data into v_data;
  return v_data;
end;
$$;
