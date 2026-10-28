$ErrorActionPreference = 'Stop'
try {
    # Wait for the running executable to release its files before the wizard starts.
    Wait-Process -Id ([int]$env:CLAWD_UPDATE_PID) -ErrorAction SilentlyContinue
    $argsForInstaller = @('/UPDATE', '/S')
    if ($env:CLAWD_UPDATE_TARGET_DIR) {
        # NSIS requires /D to be last and unquoted, including paths with spaces.
        $argsForInstaller += ('/D=' + $env:CLAWD_UPDATE_TARGET_DIR)
    }
    $installer = Start-Process -FilePath $env:CLAWD_UPDATE_INSTALLER -ArgumentList $argsForInstaller -PassThru -Wait
    if ($installer.ExitCode -ne 0 -and (Test-Path -LiteralPath $env:CLAWD_UPDATE_OLD_EXE)) {
        Start-Process -FilePath $env:CLAWD_UPDATE_OLD_EXE -ArgumentList '--update-failed'
    }
} catch {
    if (Test-Path -LiteralPath $env:CLAWD_UPDATE_OLD_EXE) {
        Start-Process -FilePath $env:CLAWD_UPDATE_OLD_EXE -ArgumentList '--update-failed'
    }
}
