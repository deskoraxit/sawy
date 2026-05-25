@echo off
cd /d "%~dp0"
echo Cerrando puente oculto si esta activo...
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8787/shutdown | Out-Null } catch {}"
taskkill /f /im wscript.exe 2>nul
timeout /t 2 /nobreak >nul
echo Abriendo Pinterest en modo visible para iniciar sesion...
set PINTEREST_HEADLESS=0
start "SAWY Pinterest Login" node scripts\pinterest-bridge.js
timeout /t 3 /nobreak >nul
start http://127.0.0.1:8787/login
echo Cuando termines el login, cierra la ventana de Chrome/Edge (la negra) y ejecuta start-pinterest-bridge.bat.
