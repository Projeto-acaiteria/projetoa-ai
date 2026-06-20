# ComandaPRO — Pesquisa de Balança / Venda por Peso (3 agentes · 20/06/2026)

Pra fundamentar a venda POR PESO (marmita / restaurante a quilo / self-service / açaí R$/kg).
ComandaPRO é **web** (roda no navegador) — isso muda tudo na questão da balança.

## Os 3 jeitos de pegar o peso

1. **MANUAL (digitar os gramas)** — atendente lê o peso no visor de QUALQUER balança e digita; o sistema faz peso × R$/kg. Zero hardware, zero driver, zero marca específica. Cobre 80%+ do público (marmitaria de bairro usa balança simples e digita). **É a base.**
2. **AUTOMÁTICO via balança com saída serial (RS232/USB)** — balança "computadorizada" manda o peso pro sistema. Num app WEB isso NÃO é nativo do navegador; precisa de uma ponte local. **E a ponte nós JÁ TEMOS: o QZ Tray** (o mesmo que usamos pra impressão térmica) lê balança Toledo/Mettler nativo, via WebSocket-local, em qualquer navegador. Reuso total de stack.
3. **Código de barras pesável (balança etiquetadora)** — balança pesa e imprime etiqueta com EAN-13 (prefixo "2") que embute peso/preço; o caixa só passa o leitor (que é keyboard-wedge, cai no mesmo campo). Outro fluxo (etiqueta ANTES), só pra quem já tem etiquetadora (R$2k+).

## Achado que decide

- **O mercado inteiro acorrenta venda por peso à serial RS232 + lista de balança homologada** (Saipos, Consumer só homologou a Toledo Prix 3 Fit, GrandChef PRT3, Sischef…). A **dor nº1** é justamente cabo/adaptador/protocolo/marca que não bate — exige técnico, e se comprou a balança errada, não integra.
- **Nenhum concorrente trata entrada MANUAL como caminho de primeira classe** — só como gambiarra. No Reclame Aqui, dono de a-quilo: "só de conseguir editar o preço do prato já resolveria".
- Não existe a-quilo **de verdade 100% web** que leia a balança sem hardware/agente local. Os "online" fingem (painel online, serial no balcão) ou empurram pro código de barras.
- **QZ Tray lê balança** (doc oficial tem exemplo Mettler Toledo: `qz.serial.openPort`, `sendData("W\n")`, callback do peso). Funciona em qualquer navegador — NÃO amarra ao Chrome como a Web Serial (que é só Chrome/Edge desktop, sem mobile).
- Protocolo Toledo (Brasil): `STX(0x02) + 5 dígitos ASCII (2 inteiros + 3 decimais) + ETX(0x03)`, 9600 ou 7E1, manda `ENQ(0x05)`/`W` pra pedir; descartar quadro instável (`IIIII`). Filizola/Urano divergem → perfil por marca.
- **Açaí já tem o motor de peso** (`pricePerKgCents`, modo balança balcão/mesa) validado em produção — é o MESMO cálculo da marmita.

## Recomendação (a estratégia ComandaPRO)

1. **Base universal = MANUAL.** Produto marcado "por peso" (R$/kg) → campo de gramas (lê de qualquer balança) → peso × preço/kg lança na comanda/pedido. Tara configurável por prato. Liga e vende, sem técnico, sem cabo, sem marca. **É o nosso DIFERENCIAL** (web-first, sem travar em hardware) num mercado todo preso à serial.
2. **Automático = QZ Tray (opcional, premium, desktop).** Pra quem tem balança com saída serial: lê sozinho reusando o QZ que já instalamos pra impressão. Protocolo Toledo primeiro. **Sem stack nova.**
3. **Web Serial** = enfeite opcional só-Chrome, nunca base.
4. **Código de barras pesável** = só pra quem já tem etiquetadora; o scanner cai no mesmo campo de peso.
5. **λ.prova-na-fonte no peso:** peso vira dinheiro → gravar e reler o item pesado, não confiar na UI.

**Posicionamento:** "pesa açaí, pesa marmita, pesa self-service — num sistema só, web, sem depender de balança específica." Nenhum concorrente cobre açaí + a-quilo junto, e nenhum é manual-first.

## Roteiro de build

- **V1 (agora, sem hardware):** venda por peso MANUAL no grid/balcão (marmitaria) reusando o motor de peso do açaí + `sells_by_weight` (flag já existe). Tara por produto.
- **V2 (opcional):** leitura automática via QZ Tray (serial Toledo) — botão "ler balança" que puxa o peso.
- **V3 (nicho):** Web Serial (modo sem-QZ no Chrome) / código de barras pesável.

Fontes nos outputs dos agentes: Consumer, Saipos, GrandChef, Sischef, Food Sistemas (integração serial + dores); QZ Tray docs (serial/balança); Chrome/MDN (Web Serial); GS1/EAN-13 (código pesável); protocolo Toledo (Stoq/Brixic); Reclame Aqui (dores reais).
