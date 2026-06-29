# Padrão de Impressão — ComandaPRO (estudo canônico)

> Base de impressão do **produto** (todo cliente do ComandaPRO), não só do Cantinho.
> Síntese de 4 pesquisas paralelas (hardware · layout · fiscal/legal · técnica) — 29/06/2026.
> Ler antes de mexer em `qz.ts` / `ticket.ts` / fluxo de impressão.

---

## TL;DR — decisões cravadas

1. **Padrão-alvo único: 80mm → 72mm imprimível → 576 dots @ 203dpi.** Cobre Epson, Elgin, Bematech, Daruma, Tanca e genéricas (todas imitam Epson). Já é o valor do fix de 29/06 (`size: { width: 72 }`).
2. **Manter HTML rasterizado via QZ Tray** como caminho padrão. É a única abordagem que blinda acento PT-BR em qualquer marca **sem** manter banco de codepage por modelo. É literalmente a arquitetura de Goomer e iFood. **Não migrar, não adicionar fallback ESC/POS cru como regra.**
3. **Comprovante não-fiscal é legal** como peça adicional. A obrigação de emitir nota é **do comerciante**, não do software. Risco da Impulso só existe **com dolo** (função de caixa dois) — que nunca construímos.
4. **Custo do QZ ≈ zero:** LGPL libera uso comercial; silent printing resolve-se com **CA raiz própria** nas máquinas (já temos `override.crt` no instalador) — não precisa pagar os US$ 599/ano.
5. **3 templates da mesma impressora:** cupom de venda (cliente) · via de produção (cozinha/bar, sem preço) · via de delivery (endereço/troco).

---

## 1. Hardware — o padrão-alvo universal

| Parâmetro | Valor-alvo | Por quê |
|---|---|---|
| Largura | **80mm → 72mm útil → 576 dots** | Toda térmica 80mm imprime 72mm pela cabeça; mirar nisso = universal |
| DPI | **203 (8 dots/mm)** | ~100% do parque food service BR; logo/QR rasterizados a **576px** de largura |
| Protocolo | **ESC/POS (emulação Epson)** | Padrão de facto; genéricas imitam Epson |
| Colunas | **48 (Font A) / 64 (Font B)** em 80mm; 32/42 em 58mm | Base de alinhamento de colunas |
| Gaveta | pulso `ESC p` (`\x1B\x70\x00\x19\xFA`) na porta DK (RJ11) | Universal ESC/POS — já implementado (`qzKickDrawer`) |
| Corte | `GS V 0` com feed antes | Guilhotina presente nos modelos de balcão |

**Mercado BR food service:** dominado por **Bematech + Elgin** (mesmo grupo) e **Epson**. Cobrindo esses três + genéricas-Epson, cobre a esmagadora maioria.

**Casos de borda (tratar como exceção opt-in, não inflar agora):**
- **58mm** → perfil de layout separado (48mm / 384 dots / 32 col). **Não escalar** o de 80mm — definir template próprio. Vira toggle "largura do papel" por loja se aparecer cliente quiosque/food truck.
- **Bematech em modo ESC/Bema** → comandos de corte/gaveta diferentes; instruir a configurar a impressora em ESC/POS no setup.
- **Daruma** → dialeto próprio em parte dos comandos.
- **Acento** → **não nos afeta** (rasterizamos; ver §2). É o pesadelo de quem manda texto cru.
- **Gaveta 12V vs 24V** → hardware; entra no checklist de instalação (não casar = queima o solenoide).
- **Impressora sem porta de gaveta / só serrilha** (cozinha barata) → degradar sem assumir que `ESC p`/`GS V` existem.

## 2. Transporte e técnica — por que HTML-raster/QZ está certo

Térmicas **não entendem UTF-8** — usam codepages de 1 byte (CP850/CP860/WPC1252), e o ç/ã/é cai em posição diferente por codepage. Mandar **texto cru** obriga manter um banco de codepage por modelo (ESC/POS vs ESC/Bema vs ESC/Daruma). **Rasterizar** (cupom vira bitmap, a impressora só imprime pixels) elimina isso: acento sai idêntico em qualquer marca. É o trade-off certo pra parque heterogêneo (software house, N marcas).

