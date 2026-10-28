param(
    [Parameter(Mandatory=$true)][string]$PackageDirectory,
    [string]$Version = '0.4.0-beta',
    [string]$MakeNSIS = 'makensis.exe'
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$payload = (Resolve-Path $PackageDirectory).Path
if (-not (Test-Path (Join-Path $payload 'Bongo-Clawd.exe'))) {
    throw 'PackageDirectory must contain Bongo-Clawd.exe and its bundled license files.'
}
$dist = Join-Path $projectRoot 'dist'
New-Item -ItemType Directory -Force $dist | Out-Null
$output = Join-Path $dist "Bongo-Clawd-$Version-Windows-x64-Setup.exe"
$icon = Join-Path $projectRoot 'src-tauri/icons/icon.ico'
$script = Join-Path $PSScriptRoot 'installer/bongo-clawd.nsi'
& $MakeNSIS "/INPUTCHARSET" "UTF8" "/DVERSION=$Version" "/DPAYLOAD=$payload" "/DICON=$icon" "/DOUTPUT=$output" $script
if ($LASTEXITCODE -ne 0) { throw 'NSIS compilation failed.' }
Write-Host "Ready: $output"
