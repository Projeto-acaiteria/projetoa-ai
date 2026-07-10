# ComandaPRO - Instalador de impressao (QZ Tray + cert-mae Impulso). "1 clique".
# Roda elevado (auto-relanca como admin). Idempotente: pode rodar de novo sem quebrar.
# Objetivo: matar o popup do QZ instalando o override.crt (cert-mae) de uma vez por PC.
#requires -version 5
$ErrorActionPreference = "Stop"

# --- 0. elevacao: se nao for admin, relanca como admin e sai ---
$id = [Security.Principal.WindowsIdentity]::GetCurrent()
$isAdmin = ([Security.Principal.WindowsPrincipal]$id).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
  $relaunchArgs = '-NoProfile -ExecutionPolicy Bypass -File "' + $PSCommandPath + '"'
  Start-Process powershell.exe -ArgumentList $relaunchArgs -Verb RunAs
  exit
}

Write-Host ""
Write-Host "=== ComandaPRO - Instalador de impressao (QZ Tray) ===" -ForegroundColor Cyan
Write-Host ""

# --- cert-mae da Impulso (PUBLICO) = override.crt. O MESMO em todo cliente. ---
$QZ_CERT = @'
-----BEGIN CERTIFICATE-----
MIIDaTCCAlGgAwIBAgIUb1ob2DJr/wVoorYv4QBMTYO6QxwwDQYJKoZIhvcNAQEL
BQAwRDEbMBkGA1UEAwwSTWVkZWxsaW4gTXVzaWMgQmFyMRgwFgYDVQQKDA9JbXB1
bHNvIERpZ2l0YWwxCzAJBgNVBAYTAkJSMB4XDTI2MDYxNTE4MzMyMVoXDTM2MDYx
MjE4MzMyMVowRDEbMBkGA1UEAwwSTWVkZWxsaW4gTXVzaWMgQmFyMRgwFgYDVQQK
DA9JbXB1bHNvIERpZ2l0YWwxCzAJBgNVBAYTAkJSMIIBIjANBgkqhkiG9w0BAQEF
AAOCAQ8AMIIBCgKCAQEAsSk05zdFtba5t7TRQpmImTxRTRICW+lTuNX3a3nMqYVY
qRC/U1KzHkdE0fN2rPY9uM453UmaAxz34Is8pK20BtVeyxJrMBxGHqnVLTmltwQt
sz7ZpXBwvw1lW0a3VL2QT20vbG/gHeap9ODwAIAfFm3LZKch/TWSCi5HLe5ceuoP
v3BEDd1lEMwBMVXtllcEtqcw+ub/7vBnc5oDyTMvJlJJkt38u5z50E4jKVIFusn4
DgpH/ShOZPES4IyFEh2SsxPikE5uQKhy0/gkYR1o3GbhPJy3Ov+RaqwBzqpW/t1S
58eZp/fDvlJomHcLy/ACbhsr6JppgOLt7cth0CBy7QIDAQABo1MwUTAdBgNVHQ4E
FgQUWNLKlJ20x2V7byxslFCrtoSK85swHwYDVR0jBBgwFoAUWNLKlJ20x2V7byxs
lFCrtoSK85swDwYDVR0TAQH/BAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEAlI3E
5tZMl+ZD1YiK1/M4beJGR+wQgcnlFALjVyiZBIa6XQFB2/vwK9Y+J0Iq7mh5WHOy
dGz8gzgiDFBebAYJQRK5ZSJUkYeKeXGJDSwuTECD5worIaRrGmpwFXjITSXG9Dn8
LeuI1SrtZJjLnDZce0u6PYIdroLMO6wmdETU01ZcF/EGnsE8ecCnSqATnx2aFSEa
ZVzJ4yFcsTNXXImgHBT+DDUf93IhaJ9VWfQULHYgoTpHBUPga2weRSfvVNbqKjCb
B8T0ZVvtr3REQL9+rF4O3P8ExJdpzFD1mldi7oKUPA0eypbYIP/PR66OyFZ2cVvY
nMmseAC0fUGOVV5HeA==
-----END CERTIFICATE-----
'@

$qzDir = "C:\Program Files\QZ Tray"
$qzExe = Join-Path $qzDir "qz-tray.exe"

