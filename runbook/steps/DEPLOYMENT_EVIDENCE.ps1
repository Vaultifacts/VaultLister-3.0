param(
    [switch]$Force
)

. "$PSScriptRoot/../_bootstrap.ps1"
. "$PSScriptRoot/../_state.ps1"
. "$PSScriptRoot/../_helpers.ps1"

$StepName = "DEPLOYMENT_EVIDENCE"
$State = Get-RunbookState
$EvidenceRel = "docs/evidence/DEPLOYMENT_EVIDENCE.md"
$EvidenceFailRel = "docs/evidence/DEPLOYMENT_EVIDENCE_FAIL.md"
$DeployPath = Join-Path $RepoRoot "docs/evidence/DEPLOYMENT_VALIDATION.md"
$HealthPath = Join-Path $RepoRoot "docs/evidence/PHASE-04_DOCKER_HEALTH_STATUS.txt"

try {
    if (!(Test-Path $DeployPath)) { throw "Missing deployment validation evidence: docs/evidence/DEPLOYMENT_VALIDATION.md" }
    if (!(Test-Path $HealthPath)) { throw "Missing deployment health status evidence: docs/evidence/PHASE-04_DOCKER_HEALTH_STATUS.txt" }
    $status = (Get-Content -Path $HealthPath -Raw -Encoding UTF8).Trim()
    if ($status -ne "healthy") { throw "Container health status is '$status' (expected 'healthy')" }
    $txt = Get-Content -Path $DeployPath -Raw -Encoding UTF8
    if ($txt -notmatch "PASS") { throw "Deployment validation file does not indicate PASS" }

    $content = @"
# DEPLOYMENT_EVIDENCE

- Date: $(Get-Date -Format o)
- Source file: docs/evidence/DEPLOYMENT_VALIDATION.md
- Health status file: docs/evidence/PHASE-04_DOCKER_HEALTH_STATUS.txt
- Health status value: $status
- Status: PASS
"@
    Write-Evidence -Path $EvidenceRel -Content $content
    $oldFailPath = Join-Path $RepoRoot $EvidenceFailRel
    if (Test-Path $oldFailPath) { Remove-Item -Path $oldFailPath -Force }
    $State = Mark-Step -State $State -StepName $StepName -Status "PASS" -EvidencePath $EvidenceRel -Meta @{ health = $status; force = [bool]$Force }
    Update-Dashboard -State $State
}
catch {
    $err = $_.Exception.Message
    $failContent = @"
# DEPLOYMENT_EVIDENCE FAIL

- Date: $(Get-Date -Format o)
- Status: FAIL
- Error: $err
"@
    Write-Evidence -Path $EvidenceFailRel -Content $failContent
    $State = Mark-Step -State $State -StepName $StepName -Status "FAIL" -EvidencePath $EvidenceFailRel -Meta @{ error = $err; force = [bool]$Force }
    Update-Dashboard -State $State
    throw
}
