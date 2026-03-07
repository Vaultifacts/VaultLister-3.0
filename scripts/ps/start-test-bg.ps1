Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Push-Location $repoRoot
try {
    $env:NODE_ENV = "test"
    $env:DISABLE_RATE_LIMIT = "true"
    $env:PORT = "3100"
    bun scripts/server-manager.js start
}
finally {
    Pop-Location
}
