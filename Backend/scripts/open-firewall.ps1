<#
.SYNOPSIS
  Allow phones on your LAN/Wi-Fi to reach the Tailor Management System backend.

.DESCRIPTION
  Windows Firewall blocks inbound port 5000 by default, which is why the app
  can load its bundle from Metro (port 8081 was allowed when Expo asked) yet
  every API call fails with ERR_NETWORK. This script creates the matching
  inbound rule for the TMS backend port.

.USAGE
  From the Backend folder:   npm run firewall
  Or from an Admin PowerShell:
     powershell -NoProfile -ExecutionPolicy Bypass -File scripts\open-firewall.ps1 -Port 5000

  It is safe to re-run: the rule is recreated instead of duplicated.
#>

param(
    [int]$Port = 5000
)

$ErrorActionPreference = 'Stop'
$ruleName = "TMS Backend (TCP $Port)"

function Test-Admin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    return (New-Object Security.Principal.WindowsPrincipal $id).IsInRole(
        [Security.Principal.WindowsBuiltInRole]::Administrator)
}

Write-Host ""
Write-Host "=== TMS firewall check (port $Port) ===" -ForegroundColor Cyan

# 1) What network are we actually on? A 'Public' profile is the usual reason a
#    phone on the same Wi-Fi cannot reach the PC.
try {
    Get-NetConnectionProfile | ForEach-Object {
        $color = if ($_.NetworkCategory -eq 'Public') { 'Yellow' } else { 'Green' }
        Write-Host ("  Network '{0}' -> {1}" -f $_.Name, $_.NetworkCategory) -ForegroundColor $color
    }
} catch {
    Write-Host "  (could not read network profiles)" -ForegroundColor DarkGray
}

# 2) Is anything listening on the port at all?
$listener = $null
try {
    $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
} catch { }
if ($listener) {
    ($listener | Select-Object -First 1 | ForEach-Object {
        Write-Host ("  Listening on {0}:{1} (process id {2})" -f $_.LocalAddress, $_.LocalPort, $_.OwningProcess) -ForegroundColor Green
    })
} else {
    Write-Host "  Nothing is listening on port $Port right now." -ForegroundColor Yellow
    Write-Host "  Start the backend first:  cd Backend; npm start" -ForegroundColor Yellow
}

if (-not (Test-Admin)) {
    Write-Host ""
    Write-Host "  Not running as Administrator - no rule was created." -ForegroundColor Yellow
    Write-Host "  Re-run this from an elevated PowerShell:" -ForegroundColor Yellow
    Write-Host "     npm run firewall" -ForegroundColor White
    Write-Host "     (Start menu -> PowerShell -> Right-click -> Run as administrator)" -ForegroundColor DarkGray
    Write-Host ""
    exit 1
}

# 3) Create/refresh the inbound rule, scoped to node.exe and this port only.
$nodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $nodePath) { $nodePath = $null }

if (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue) {
    Remove-NetFirewallRule -DisplayName $ruleName | Out-Null
}

$params = @{
    DisplayName      = $ruleName
    Description      = 'Inbound TCP rule so the TMS mobile app on the LAN can reach the Node backend.'
    Direction        = 'Inbound'
    Action           = 'Allow'
    Protocol         = 'TCP'
    LocalPort        = $Port
    Profile          = 'Any'
    Program          = if ($nodePath) { $nodePath } else { 'C:\Program Files\nodejs\node.exe' }
    EdgeTraversal    = 'Enable'
}
New-NetFirewallRule @params | Out-Null

Write-Host ""
Write-Host "  Created inbound rule '$ruleName' for $nodePath" -ForegroundColor Green
Write-Host ""
Write-Host "  Next: verify from the PC   ->  npm run lan" -ForegroundColor Cyan
Write-Host "        verify from the phone ->  open http://<PC-IP>:$Port/health in the browser" -ForegroundColor Cyan
Write-Host ""
