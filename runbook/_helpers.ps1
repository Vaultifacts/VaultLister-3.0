$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
. "$PSScriptRoot/_checklist.ps1"

function Write-Evidence {
    param(
        [string]$Path,
        [string]$Content
    )
    $fullPath = Join-Path $RepoRoot $Path
    $dir = Split-Path -Parent $fullPath
    if (!(Test-Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    Set-Content -Path $fullPath -Value $Content -Encoding UTF8
}

function Update-Dashboard {
    param(
        [hashtable]$State
    )

    $dashboardPath = Join-Path $RepoRoot "docs/evidence/RUNBOOK_DASHBOARD.md"
    $lines = @()
    $lines += "# Runbook Dashboard"
    $lines += ""
    $lines += "| Step | Status | Timestamp | Evidence |"
    $lines += "|---|---|---|---|"

    foreach ($name in ($State["steps"].Keys | Sort-Object)) {
        $step = $State["steps"][$name]
        $status = $step["status"]
        $timestamp = $step["timestamp"]
        $evidence = $step["evidence"]
        $lines += "| $name | $status | $timestamp | [$evidence]($evidence) |"
    }

    if ($State["steps"].Count -eq 0) {
        $lines += "| _none_ | _none_ | _none_ | _none_ |"
    }

    Set-Content -Path $dashboardPath -Value ($lines -join "`n") -Encoding UTF8
}