**Comparação (resumo):**
| | HTML-raster (QZ) | ESC/POS cru | PDF | window.print |
|---|---|---|---|---|
| Acento cross-brand | ✅ pixels | ⚠️ codepage por modelo | ✅ | ✅ |
| Layout (logo/QR) | ✅ | ❌ | ✅ | ⚠️ |
| Corte/gaveta | ✅ (raw junto) | ✅ | ❌ | ❌ |
| Silencioso | ✅ (assinado) | ✅ | depende | ❌ diálogo |
| Velocidade | lenta | rápida | média | média |

**QZ Tray — custo/licença:** software grátis (LGPL, uso comercial ok). Silent printing (sem pop-up "Allow") via **CA raiz própria self-signed** nas máquinas = **custo zero** (já fazemos com `override.crt` no instalador). Cert pago da QZ (US$ 599/ano) só se não quisermos mexer em cert por máquina. White-label (US$ 2.999/ano) não se justifica hoje.

**Ponto de falha conhecido:** o QZ precisa estar **rodando** em cada caixa (é o "INDISPONÍVEL vermelho" do iFood). Mitigação: **ping no WebSocket localhost no front + aviso claro "abra o QZ Tray"**. (Foi exatamente o que confundiu o CIC na auditoria — ele achou que a integração "sumiu" quando era só lazy-load; um indicador de status no front evita isso pro operador real.)

**Alternativa séria** (só se o suporte ao QZ virar gargalo): **PrintNode Integrator** (US$ 60/mês, 20 sub-contas — encaixa no modelo software house). WebUSB **não** serve (quebra no Windows pelo `usbprint.sys`).

## 3. Anatomia dos cupons — 3 templates

Regras gerais: **monoespaçada obrigatória** (Courier); hierarquia por **tamanho/negrito, nunca cor**; TOTAL é o único valor em destaque; separadores de linha cheia; preço **justificado à direita**, 2 casas com vírgula; descrição longa quebra indentada sem repetir preço.

### 3a. Cupom de venda (cliente)
Cabeçalho (centro): logo/nome 2×+negrito · razão social · **CNPJ** · endereço · tel → `COMPROVANTE DE VENDA — NÃO FISCAL` → metadados (pedido, data/hora, atendente, canal) → itens (qtd · desc · unit · total) → subtotal/desconto/taxa → **TOTAL** (destaque) → pagamento + troco → **fidelidade ("+X pts · faltam Y pra…")** → rodapé (agradecimento + redes + QR) + **`NÃO É DOCUMENTO FISCAL`**.
> **Fidelidade impressa é rara no mercado** (nenhum dos 7 líderes faz no cupom) → **diferencial real do ComandaPRO. Manter e destacar.**

### 3b. Via de produção (cozinha/bar)
Estação + nº pedido + mesa/garçom + hora (grande) → itens com **nome GRANDE (2×), qtd proeminente, observações em CAIXA+negrito** ("*** SEM CEBOLA ***") → **SEM preço, sem total, sem pagamento**. Roteada por **estação** (categoria/produto → impressora do setor), com herança item→modificador. **Já construído (T5).**

### 3c. Via de delivery (entregador)
`ENTREGA #nº` → cliente + telefone → **ENDEREÇO completo + ponto de referência (bloco em destaque)** → itens → subtotal + **taxa de entrega** + TOTAL → pagamento + **`*** TROCO PARA R$ X ***`** (calculado, só dinheiro) ou **`JÁ PAGO — não cobrar`** (online) + "Levar maquininha?". Separar visualmente **logística** de **cobrança**.

### Parametrização (padrão de mercado)
Cabeçalho (logo+dados) e mensagem de rodapé **configuráveis pelo lojista**; largura configurável (48/32); vínculo produto→estação→impressora; nº de vias por estação; corte automático + gaveta.

## 4. Fiscal / legal (BR) — o que exibir e declarar

**Obrigatório (CDC — qualquer comprovante):** nome/razão social + **CNPJ** · endereço · descrição + quantidade dos itens · valores unitários e total · data/hora. (Já alinhado com `λ.cupom-padrao`.)

