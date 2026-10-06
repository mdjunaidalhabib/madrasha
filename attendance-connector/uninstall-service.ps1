<#
.SYNOPSIS  Removes the Attendance Connector scheduled task and stops the running process.
   Local queue/logs/config are NOT deleted (pending punches stay safe on disk).
   Run from an ELEVATED PowerShell. Never prompts (safe for the uninstaller); -Quiet reduces output.
   Exit code 0 = success, 1 = failure.
#>
[CmdletBinding()]
param(
  [string]$TaskName = 'AttendanceConnector',
  [switch]$Quiet
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Say([string]$msg, [string]$color = 'Gray') {
  if (-not $Quiet) { Write-Host $msg -ForegroundColor $color }
}

try {
  $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  if (-not $isAdmin) { throw 'Please run this script from an elevated (Administrator) PowerShell.' }

  $root = Split-Path -Parent $MyInvocation.MyCommand.Path
  $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  if ($task) {
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Say "Task '$TaskName' removed." 'Green'
  } else {
    Say "Task '$TaskName' not found."
  }

  # make sure no orphaned wrapper / node / connector.exe from this folder keeps running.
  # cmd.exe (run.cmd loop) first so it cannot restart the connector in between.
  $procs = @(Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='cmd.exe' OR Name='connector.exe'")
  $mine = $procs | Where-Object {
    ($_.Name -eq 'connector.exe' -and $_.ExecutablePath -and $_.ExecutablePath -like "$root\*") -or
    ($_.CommandLine -and $_.CommandLine -like "*$root*" -and (
      $_.CommandLine -like '*dist\cli.js*' -or $_.CommandLine -like '*run.cmd*' -or $_.CommandLine -like '*connector.exe*'))
  } | Sort-Object { if ($_.Name -eq 'cmd.exe') { 0 } else { 1 } }
  foreach ($p in $mine) {
    Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
    Say "Stopped $($p.Name) pid $($p.ProcessId)"
  }
  exit 0
} catch {
  [Console]::Error.WriteLine("uninstall-service.ps1 failed: $($_.Exception.Message)")
  exit 1
}
