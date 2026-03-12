Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$serverScript = Join-Path $repoRoot "src\backend\server.js"
$logFile = Join-Path $repoRoot "logs\test-server.log"
$pidFile = Join-Path $repoRoot "logs\test-server.pid"
$healthUrl = "http://localhost:3100/api/health"

Push-Location $repoRoot
try {
    # If a test server is already alive on 3100, reuse it
    try {
        $resp = Invoke-WebRequest -Uri $healthUrl -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        if ($resp.StatusCode -eq 200) {
            Write-Host "Server already running on http://localhost:3100"
            return
        }
    } catch {}

    # Kill any stale test-server PID
    if (Test-Path $pidFile) {
        $oldPid = [int](Get-Content $pidFile -ErrorAction SilentlyContinue)
        if ($oldPid -gt 0) {
            try { Stop-Process -Id $oldPid -Force -ErrorAction SilentlyContinue } catch {}
        }
        Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    }

    # Start bun server directly (bypasses server-manager PID conflict with prod server)
    $env:NODE_ENV = "test"
    $env:DISABLE_RATE_LIMIT = "true"
    $env:DISABLE_CSRF = "true"
    $env:PORT = "3100"

    $errFile = Join-Path $repoRoot "logs\test-server-err.log"
    $proc = Start-Process -FilePath "bun" -ArgumentList @("`"$serverScript`"") `
        -RedirectStandardOutput $logFile -RedirectStandardError $errFile `
        -PassThru -WindowStyle Hidden -WorkingDirectory $repoRoot

    $proc.Id | Set-Content $pidFile
    Write-Host "Server starting in background (PID $($proc.Id))..."

    # Poll health endpoint
    $attempts = 0
    $maxAttempts = 15
    while ($attempts -lt $maxAttempts) {
        Start-Sleep -Seconds 1
        try {
            $resp = Invoke-WebRequest -Uri $healthUrl -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
            if ($resp.StatusCode -eq 200) {
                Write-Host "Server is running on http://localhost:3100"
                $data = $resp.Content | ConvertFrom-Json
                Write-Host "Health: OK - database $($data.database.status)"
                Write-Host "Logs: $logFile"
                return
            }
        } catch {}
        $attempts++
    }

    Write-Host "Server may still be starting. Check logs: $logFile"
} finally {
    Pop-Location
}
