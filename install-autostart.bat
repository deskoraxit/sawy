@echo off
cd /d "%~dp0"
set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set SHORTCUT_PATH=%STARTUP_DIR%\SAWY Pinterest Bridge.lnk
set SCRIPT_PATH=%~dp0start-pinterest-bridge.bat

echo ============================================
echo Instalando SAWY Pinterest Bridge como auto-inicio...
echo ============================================

REM Crear el acceso directo en inicio con PowerShell
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  $WScriptShell = New-Object -ComObject WScript.Shell; ^
  $Shortcut = $WScriptShell.CreateShortcut('%SHORTCUT_PATH%'); ^
  $Shortcut.TargetPath = '%SCRIPT_PATH%'; ^
  $Shortcut.WorkingDirectory = '%~dp0'; ^
  $Shortcut.WindowStyle = 7; ^
  $Shortcut.Description = 'SAWY Pinterest Bridge (inicio automatico)'; ^
  $Shortcut.Save();

if exist "%SHORTCUT_PATH%" (
  echo ✓ Acceso directo creado en Inicio:
  echo   %SHORTCUT_PATH%
  echo.
  echo El bridge de Pinterest se iniciara automaticamente
  echo cada vez que inicies sesion en Windows.
  echo.
  echo Para desactivarlo: elimina ese acceso directo.
) else (
  echo ✗ Error al crear el acceso directo.
  echo Intenta ejecutar como Administrador.
)

echo.
pause
