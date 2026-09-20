<#
.SYNOPSIS
  Installs the Attendance Connector as a Windows Task Scheduler task that starts at boot and restarts on failure.

.DESCRIPTION
  * Runs run.cmd (a restart-loop wrapper) at system startup, before anyone logs in.
  * Default identity: SYSTEM. The device key must then be protected in LocalMachine scope
    (this is what "connector setup" does by default) or supplied via a machine-wide DEVICE_KEY variable.
  * Use -Credential to run as a specific Windows user instead (needed if you ran "connector setup --user-scope").
  * No third-party service wrapper needed. NSSM alternative is described in README.md.

  Run from an ELEVATED PowerShell:
      powershell -ExecutionPolicy Bypass -File .\install-service.ps1
#>
[CmdletBinding()]
param(
  [string]$TaskName = 'AttendanceConnector',
  [System.Management.Automation.PSCredential]$Credential
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { throw 'Please run this script from an elevated (Administrator) PowerShell.' }

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { throw 'node.exe not found in PATH. Install Node.js 18+ (LTS) first.' }
if (-not (Test-Path (Join-Path $root 'dist\cli.js'))) { throw 'dist\cli.js missing. Run: npm install ; npm run build' }
$cfg = if ($env:CONNECTOR_CONFIG) { $env:CONNECTOR_CONFIG } else { Join-Path $root 'config.json' }
if (-not (Test-Path $cfg)) { throw "Config not found: $cfg . Run: node dist\cli.js setup" }

# remember the absolute node.exe path: SYSTEM often has a different PATH
Set-Content -Path (Join-Path $root 'node-path.txt') -Value $node -Encoding ASCII

$action    = New-ScheduledTaskAction -Execute (Join-Path $root 'run.cmd') -WorkingDirectory $root
$trigger   = New-ScheduledTaskTrigger -AtStartup
$settings  = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
  -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew

if ($Credential) {
  $plain = $Credential.GetNetworkCredential().Password
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
    -User $Credential.UserName -Password $plain -RunLevel Highest -Force | Out-Null
  $plain = $null
  $who = $Credential.UserName
} else {
  $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
  $who = 'SYSTEM'
}

Start-ScheduledTask -TaskName $TaskName
Write-Host "Task '$TaskName' installed (runs as $who, at startup, auto-restart)." -ForegroundColor Green
Write-Host "  status : schtasks /Query /TN $TaskName /V /FO LIST"
Write-Host "  logs   : $(Join-Path $root 'logs\connector.log')"
Write-Host "  stop   : schtasks /End /TN $TaskName      start: schtasks /Run /TN $TaskName"
Write-Host "  queue  : node dist\cli.js status"