# --- 1. QZ Tray instalado? senao, baixa o release mais recente (x86_64) e instala silencioso ---
if (Test-Path $qzExe) {
  Write-Host "[1/6] QZ Tray ja instalado." -ForegroundColor Green
} else {
  Write-Host "[1/6] Baixando QZ Tray (x86_64) do GitHub..." -ForegroundColor Yellow
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $rel = Invoke-RestMethod "https://api.github.com/repos/qzind/tray/releases/latest" -Headers @{ "User-Agent" = "ComandaPRO" }
  $asset = $rel.assets | Where-Object { $_.name -match '^qz-tray-.*\.exe$' -and $_.name -notmatch 'arm' } | Select-Object -First 1
  if (-not $asset) { throw "Nao achei o instalador .exe x86_64 do QZ Tray nos releases. Baixe manual: github.com/qzind/tray/releases" }
  $dl = Join-Path $env:TEMP $asset.name
  Invoke-WebRequest $asset.browser_download_url -OutFile $dl -UseBasicParsing
  Write-Host "      Instalando ($($asset.name)) silencioso..." -ForegroundColor Yellow
  Start-Process $dl "-q" -Wait   # install4j: -q = unattended
  if (-not (Test-Path $qzExe)) { throw "QZ Tray nao apareceu em $qzDir apos instalar." }
  Write-Host "      QZ Tray instalado." -ForegroundColor Green
}

# --- 2. override.crt (cert-mae) = o que MATA o popup ---
if (-not (Test-Path $qzDir)) { New-Item -ItemType Directory -Path $qzDir -Force | Out-Null }
$override = Join-Path $qzDir "override.crt"
# ASCII sem BOM (PEM puro) — BOM quebra o parse do cert
[IO.File]::WriteAllText($override, ($QZ_CERT -replace "`r`n", "`n"), (New-Object Text.UTF8Encoding $false))
Write-Host "[2/6] override.crt instalado (cert-mae Impulso)." -ForegroundColor Green

# --- 3. auto-start com o Windows (belt-and-suspenders alem do que o QZ ja cria) ---
Set-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" -Name "QZ Tray" -Value ('"' + $qzExe + '"') -Force
Write-Host "[3/6] Auto-start configurado." -ForegroundColor Green

# --- 4. reinicia o QZ pra carregar o override.crt. O QZ roda como javaw.exe da pasta do QZ
#        (o Stop-Process por nome "qz-tray" nao pegava = popup continuava). Mata pelo ExecutablePath. ---
Get-CimInstance Win32_Process | Where-Object { ($_.Name -eq 'javaw.exe' -or $_.Name -eq 'qz-tray.exe') -and $_.ExecutablePath -like '*QZ Tray*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2
Start-Process $qzExe
Write-Host "[4/6] QZ Tray reiniciado (carregou o cert)." -ForegroundColor Green

# --- 5. impressora termica: porta TMUSB001 + padrao (best-effort; se nao achar, ver checklist) ---
$thermal = Get-Printer -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'EPSON|TM-|TM_|POS|80mm|Thermal|Termica|Generic / Text' } | Select-Object -First 1
if ($thermal) {
  try {
    if (Get-PrinterPort -Name "TMUSB001" -ErrorAction SilentlyContinue) { Set-Printer -Name $thermal.Name -PortName "TMUSB001" }
    (New-Object -ComObject WScript.Network).SetDefaultPrinter($thermal.Name)
    Write-Host "[5/6] Impressora '$($thermal.Name)' -> porta/padrao ajustados." -ForegroundColor Green
  } catch { Write-Host "[5/6] Achei a impressora mas nao ajustei automatico — ver checklist." -ForegroundColor Yellow }
} else {
  Write-Host "[5/6] Impressora termica nao detectada automatico — configure manual (ver CHECKLIST)." -ForegroundColor Yellow
}

# --- 6. (opcional) atalho Chrome --kiosk-printing (bar de 1 impressora, sem QZ) ---
Write-Host ""
# Modo 1-clique: nao pergunta nada. O atalho Chrome kiosk e opcional (o QZ ja imprime silencioso).
$url = ""
if ($url) {
  $chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
  if (-not (Test-Path $chrome)) { $chrome = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" }
  if (Test-Path $chrome) {
    $lnk = Join-Path ([Environment]::GetFolderPath("Desktop")) "ComandaPRO (impressao).lnk"
    $sc = (New-Object -ComObject WScript.Shell).CreateShortcut($lnk)
    $sc.TargetPath = $chrome
    $sc.Arguments = "--kiosk-printing --app=$url"
    $sc.Save()
    Write-Host "      Atalho criado na area de trabalho (Chrome kiosk-printing)." -ForegroundColor Green
  } else { Write-Host "      Chrome nao encontrado — pule ou instale o Chrome." -ForegroundColor Yellow }
}

Write-Host ""
Write-Host "=== PRONTO ===" -ForegroundColor Cyan
Write-Host "Abra o sistema no Chrome e imprima um TESTE. NAO deve aparecer popup do QZ." -ForegroundColor White
Write-Host "Se aparecer popup: confirme que C:\Program Files\QZ Tray\override.crt existe e reinicie o QZ pela bandeja." -ForegroundColor Gray
Write-Host ""
Read-Host "Enter pra fechar"
