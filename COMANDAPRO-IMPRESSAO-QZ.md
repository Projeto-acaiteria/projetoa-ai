# ComandaPRO — Impressão térmica (QZ Tray) EM ESCALA

> Pro Verbo do ComandaPRO. Aprendizado da instalação do Medellín (23-24/06).
> O QZ funciona, mas **se a instalação for manual em todo cliente, vira liability.** Aqui é como tornar viável.

## O que aconteceu no Medellín (o diagnóstico)
Popup "site quer acessar/imprimir" não sumia. Verificado: **o código está 100% certo** —
assinatura via `/api/qz-sign` + `setCertificatePromise` + o par certificado↔chave **casa** + cert na Vercel.
O popup era SÓ porque o **PC do bar não tinha o `override.crt`** (o certificado confiável).
Certificado auto-assinado → QZ pede "Allow" até confiar nesse cert na máquina.
**Conclusão: o problema NUNCA é o código — é o trust do cert no PC.**

## A base que já resolve 80%: UM cert pra tudo (cert-mãe Impulso)
- Usar SEMPRE o **cert-mãe da Impulso** (`medellin-bar-keys/digital-certificate.txt` + `private-key.pem`), **NÃO gerar par por cliente.**
- Assim o `override.crt` é o **MESMO arquivo em todo PC**. Máquina que já rodou um sistema Impulso já confia → imprime sem reconfigurar.
- **O furo de escala:** cliente NOVO (PC que nunca rodou Impulso) precisa do `override.crt` instalado uma vez. Esse é o único passo manual — e é o que travou o Medellín.

## Como tornar VIÁVEL em escala (3 jogadas)
1. **Instalador de 1 clique (PRIORIDADE).** Um script (PowerShell `.ps1` / `.bat` / `.exe`) que:
   (a) instala o QZ Tray silencioso [build **x86_64**], (b) joga o `override.crt` (cert-mãe) em `C:\Program Files\QZ Tray\`, (c) configura auto-start.
   → Onboarding vira **"baixa e roda o instalador da ComandaPRO"** — zero mexer em Program Files na mão.
   **Construir UMA vez = todo cliente novo resolve em 1 clique.** É o que tira o QZ de liability.
2. **Bar de 1 impressora NÃO precisa de QZ.** Chrome com flag **`--kiosk-printing`** + impressora como padrão → `window.print()` imprime **silencioso, sem QZ, sem cert, sem popup**. QZ só é necessário pra **rotear** (cozinha ≠ balcão). Um atalho na área de trabalho abrindo o Chrome em kiosk-printing resolve esses clientes. (O sistema já tem fallback `window.print`/iframe.)
3. **Checklist de go-live** com as 3 pegadinhas, pra ninguém travar de novo.

## Fix manual (enquanto o instalador não existe)
Criar `C:\Program Files\QZ Tray\override.crt` com o cert-mãe → **reiniciar o QZ** (bandeja → Exit → reabrir) → silencioso. (Site Manager do QZ é alternativa GUI. "Lembrar + Allow" no popup é band-aid.)

## As 3 pegadinhas (toda instalação)
1. Porta da impressora costuma vir **TMUSB001** (não COM1) — `Set-Printer -PortName "TMUSB001"`, deixar padrão.
2. Baixar o QZ **x86_64** (não arm64).
3. **`override.crt`** com o cert-mãe — o que mata o popup.

## TODO do produto (ComandaPRO)
- [x] **Instalador de 1 clique** — `installer/comandapro-impressao.ps1` + `INSTALAR-IMPRESSAO.bat` (auto-eleva → QZ x86_64 silencioso → override.crt cert-mãe → auto-start → porta TMUSB001). ⏳ **falta TESTE no PC real (DELL c/ impressora)** — prova-na-fonte de hardware.
- [x] Atalho **Chrome `--kiosk-printing`** — passo 6 (opcional) do instalador.
- [x] Checklist de go-live — `installer/CHECKLIST-IMPRESSAO.md` (as 3 pegadinhas).
- [x] **Empacotado + publicado p/ download** — `public/ComandaPRO-Impressao.zip` no ar em https://comandapro.net.br/ComandaPRO-Impressao.zip (cert do `.ps1` == `override.crt` byte-a-byte).

## Como instalar (cliente novo) — DISTRIBUIÇÃO PUBLICADA (07/07)
Cliente baixa **https://comandapro.net.br/ComandaPRO-Impressao.zip** (servido de `public/ComandaPRO-Impressao.zip`; provado no ar HTTP 200) → extrai → **duplo-clique em `INSTALAR-IMPRESSAO.bat`** → confirma "Administrador" → abre o sistema e imprime um teste. (Pendrive com a pasta `installer/` = mesmo efeito.) Passo a passo + troubleshooting em `installer/CHECKLIST-IMPRESSAO.md`.
**Se re-empacotar o installer:** `Compress-Archive` dos 3 arquivos de `installer/` → `public/ComandaPRO-Impressao.zip`, commit + push na `main` (auto-deploya pra comandapro.net.br). Conferir na fonte que a URL responde 200 antes de mandar pro cliente.
Notas técnicas: o `.ps1` é UTF-8 **com BOM** (PS 5.1 lê acento sem quebrar); o cert embutido = `QZ_CERT` de `src/lib/qz-cert.ts` (verificado byte-a-byte idêntico); um cert pra TODOS os clientes (não gera par por cliente).

Ref completa (arquitetura, cupom 72mm, conexão-por-aba, par-tem-que-casar): memória `reference_impressao_termica_qz_tray`.
