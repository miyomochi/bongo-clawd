$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($env:CLAWD_UPDATE_ZIP)
try {
    $entry = $archive.GetEntry($env:CLAWD_UPDATE_ENTRY)
    if ($null -eq $entry -or $entry.Length -gt 67108864 -or $entry.Length -lt 1024) {
        throw 'The verified package does not contain the expected installer.'
    }
    # Extract exactly one known entry to one chosen path, never archive paths.
    [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $env:CLAWD_UPDATE_INSTALLER, $true)
} finally { $archive.Dispose() }
