@echo off
title ComandaPRO - Instalador de impressao
echo.
echo  ===========================================
echo   ComandaPRO - Instalador de impressao
echo   (QZ Tray + certificado da Impulso)
echo  ===========================================
echo.
echo  Vai pedir permissao de ADMINISTRADOR. Confirme.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0comandapro-impressao.ps1"
