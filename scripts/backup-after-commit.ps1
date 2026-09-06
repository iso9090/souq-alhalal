$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$backupRoot = 'F:\SouqAlhalal-Backups'

try {
    if (-not (Test-Path -LiteralPath 'F:\' -PathType Container)) {
        throw 'Backup drive F: is unavailable.'
    }
    [System.IO.Directory]::CreateDirectory($backupRoot) | Out-Null
    $stamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss-fff'
    $uniqueId = [Guid]::NewGuid().ToString('N')
    $destination = Join-Path $backupRoot "souq-alhalal_${stamp}_${uniqueId}"
    # A new directory per invocation: never synchronize over an older backup.
    New-Item -ItemType Directory -Path $destination -ErrorAction Stop | Out-Null

    # /XJ avoids following junctions outside the project or into recursive trees.
    & robocopy.exe $projectRoot $destination /E /XD .git node_modules /XJ /R:2 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
    $copyExitCode = $LASTEXITCODE
    if ($copyExitCode -ge 8) {
        throw "Robocopy failed with exit code $copyExitCode. Partial backup retained at: $destination"
    }
    Write-Output "Backup created: $destination"
    exit 0
} catch {
    [Console]::Error.WriteLine("Backup failed: $($_.Exception.Message)")
    exit 1
}
