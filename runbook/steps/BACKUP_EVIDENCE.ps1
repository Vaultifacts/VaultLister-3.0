param(
    [switch]$Force
)

. "$PSScriptRoot/../_bootstrap.ps1"
. "$PSScriptRoot/../_state.ps1"
. "$PSScriptRoot/../_helpers.ps1"

$StepName = "BACKUP_EVIDENCE"
$State = Get-RunbookState
$EvidenceRel = "docs/evidence/BACKUP_EVIDENCE.md"
$EvidenceFailRel = "docs/evidence/BACKUP_EVIDENCE_FAIL.md"
$BackupPath = Join-Path $RepoRoot "docs/evidence/BACKUP_DRILL.md"

try {
    if (!(Test-Path $BackupPath)) { throw "Missing backup drill evidence: docs/evidence/BACKUP_DRILL.md" }
    $txt = Get-Content -Path $BackupPath -Raw -Encoding UTF8
    $required = @("backup", "restore")
    foreach ($token in $required) {
        if ($txt -notmatch $token) {
            throw "Backup drill evidence missing keyword: $token"
        }
    }

    $content = @"
# BACKUP_EVIDENCE

- Date: $(Get-Date -Format o)
- Source file: docs/evidence/BACKUP_DRILL.md
- Required keywords: backup, restore
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
# BACKUP_EVIDENCE FAIL

- Date: $(Get-Date -Format o)
- Status: FAIL
- Error: $err
"@
    Write-Evidence -Path $EvidenceFailRel -Content $failContent
    $State = Mark-Step -State $State -StepName $StepName -Status "FAIL" -EvidencePath $EvidenceFailRel -Meta @{ error = $err; force = [bool]$Force }
    Update-Dashboard -State $State
    throw
}
