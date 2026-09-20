@echo off
rem Foreground run for testing (Ctrl+C to stop). Uses config.json in this folder or %CONNECTOR_CONFIG%.
cd /d "%~dp0"
if not exist dist\cli.js (
  echo dist\cli.js not found - running "npm install" and "npm run build" first...
  call npm install
  call npm run build
)
node dist\cli.js run
echo.
echo Connector stopped (exit code %errorlevel%).
pause
