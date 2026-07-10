@echo off
title ComandaPRO - Instalar impressao
echo.
echo   ============================================
echo    ComandaPRO - Instalar impressao (1 clique)
echo   ============================================
echo.
echo   Vai pedir permissao de ADMINISTRADOR. Clique SIM.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $p = Join-Path $env:TEMP 'comandapro-impressao.ps1'; Invoke-WebRequest -Uri 'https://comandapro.net.br/comandapro-impressao.ps1' -OutFile $p -UseBasicParsing; & $p } catch { Write-Host ('Erro: ' + $_.Exception.Message) -ForegroundColor Red; Read-Host 'Pressione ENTER para fechar' }"
