# Aprendizado — Ichiban Sushi (engenharia reversa) → modelo combinado/pizza

> Estudo de um cardápio de sushi real validado (unidade1.ichibansushi.com.br, Palmas-TO).
> Plataforma = **ExpressoDelivery** (SaaS PHP white-label, NÃO Goomer/Anota AI). Loja abre só 18-23h
> e injeta o catálogo via AJAX com sessão — não deu pra pegar preços reais, mas deu pra **descompilar
> o modelo de dados** (montadores.js), que vale mais.

## A SACADA-MÃE (reusável em vários nichos)
O preço de um grupo de escolha tem um **`tipo_calculo` enum: MAIOR | MÉDIA | SOMA**. Uma flag resolve:
- **Pizza meio-a-meio** → grupo "Sabores", escolhe até 2, `price_mode = MAIOR` (paga o sabor mais caro)
- **Açaí / adicionais** → `price_mode = SOMA` (cada add soma)
- **Sushi combo** → preço fixo por contagem de sabor no tamanho (ver abaixo)
→ No ComandaPRO isso é só **um campo `price_mode` no `menu_modifier_groups`**, reaproveitando o motor de
modificadores que já temos. NÃO precisa de sistema separado pra pizza.

## Modelo de combinado (sushi) — pra quando construir o modelo sushi
Combinado = item montável: **tamanho (20/30/40 peças) + sabores (até N) + preço por regra**.
- `sabor_preco` é **POR TAMANHO** (o mesmo rolinho custa diferente em combo de 20 vs 40)
- `preco_fixo_N_sabores` por tamanho — cobre "combo 30 peças R$Y" independente dos sabores (caminho mais comum)
- `qtd_sabor` por tamanho = limite de sabores
- sabores agrupados por sub-categoria dentro do modal (`sabor_categorianome`) quando há muitos
- adicionais com +/- , remoção ("sem cream cheese"), observações com/sem preço, preço AO VIVO na montagem

## UI/UX (o que replicar e evitar)
- **Replicar:** tema escuro grafite + foto grande; modal full-screen de montagem; preço ao vivo;
  sabores agrupados; mostrar cardápio SEMPRE (read-only fora do horário, com aviso) pra não matar SEO.
- **Evitar:** desktop como iframe do mobile (trava largura — nosso tri-modal já resolve);
  catálogo sumir quando fecha; delivery-first SEM mesa/QR (mesa/QR é NOSSO diferencial — manter eixo).

## Aplicação imediata: PIZZA MEIO-A-MEIO
Estender o motor de modificadores com `price_mode` (sum|highest|average). Pizza = produto base +
grupo "Sabores" (min 1, max 2, price_mode=highest), cada sabor com o preço da pizza inteira daquele
sabor. Meio-a-meio = escolhe 2 → paga o maior. Mesma engine de KDS/cupom/comanda já pronta.
