$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Find-RepoRoot {
    param(
        [string]$StartPath = (Get-Location).Path
    )

    $current = Resolve-Path $StartPath
    while ($true) {
        $pkg = Join-Path $current "package.json"
        if (Test-Path $pkg) {
            return $current
        }

        $parent = Split-Path -Parent $current
        if ([string]::IsNullOrWhiteSpace($parent) -or $parent -eq $current) {
            break
        }
        $current = $parent
    }

    throw "Runbook aborted: package.json not found. Not in repo root."
}

$RepoRoot = Find-RepoRoot
Set-Location $RepoRoot

if (!(Test-Path (Join-Path $RepoRoot "package.json"))) {
    throw "Runbook aborted: package.json not found. Not in repo root."
}

$EvidenceDir = Join-Path $RepoRoot "docs/evidence"
if (!(Test-Path $EvidenceDir)) {
    New-Item -ItemType Directory -Force -Path $EvidenceDir | Out-Null
}

$HAS_NODE = [bool](Get-Command node -ErrorAction SilentlyContinue)
$HAS_NPX = [bool](Get-Command npx.cmd -ErrorAction SilentlyContinue)

if (!$HAS_NODE) { throw "Node.js is required but not installed." }
if (!$HAS_NPX) { throw "npx is required but not installed." }

$script:RepoRoot = $RepoRoot
$global:RepoRoot = $RepoRoot

Write-Host "RepoRoot: $RepoRoot"
node --version
npx.cmd --version
