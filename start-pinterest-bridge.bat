@echo off
cd /d "%~dp0"
set PINTEREST_HEADLESS=1

echo Iniciando Pinterest Bridge en segundo plano...
start /min "" wscript.exe "%~dp0run-bridge.vbs"
echo.
echo  Pinterest Bridge activo en http://127.0.0.1:8787
echo  Corre completamente oculto y se reinicia solo si falla.
echo.
echo  Para detenerlo: usa http://127.0.0.1:8787/shutdown
echo  o ejecuta: stop-bridge.bat
echo.
echo  Si la sesion expira, ejecuta: start-pinterest-login.bat
