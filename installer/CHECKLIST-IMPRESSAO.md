# Checklist go-live de impressão — ComandaPRO (QZ Tray)

> Objetivo: imprimir **sem popup** no PC do cliente, em 1 passo. O instalador resolve 90%; este checklist cobre as 3 pegadinhas e o que conferir.

## Caminho rápido (90% dos casos)
1. Cliente baixa o zip: **https://comandapro.net.br/ComandaPRO-Impressao.zip** (ou pendrive com a pasta `installer/`). Extrai a pasta.
2. **Duplo-clique em `INSTALAR-IMPRESSAO.bat`** → confirme o "Administrador".
3. O instalador: baixa+instala o QZ Tray (x86_64), joga o `override.crt` (cert-mãe), liga auto-start, reinicia o QZ e tenta ajustar a impressora.
4. No fim, abra o sistema no Chrome e **imprima um teste**. Não deve aparecer popup do QZ.

## As 3 pegadinhas (o que trava se errar)
1. **`override.crt`** — é o que mata o popup. Tem que estar em `C:\Program Files\QZ Tray\override.crt` (o instalador põe). Cert auto-assinado sem isso = QZ pede "Allow" pra sempre.
2. **QZ x86_64, não arm64** — o instalador baixa o `.exe` x86_64 do GitHub. Em PC ARM, baixe o build certo manual.
3. **Porta da impressora = `TMUSB001`** (não COM1). O instalador ajusta se detectar a térmica; senão, manual (abaixo).

## Conferência manual (se algo não bateu)
- **override.crt existe?** `dir "C:\Program Files\QZ Tray\override.crt"`. Se não, rode o instalador de novo (ou crie o arquivo com o cert-mãe e reinicie o QZ pela bandeja → Exit → reabrir).
- **Impressora na porta certa + padrão?**
  ```powershell
  Get-Printer | Format-Table Name, PortName, Default
  Set-Printer -Name "<NOME DA IMPRESSORA>" -PortName "TMUSB001"
  (New-Object -ComObject WScript.Network).SetDefaultPrinter("<NOME DA IMPRESSORA>")
  ```
- **QZ rodando?** Ícone na bandeja (perto do relógio). Se não, abra `C:\Program Files\QZ Tray\qz-tray.exe`.
- **Ainda aparece popup?** Confirme o `override.crt` e reinicie o QZ (bandeja → Exit → reabrir) pra ele recarregar o cert.

## Bar de 1 impressora (sem QZ — alternativa)
Não precisa de QZ se a loja tem 1 impressora só e não roteia cozinha/bar:
- O instalador pode criar um atalho do **Chrome `--kiosk-printing`** (responda a URL no passo 6).
- Com a impressora como **padrão do Windows**, o `window.print()` do sistema imprime **silencioso, sem QZ, sem cert, sem popup**.
- QZ só é necessário pra **rotear por estação** (cozinha ≠ bar).

## Roteamento por estação (bar/restaurante com 2+ impressoras)
- Precisa do QZ (o atalho kiosk não roteia).
- Configure 1 impressora por destino em **`/admin/impressora`** (caixa / cozinha / bar).
- Teste: lance um item de cozinha + um de bar → cada via sai na impressora certa.

## Status
- [x] Instalador 1 clique construído (`installer/comandapro-impressao.ps1` + `.bat`).
- [x] Checklist com as 3 pegadinhas.
- [x] Cert do `.ps1` == `override.crt` byte-a-byte (confere com a chave-mãe Impulso).
- [x] **Empacotado e publicado** → `public/ComandaPRO-Impressao.zip` no ar em https://comandapro.net.br/ComandaPRO-Impressao.zip (HTTP 200, provado 07/07).
- [ ] **TESTADO em PC real (DELL c/ impressora) → imprime SEM popup** ← prova-na-fonte pendente (hardware; só o campo fecha).
