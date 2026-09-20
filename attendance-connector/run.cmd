@echo off
rem Wrapper used by the Windows Task Scheduler task: restarts the connector if it ever exits.
rem The connector itself writes rotating logs to logs\connector.log; only crash traces land in logs\stderr.log.
setlocal
cd /d "%~dp0"
if not exist logs mkdir logs
set "NODE=node"
if exist node-path.txt set /p NODE=<node-path.txt

:loop
echo [%date% %time%] starting connector>> logs\wrapper.log
"%NODE%" dist\cli.js run >nul 2>> logs\stderr.log
echo [%date% %time%] connector exited with code %errorlevel%, restarting in 10s>> logs\wrapper.log
rem ping is used as a sleep because "timeout" fails when there is no console (SYSTEM account)
ping -n 11 127.0.0.1 >nul
goto loop
