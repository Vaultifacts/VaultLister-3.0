param(
    [switch]$Force
)

. "$PSScriptRoot/../_bootstrap.ps1"
. "$PSScriptRoot/../_state.ps1"
. "$PSScriptRoot/../_helpers.ps1"

$StepName = "MONITORING_EVIDENCE"
$State = Get-RunbookState
$EvidenceRel = "docs/evidence/MONITORING_EVIDENCE.md"
$EvidenceFailRel = "docs/evidence/MONITORING_EVIDENCE_FAIL.md"
$MonitoringPath = Join-Path $RepoRoot "docs/evidence/MONITORING_VALIDATION.md"

try {
    if (!(Test-Path $MonitoringPath)) { throw "Missing monitoring evidence: docs/evidence/MONITORING_VALIDATION.md" }
    $txt = Get-Content -Path $MonitoringPath -Raw -Encoding UTF8
    $required = @("uptime_seconds", "migrations.applied", "PASS")
    foreach ($token in $required) {
        if ($txt -notmatch [regex]::Escape($token)) {
            throw "Monitoring evidence missing token: $token"
        }
    }

    $content = @"
# MONITORING_EVIDENCE

- Date: $(Get-Date -Format o)
- Source file: docs/evidence/MONITORING_VALIDATION.md
- Required tokens: uptime_seconds, migrations.applied, PASS
- Status: PASS
"@
    Write-Evidence -Path $EvidenceRel -Content $content
    $oldFailPath = Join-Path $RepoRoot $EvidenceFailRel
    if (Test-Path $oldFailPath) { Remove-Item -Path $oldFailPath -Force }
    $State = Mark-Step -State $State -StepName $StepName -Status "PASS" -EvidencePath $EvidenceRel -Meta @{ force = [bool]$Force }
    Update-Dashboard -State $State
}
catch {
    $err = $_.Exception.Message
    $failContent = @"
# MONITORING_EVIDENCE FAIL

- Date: $(Get-Date -Format o)
- Status: FAIL
- Error: $err
"@
    Write-Evidence -Path $EvidenceFailRel -Content $failContent
    $State = Mark-Step -State $State -StepName $StepName -Status "FAIL" -EvidencePath $EvidenceFailRel -Meta @{ error = $err; force = [bool]$Force }
    Update-Dashboard -State $State
    throw
}
