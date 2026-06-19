# Açaí System — front (v0.1)

Sistema próprio para a açaiteria do Vidal. Fork dedicado do padrão `palace-system`.
Stack: Next.js 16 (App Router) · React 19 · Tailwind 4. Light-only, mobile-first, SVG inline (zero emoji).

## Rodar

```bash
npm install
npm run dev
# abre em http://localhost:3000 (ou 3001 se a 3000 estiver ocupada)
```

## Rotas

| Rota | O que é |
|---|---|
| `/` | Home / escolha (cliente ou gestão) |
| `/cardapio` | **Cardápio digital do cliente** — montagem de açaí (tamanho + acompanhamentos grátis + adicionais pagos) → finaliza no WhatsApp via `wa.me` |
| `/admin` | Painel: resumo do dia, pedidos recentes, mais vendidos |
| `/admin/pedidos` | Painel de pedidos por status (recebido → preparo → saiu → entregue) |
| `/admin/cardapio` | Gestão do cardápio (tamanhos e grupos) |
| `/admin/financeiro` | Entradas, despesas e saldo |
| `/admin/fidelidade` | Programa "compre 10, leve 1" + cartões dos clientes |
| `/admin/clientes` | Base de clientes |

## Estado

Protótipo de **front** com dados de exemplo (`src/lib/mock.ts`). Ainda **sem back**:
não tem Supabase, auth, nem persistência. O próximo passo (pós-validação na call com o
Vidal) é plugar o back herdado do `palace-system` (Supabase + RLS) e trocar mock por dados reais.

A modelagem do cardápio está em `src/lib/menu.ts` (tamanhos + grupos de modificador com
`freeUpTo`/`max` + adicionais pagos) — espelha as tabelas `product_variants` + `modifier_groups`
+ `modifiers` que entram no schema.

Plano completo: `segundo-cerebro/2-PROCESSAMENTO/acaiteria-vidal/ESTUDO-ACAITERIA.md`.
