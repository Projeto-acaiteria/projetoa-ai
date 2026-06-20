# ComandaPRO — Checklist de Go-Live (20/06/2026)

Estado: produto multi-tenant **funcional e blindado** (segurança auditada). Deploy de teste no ar
em `projetoa-ai-six.vercel.app` (login + cadastro carregando, sem erro). Loja nova nasce **limpa**
(0 produtos/pedidos, config/trial próprios) e o cardápio público vazio não quebra — provado.

## ✅ Já pronto (código)
- Multi-tenant isolado (RLS + filtros store_id + gate de auth nas APIs admin) — auditado
- 3 cardápios (açaí/bar/grid), modificadores, pizza meio-a-meio, sushi
- Delivery 100% (toggle, checkout, taxa fixa/zona, rastreio por código, cupom, WhatsApp 2 lados, trava de horário, alerta sonoro)
- Venda por peso (marmita) + tela de Balcão do operador (+ leitura QZ Tray)
- Onboarding wizard público, identidade visual por loja, CMV, estoque/inventário
- Billing Asaas (gate, checkout PIX, webhook, cron) — código provado
- Título/preview do cardápio por loja (compartilhar link mostra o nome da loja)

## 🔴 Depende de VOCÊ (Eduardo) — bloqueadores de lançamento real
1. **Registrar o webhook do Asaas no painel** — URL `https://<dominio>/api/webhooks/asaas`, header `asaas-access-token` = o valor de `ASAAS_WEBHOOK_TOKEN`. Sem isso o pagamento confirma mas o sistema não libera a assinatura. (Conta Asaas é a MESMA do AgendaPRO — registrar como webhook ADICIONAL.)
2. **Domínio próprio** — apontar o domínio do ComandaPRO pra Vercel (hoje é `projetoa-ai-six.vercel.app`). Sem domínio dá pra lançar, mas o link do cliente fica feio.
3. **Anti-flood (recomendado antes de divulgar o cadastro)** — criar conta Upstash (grátis) e me passar as chaves → eu ligo rate-limit nas rotas públicas (pedido/cadastro) + CAPTCHA leve no cadastro. O cadastro público hoje não tem limite.
4. **Primeiro cliente real** — definir QUEM (recomendo o açaí do Vidal, 100% pronto): logo PNG + fotos dos produtos + cardápio real + preços + WhatsApp. Eu monto a loja com esses dados.

## 🟢 Posso fazer sozinho (quando você der ok)
- **Provisionar a loja real limpa** (via cadastro/admin) com os dados que você passar
- **Cadastrar o cardápio real** (categorias/produtos/preços/fotos) da loja
- **Configurar** identidade visual (logo/cor/banner), horário, taxas, delivery, fidelidade
- **Smoke test em produção** do fluxo completo (pedido → painel → cupom → status)
- Polimentos P2 da auditoria (preview de taxa antes de escolher bairro)

## Ordem sugerida
1. Você escolhe o 1º cliente (Vidal?) e junta logo+fotos+cardápio+preços.
2. Eu provisiono a loja + cadastro o cardápio + configuro tudo.
3. Você registra o webhook Asaas + (opcional) aponta o domínio + Upstash.
4. Smoke test em produção comigo.
5. Entrega pro cliente + acompanhar primeiro uso real.

> Tese (memória [[softwarehouse]]): o gargalo agora é VENDA/ENTREGA do 1º cliente, não mais feature. Lançar valida o produto e começa o MRR.
