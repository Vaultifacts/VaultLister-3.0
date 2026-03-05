param(
    [switch]$Force
)

. "$PSScriptRoot/../_bootstrap.ps1"
. "$PSScriptRoot/../_state.ps1"
. "$PSScriptRoot/../_helpers.ps1"

$StepName = "PERFORMANCE_EVIDENCE"
$State = Get-RunbookState
$EvidenceRel = "docs/evidence/PERFORMANCE_EVIDENCE.md"
$EvidenceFailRel = "docs/evidence/PERFORMANCE_EVIDENCE_FAIL.md"
$ThresholdPath = Join-Path $RepoRoot "config/gate-thresholds.json"
$StartupPath = Join-Path $RepoRoot "docs/evidence/PHASE-04_STARTUP_SECONDS.txt"
$HealthPath = Join-Path $RepoRoot "docs/evidence/PHASE-04_HEALTH_LATENCY_MS.txt"
$InventoryPath = Join-Path $RepoRoot "docs/evidence/PHASE-04_INVENTORY_LATENCY_MS.txt"
$SearchPath = Join-Path $RepoRoot "docs/evidence/PHASE-04_SEARCH_LATENCY_MS.txt"
$BaselinePath = Join-Path $RepoRoot "docs/PERFORMANCE_BASELINE.md"

try {
    foreach ($p in @($ThresholdPath, $StartupPath, $HealthPath, $InventoryPath, $SearchPath, $BaselinePath)) {
        if (!(Test-Path $p)) { throw "Missing performance artifact: $p" }
    }

    $thresholds = Get-Content -Path $ThresholdPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $startup = [double]((Get-Content -Path $StartupPath -Raw -Encoding UTF8).Trim())
    $health = [double]((Get-Content -Path $HealthPath -Raw -Encoding UTF8).Trim())
    $inventory = [double]((Get-Content -Path $InventoryPath -Raw -Encoding UTF8).Trim())
    $search = [double]((Get-Content -Path $SearchPath -Raw -Encoding UTF8).Trim())

    $sFail = [double]$thresholds.performance.startup_seconds.fail
    $hFail = [double]$thresholds.performance.health_latency_ms.fail
    $iFail = [double]$thresholds.performance.inventory_latency_ms.fail
    $qFail = [double]$thresholds.performance.search_latency_ms.fail

    if ($startup -ge $sFail) { throw "Startup threshold fail: $startup >= $sFail" }
    if ($health -ge $hFail) { throw "Health latency threshold fail: $health >= $hFail" }
    if ($inventory -ge $iFail) { throw "Inventory latency threshold fail: $inventory >= $iFail" }
    if ($search -ge $qFail) { throw "Search latency threshold fail: $search >= $qFail" }

    $content = @"
# PERFORMANCE_EVIDENCE

- Date: $(Get-Date -Format o)
- startup_seconds: $startup (fail >= $sFail)
- health_latency_ms: $health (fail >= $hFail)
- inventory_latency_ms: $inventory (fail >= $iFail)
- search_latency_ms: $search (fail >= $qFail)
- Status: PASS
"@
    Write-Evidence -Path $EvidenceRel -Content $content
    $oldFailPath = Join-Path $RepoRoot $EvidenceFailRel
    if (Test-Path $oldFailPath) { Remove-Item -Path $oldFailPath -Force }
    $State = Mark-Step -State $State -StepName $StepName -Status "PASS" -EvidencePath $EvidenceRel -Meta @{
        startup = $startup
        health = $health
        inventory = $inventory
        search = $search
        force = [bool]$Force
    }
    Update-Dashboard -State $State
}
catch {
    $err = $_.Exception.Message
    $failContent = @"
# PERFORMANCE_EVIDENCE FAIL

- Date: $(Get-Date -Format o)
- Status: FAIL
- Error: $err
"@
    Write-Evidence -Path $EvidenceFailRel -Content $failContent
    $State = Mark-Step -State $State -StepName $StepName -Status "FAIL" -EvidencePath $EvidenceFailRel -Meta @{ error = $err; force = [bool]$Force }
    Update-Dashboard -State $State
    throw
}
