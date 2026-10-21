$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
    & cargo build --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc --release --locked
    if ($LASTEXITCODE -ne 0) { throw 'Cargo build failed; see the error above.' }
    $dist = Join-Path $projectRoot 'dist'
    $version = (Get-Content 'src-tauri/tauri.conf.json' -Raw | ConvertFrom-Json).version
    $package = Join-Path $dist "Bongo-Clawd-$version-Windows-x64"
    New-Item -ItemType Directory -Force $package | Out-Null
    Copy-Item 'src-tauri/target/x86_64-pc-windows-msvc/release/bongo-clawd-lite.exe' (Join-Path $package 'Bongo-Clawd.exe') -Force
    foreach ($name in @('README-FIRST.txt', 'COMPARISON.md', 'VALIDATION.md', 'THIRD-PARTY-NOTICES.md', 'LICENSE-CODE.txt', 'VALIDATION-RESULTS.json')) {
        Copy-Item $name $package -Force
    }
    Copy-Item 'rust-licenses' $package -Recurse -Force
    $exe = Join-Path $package 'Bongo-Clawd.exe'
    $hash = (Get-FileHash $exe -Algorithm SHA256).Hash.ToLowerInvariant()
    "$hash  Bongo-Clawd.exe" | Set-Content (Join-Path $package 'SHA256SUMS.txt') -Encoding ascii
    $items = Get-ChildItem $package -File -Recurse
    $metrics = [ordered]@{
        version = $version
        exe_bytes = (Get-Item $exe).Length
        portable_files_bytes_before_metrics = ($items | Measure-Object Length -Sum).Sum
        runtime_bundled = $false
        runtime = 'System Microsoft Edge WebView2'
        windows_runtime_tested = $false
        build = 'Windows local rebuild; run the validation steps on this machine'
    }
    $metrics | ConvertTo-Json | Set-Content (Join-Path $package 'package-metrics.json') -Encoding UTF8
    $zip = Join-Path $dist "Bongo-Clawd-$version-Windows-x64.zip"
    Compress-Archive -Path $package -DestinationPath $zip -Force
    Write-Host "Ready: $zip"
} finally { Pop-Location }