**Boa prática forte:** aviso **`NÃO É DOCUMENTO FISCAL`** em negrito/destaque — não é exigência federal no regime NFC-e, mas blinda contra a confusão punível (entregar não-fiscal no lugar da NFC-e é crime, Lei 8.137/90). Onde a legislação estadual do DAV incidir, vira obrigatório. Não dar ao cupom aparência de fiscal (sem chave/QR fiscal simulado).

**Quem é obrigado a NFC-e:** comerciante com inscrição estadual (maioria de bar/restaurante). **MEI não** é obrigado a emitir ao consumidor PF (até a Reforma, 2027) → MEI só com não-fiscal é legítimo hoje. **2026:** SP (SAT) e CE (MFE) extintos → país converge pra **NFC-e**; NFC-e proibida contra CNPJ (usa NF-e mod. 55).

**Risco da Impulso (fornecedora):** só com **dolo** (software pra ocultar venda — caixa dois, art. 2º V). PDV de gestão honesto não cria risco e **não precisa de homologação** (só o emissor de NFC-e precisa). **Regra dura: nunca construir função de ocultar/apagar venda.** Contrato: responsabilidade fiscal do cliente + disclaimer "não é consultoria fiscal" (não cobre dolo).

**⚠️ Antes de cravar regra fiscal em material de cliente: confirmar o RICMS de MA e TO** (estados dos clientes) — faixas de multa e incidência do DAV variam por estado.

**Roadmap fiscal (módulo opcional, não agora):** integrar **API emissora de NFC-e** (Focus NFe / PlugNotas-Tecnospeed / WebmaniaBR, ~R$60/mês) — manda JSON, eles assinam com o A1 do lojista e transmitem; imprime o DANFE-NFC-e na **mesma térmica 80mm** (não exige impressora fiscal). Pré-requisitos do lojista: certificado **A1**, credenciamento SEFAZ, **CSC**, e NCM/CFOP/CST por item (do contador). Gatilhos pra priorizar: cliente com inscrição estadual; MEI a partir de 2027; venda a CNPJ.

## 5. Action items para o ComandaPRO (priorizado)

| # | Ação | Esforço | Prioridade |
|---|------|---------|-----------|
| 1 | **Largura 72mm** (Achado #2) — feito, confirmar no papel | — | ✅ feito (falta foto) |
| 2 | **Indicador de status do QZ no front** ("Impressora pronta / QZ Tray fechado / Escolha a impressora", com religar) — componente `QzStatus` no Caixa, Balcão e Mesas | baixo | ✅ feito (29/06) |
| 3 | **Rodapé configurável** (mensagem + redes + QR) pelo lojista, além do cabeçalho que já existe | baixo | Média |
| 4 | **Fidelidade no cupom** ("faltam X pts") garantida e destacada — diferencial | baixo | Média |
| 5 | **Via de delivery** completa (endereço+ref destaque, TROCO PARA, JÁ PAGO) — verificar/fechar | médio | Média (quando módulo delivery amadurecer) |
| 6 | **Comprovante de sangria/suprimento** (Achado #1) — toggle por-máquina | baixo | Backlog |
| 7 | **Perfil 58mm** — toggle largura por loja + template próprio | médio | Backlog (sob demanda) |
| 8 | **Módulo fiscal NFC-e** — gate opcional via API emissora | alto | Roadmap (sob demanda + RICMS MA/TO) |

---

## Fontes
Hardware: specs Epson/Elgin/Bematech/Daruma, BZ Tech, Go-Infinity, RP Printer, Goomer (ajuste corte), Epson FAQ gaveta. Layout: mike42.me (ESC/POS), Star Micronics, escpos.readthedocs, Saipos/Goomer/Anota AI/Consumer/iFood (impressão setorizada/delivery). Fiscal: Ajuste SINIEF 19/2016, Lei 8.137/90, Ato COTEPE 14/16, CDC (Lei 8.078/90), CTN, Portaria CAT 147/SRE 79 (SP), Decreto 36.417 (CE), Sebrae, Focus NFe/PlugNotas. Técnica: qz.io/docs (signing/licensing/faq), GitHub QZ Architecture, PrintNode, Star CloudPRNT, Vip.Printer/ACBr (codepage), Goomer/iFood/Saipos/MarketUP/Stone.
