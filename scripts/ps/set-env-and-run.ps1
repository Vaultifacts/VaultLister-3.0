param(
    [Parameter(Mandatory = $true)]
    [string[]]$EnvVars,

    [Parameter(Mandatory = $true)]
    [string]$Command
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Push-Location $repoRoot
try {
    foreach ($pair in $EnvVars) {
        if ([string]::IsNullOrWhiteSpace($pair) -or -not $pair.Contains("=")) {
            throw "Invalid env var format '$pair'. Expected KEY=VALUE."
        }

        $parts = $pair.Split("=", 2)
        $key = $parts[0].Trim()
        $value = $parts[1]

        if ([string]::IsNullOrWhiteSpace($key)) {
            throw "Invalid env var key in '$pair'."
        }

        Set-Item -Path ("Env:{0}" -f $key) -Value $value
    }

    & cmd.exe /d /s /c "`"$Command`""
    $code = $LASTEXITCODE
    if ($null -eq $code) {
        $code = 0
    }
    exit $code
}
finally {
    Pop-Location
}
