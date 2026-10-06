@echo off
rem Wrapper used by the Windows Task Scheduler task: restarts the connector if it ever exits.
rem The connector itself writes rotating logs to logs\connector.log; only crash traces land in logs\stderr.log.
rem Packaged install (installer / release): connector.exe next to this file is used, Node.js is NOT needed.
rem Source install: falls back to "node dist\cli.js run" (node path from node-path.txt, written by install-service.ps1).
setlocal
cd /d "%~dp0"
if not exist logs mkdir logs

set "USE_EXE="
if exist "%~dp0connector.exe" set "USE_EXE=1"

set "NODE=node"
if not defined USE_EXE if exist node-path.txt set /p NODE=<node-path.txt

:loop
echo [%date% %time%] starting connector>> logs\wrapper.log
if defined USE_EXE (
  "%~dp0connector.exe" run >nul 2>> logs\stderr.log
) else (
  "%NODE%" dist\cli.js run >nul 2>> logs\stderr.log
)
echo [%date% %time%] connector exited with code %errorlevel%, restarting in 10s>> logs\wrapper.log
rem ping is used as a sleep because "timeout" fails when there is no console (SYSTEM account)
ping -n 11 127.0.0.1 >nul
goto loop
