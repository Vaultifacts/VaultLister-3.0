param(
    [string]$TestArgs = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Push-Location $repoRoot
try {
    # Set test environment variables directly — avoids [string[]] parsing issues
    # when this script is invoked via npm (cmd.exe) with comma-separated arg lists.
    $env:NODE_ENV = "test"
    $env:TEST_BASE_URL = "http://localhost:3100"
    $env:PORT = "3100"

    if ($TestArgs) {
        & bun test $TestArgs.Split(" ", [System.StringSplitOptions]::RemoveEmptyEntries)
    } else {
        & bun test
    }

    $code = $LASTEXITCODE
    if ($null -eq $code) { $code = 0 }
    exit $code
}
finally {
    Pop-Location
}
