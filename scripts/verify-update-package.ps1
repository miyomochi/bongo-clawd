$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$version = (Get-Content (Join-Path $projectRoot 'src-tauri/tauri.conf.json') | ConvertFrom-Json).version
$entry = "Bongo-Clawd-$version-Windows-x64-Setup.exe"
$env:CLAWD_UPDATE_ZIP = Join-Path $projectRoot "dist/Bongo-Clawd-$version-Windows-x64-Setup.zip"
$env:CLAWD_UPDATE_ENTRY = $entry
$reviewDirectory = Join-Path $projectRoot 'dist/update-package-check'
New-Item -ItemType Directory -Force $reviewDirectory | Out-Null
$env:CLAWD_UPDATE_INSTALLER = Join-Path $reviewDirectory $entry
$scriptText = Get-Content -Raw -Encoding UTF8 (Join-Path $projectRoot 'src-tauri/src/update-extract.ps1')
$windowsPowerShell = Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'
& $windowsPowerShell -NoProfile -NonInteractive -Command $scriptText
if ($LASTEXITCODE -ne 0) { throw 'Runtime extraction failed' }
$original = (Get-FileHash (Join-Path $projectRoot "dist/$entry") -Algorithm SHA256).Hash
$extracted = (Get-FileHash $env:CLAWD_UPDATE_INSTALLER -Algorithm SHA256).Hash
if ($original -ne $extracted) { throw 'Extracted installer differs from the built installer' }
$env:CLAWD_UPDATE_ENTRY = 'not-the-known-installer.exe'
& $windowsPowerShell -NoProfile -NonInteractive -Command $scriptText
if ($LASTEXITCODE -eq 0) { throw 'Unknown installer entry was unexpectedly accepted' }
$global:LASTEXITCODE = 0
Write-Host 'Windows PowerShell runtime: exact installer extraction matches SHA256; unknown entry rejected.'
