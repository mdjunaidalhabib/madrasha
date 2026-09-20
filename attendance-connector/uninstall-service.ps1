<#
.SYNOPSIS  Removes the Attendance Connector scheduled task and stops the running process.
   Local queue/logs/config are NOT deleted (pending punches stay safe on disk).
   Run from an ELEVATED PowerShell.
#>
[CmdletBinding()]
param([string]$TaskName = 'AttendanceConnector')

$ErrorActionPreference = 'Stop'
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { throw 'Please run this script from an elevated (Administrator) PowerShell.' }

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($task) {
  Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Host "Task '$TaskName' removed." -ForegroundColor Green
} else {
  Write-Host "Task '$TaskName' not found."
}

# make sure no orphaned wrapper/node from this folder keeps running
Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='cmd.exe'" |
  Where-Object { $_.CommandLine -and $_.CommandLine -like "*$root*" -and ($_.CommandLine -like '*dist\cli.js*' -or $_.CommandLine -like '*run.cmd*') } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; Write-Host "Stopped pid $($_.ProcessId)" }
