-- mt-30: liga/desliga o PEDIDO PELO QR DA MESA, por loja.
--
-- Motivo (Medellín, 25/07/2026): o cliente lança o pedido pelo QR e o garçom, sem treinamento,
-- lança o MESMO pedido na comanda → item dobrado. O dono pediu pra desativar o pedido do cliente
-- por enquanto. Fica como recurso do ComandaPRO (todo salão vai querer ligar/desligar isso).
--
-- ADITIVA e retrocompatível: default true = nenhuma loja existente muda de comportamento.
-- Desligar é um UPDATE separado, por loja (ver script reset abaixo / painel de Configurações).

alter table public.store_config
  add column if not exists qr_pedido_enabled boolean not null default true;

comment on column public.store_config.qr_pedido_enabled is
  'Cliente pode PEDIR pelo QR da mesa (/[slug]/mesa/N). Desligado: cardápio vira leitura, /api/mesa-pedido e /api/mesa-chamado respondem 403 e o atendimento é 100% pelo garçom.';
