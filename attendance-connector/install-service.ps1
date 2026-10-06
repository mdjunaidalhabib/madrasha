<#
.SYNOPSIS
  Installs the Attendance Connector as a Windows Task Scheduler task that starts at boot and restarts on failure.

.DESCRIPTION
  * Runs run.cmd (a restart-loop wrapper) at system startup, before anyone logs in.
  * Two layouts are supported:
      - Packaged: connector.exe next to this script (installer / GitHub release). Node.js is NOT required.
      - Source:   node.exe in PATH + dist\cli.js (npm install ; npm run build).
    connector.exe wins if both are present.
  * Default identity: SYSTEM. The device key must then be protected in LocalMachine scope
    (this is what "connector setup" does by default) or supplied via a machine-wide DEVICE_KEY variable.
  * Use -Credential to run as a specific Windows user instead (needed if you ran "connector setup --user-scope").
  * The secrets\ folder is locked down to SYSTEM + Administrators (+ the -Credential user). A LocalMachine-scope
    DPAPI blob can be decrypted by ANY local account, so the file ACL is what keeps normal users away from the key.
  * Never prompts: safe to call from an installer. -Quiet only reduces console output.
    Exit code 0 = success, 1 = failure (message on stderr).
  * No third-party service wrapper needed. NSSM alternative is described in README.md.

  Run from an ELEVATED PowerShell:
      powershell -ExecutionPolicy Bypass -File .\install-service.ps1
      powershell -ExecutionPolicy Bypass -File .\install-service.ps1 -Quiet      # from an installer
#>
[CmdletBinding()]
param(
  [string]$TaskName = 'AttendanceConnector',
  [System.Management.Automation.PSCredential]$Credential,
  [switch]$Quiet,
  # do not start the task right away (it will still start at the next boot)
  [switch]$NoStart
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

function Say([string]$msg, [string]$color = 'Gray') {
  if (-not $Quiet) { Write-Host $msg -ForegroundColor $color }
}

try {
  $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  if (-not $isAdmin) { throw 'Please run this script from an elevated (Administrator) PowerShell.' }

  $exe = Join-Path $root 'connector.exe'
  $packaged = Test-Path -LiteralPath $exe
  if ($packaged) {
    $cliHint = 'connector.exe'
  } else {
    $node = (Get-Command node -ErrorAction SilentlyContinue).Source
    if (-not $node) { throw 'Neither connector.exe nor node.exe found. Use the installer/release build, or install Node.js 18+ (LTS).' }
    if (-not (Test-Path (Join-Path $root 'dist\cli.js'))) { throw 'dist\cli.js missing. Run: npm install ; npm run build' }
    $cliHint = 'node dist\cli.js'
    # remember the absolute node.exe path: SYSTEM often has a different PATH
    Set-Content -Path (Join-Path $root 'node-path.txt') -Value $node -Encoding ASCII
  }

  $cfg = if ($env:CONNECTOR_CONFIG) { $env:CONNECTOR_CONFIG } else { Join-Path $root 'config.json' }
  if (-not (Test-Path $cfg)) { throw "Config not found: $cfg . Run: $cliHint setup" }

  # Restrict secrets\ (device key) to SYSTEM + Administrators (+ task user). SIDs keep it language-independent.
  $secrets = Join-Path $root 'secrets'
  if (Test-Path -LiteralPath $secrets) {
    $grants = @('*S-1-5-18:(OI)(CI)F', '*S-1-5-32-544:(OI)(CI)F')
    if ($Credential) { $grants += ('{0}:(OI)(CI)R' -f $Credential.UserName) }
    $icaclsArgs = @($secrets, '/inheritance:r', '/grant:r') + $grants + @('/T', '/C', '/Q')
    & icacls.exe @icaclsArgs | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Warning "Could not restrict permissions on $secrets (icacls exit $LASTEXITCODE)." }
  }

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

  if (-not $NoStart) { Start-ScheduledTask -TaskName $TaskName }

  Say "Task '$TaskName' installed (runs as $who, at startup, auto-restart, using $cliHint)." 'Green'
  Say "  status : schtasks /Query /TN $TaskName /V /FO LIST"
  Say "  logs   : $(Join-Path $root 'logs\connector.log')"
  Say "  stop   : schtasks /End /TN $TaskName      start: schtasks /Run /TN $TaskName"
  Say "  queue  : $cliHint status"
  exit 0
} catch {
  [Console]::Error.WriteLine("install-service.ps1 failed: $($_.Exception.Message)")
  exit 1
}
