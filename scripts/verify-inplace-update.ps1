$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$fixtureRoot = Join-Path $env:RUNNER_TEMP 'clawd-inplace-install-check'
$payload = Join-Path $fixtureRoot 'payload'
$target = Join-Path $fixtureRoot 'Original install with spaces'
$uninstallKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\BongoClawd'
$menu = Join-Path ([Environment]::GetFolderPath('Programs')) 'Bongo Clawd'
$desktopLink = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Bongo Clawd.lnk'
if ((Test-Path $uninstallKey) -or (Test-Path $menu) -or (Test-Path $desktopLink)) {
    throw 'The isolated runner already contains a Clawd installation; refuse to overwrite it.'
}
New-Item -ItemType Directory -Force $payload, $target | Out-Null
# A harmless short-lived native executable stands in for the pet in this installer test.
Copy-Item "$env:SystemRoot\System32\where.exe" (Join-Path $payload 'Bongo-Clawd.exe')
'Installer verification fixture' | Set-Content (Join-Path $payload 'README-FIRST.txt')
'previous executable' | Set-Content (Join-Path $target 'Bongo-Clawd.exe')
'keep this file' | Set-Content (Join-Path $target 'user-marker.txt')
$version = '0.4.0-install-check'
& "$PSScriptRoot/build-installer.ps1" -PackageDirectory $payload -Version $version -MakeNSIS "${env:ProgramFiles(x86)}/NSIS/makensis.exe"
$env:CLAWD_UPDATE_TARGET_DIR = $target
$env:CLAWD_UPDATE_OLD_EXE = Join-Path $target 'Bongo-Clawd.exe'
try {
    $installer = Join-Path $projectRoot "dist/Bongo-Clawd-$version-Windows-x64-Setup.exe"
    # Use only /UPDATE, exactly as the already-shipped Beta does; no /S or /D rescue.
    $process = Start-Process $installer -ArgumentList '/UPDATE' -PassThru
    if (-not $process.WaitForExit(30000)) {
        $process.Kill()
        throw 'Update installer waited for a wizard page instead of updating silently.'
    }
    $process.Refresh()
    if ($process.ExitCode -ne 0) { throw "Update installer failed: $($process.ExitCode)" }
    if ((Get-FileHash (Join-Path $target 'Bongo-Clawd.exe')).Hash -ne (Get-FileHash (Join-Path $payload 'Bongo-Clawd.exe')).Hash) {
        throw 'Updated executable was not written into the original folder.'
    }
    if ((Get-Content (Join-Path $target 'user-marker.txt')) -ne 'keep this file') { throw 'An unrelated existing file changed.' }
    if ((Get-ItemProperty $uninstallKey).InstallLocation -ne $target) { throw 'Installer recorded the wrong location.' }
    if (Test-Path $desktopLink) { throw 'Update created a previously absent desktop shortcut.' }
    Write-Host 'Old-client /UPDATE: no prompts, original folder with spaces, exact payload hash, unrelated file and desktop preference preserved.'
} finally {
    Remove-Item Env:CLAWD_UPDATE_TARGET_DIR, Env:CLAWD_UPDATE_OLD_EXE -ErrorAction SilentlyContinue
    Remove-Item $uninstallKey -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item $menu -Recurse -Force -ErrorAction SilentlyContinue
}
