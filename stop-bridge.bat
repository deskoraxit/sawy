@echo off
cd /d "%~dp0"
echo Deteniendo Pinterest Bridge...
powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8787/shutdown | Out-Null } catch {}"
taskkill /f /im wscript.exe /t 2>nul
taskkill /f /im node.exe /fi "WindowTitle eq SAWY*" 2>nul
echo Bridge detenido.
timeout /t 2 /nobreak >nul
