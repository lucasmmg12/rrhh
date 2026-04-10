@echo off
title RRHH Sync Server - Sanatorio Argentino
echo.
echo ╔══════════════════════════════════════════════╗
echo ║  Iniciando RRHH Sync Server...              ║
echo ║  Puerto: 3457                               ║
echo ║  Ctrl+C para detener                        ║
echo ╚══════════════════════════════════════════════╝
echo.
cd /d "%~dp0sync-server"
node index.js
pause
