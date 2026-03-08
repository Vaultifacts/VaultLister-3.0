# ============================================================
# VaultLister 3.0 - Automated Full Test + E2E Validation (CI/CD Friendly)
# ============================================================
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/ps/run-full-validation.ps1
# Exit codes: 0 = all pass, 1 = unit/integration failed, 2 = E2E failed

$logFile = "vaultlister_test_run.log"
if (Test-Path $logFile) { Remove-Item $logFile }

Write-Host "=== VaultLister 3.0 Test Run Started ===" -ForegroundColor Cyan
Write-Host "Logging output to $logFile`n"

# Step 1: Stop any running server and free port
Write-Host "[Step 1] Stopping any running dev/test server..."
bun run dev:stop 2>&1 | Tee-Object -FilePath $logFile -Append
bun scripts/kill-port.js 3100 2>&1 | Tee-Object -FilePath $logFile -Append

# Step 2: Reset database (fresh state eliminates legal/DB-state flakiness)
Write-Host "[Step 2] Resetting test database..."
bun run db:init 2>&1 | Tee-Object -FilePath $logFile -Append
bun run db:seed 2>&1 | Tee-Object -FilePath $logFile -Append

# Step 3: Set environment variables (inherited by child processes)
$env:NODE_ENV = "test"
$env:PORT = "3100"
$env:TEST_BASE_URL = "http://localhost:3100"
$env:DISABLE_RATE_LIMIT = "true"

# Step 4: Run full unit + integration test suite
# (npm test calls test:setup internally — server lifecycle is managed automatically)
Write-Host "[Step 4] Running full test suite..."
npm test 2>&1 | Tee-Object -FilePath $logFile -Append

if ($LASTEXITCODE -ne 0) {
    Write-Host "`nERROR: Unit/integration tests failed. See $logFile for details." -ForegroundColor Red
    exit 1
}

# Step 5: Run Playwright E2E tests
# (bun run test:e2e calls test:setup internally — server is restarted cleanly)
Write-Host "[Step 5] Running Playwright E2E tests..."
bun run test:e2e 2>&1 | Tee-Object -FilePath $logFile -Append

if ($LASTEXITCODE -ne 0) {
    Write-Host "`nERROR: Playwright E2E tests failed. See $logFile for details." -ForegroundColor Red
    exit 2
}

# Step 6: Stop test server
Write-Host "[Step 6] Stopping test server..."
bun run dev:stop 2>&1 | Tee-Object -FilePath $logFile -Append

Write-Host "`n=== VaultLister 3.0 Validation Completed Successfully ===" -ForegroundColor Green
Write-Host "Full log available at $logFile"
exit 0
