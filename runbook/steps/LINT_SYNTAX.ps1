param(
    [switch]$Force
)

. "$PSScriptRoot/../_bootstrap.ps1"
. "$PSScriptRoot/../_state.ps1"
. "$PSScriptRoot/../_helpers.ps1"

$StepName = "LINT_SYNTAX"
$State = Get-RunbookState
$EvidenceRel = "docs/evidence/LINT_SYNTAX.md"
$EvidenceFailRel = "docs/evidence/LINT_SYNTAX_FAIL.md"

try {
    Set-Location $RepoRoot

    $commandUsed = "npm.cmd run lint"
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $output = (& cmd.exe /d /c "$commandUsed" 2>&1 | Out-String)
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $prevEap
    }
    if ($exitCode -ne 0) {
        throw "$commandUsed failed with exit code $exitCode.`n$output"
    }

    $content = @(
        "# LINT_SYNTAX",
        "",
        "- Date: $(Get-Date -Format o)",
        "- RepoRoot: $RepoRoot",
        "- Command: $commandUsed",
        "- Exit code: $exitCode",
        "- Status: PASS",
        "",
        "## Output",
        "",
        '```',
        $output.TrimEnd(),
        '```'
    ) -join "`n"
    Write-Evidence -Path $EvidenceRel -Content $content

    $oldFailPath = Join-Path $RepoRoot $EvidenceFailRel
    if (Test-Path $oldFailPath) {
        Remove-Item -Path $oldFailPath -Force
    }

    $State = Mark-Step -State $State -StepName $StepName -Status "PASS" -EvidencePath $EvidenceRel -Meta @{ exitCode = $exitCode; force = [bool]$Force }
    Update-Dashboard -State $State
}
catch {
    $err = $_.Exception.Message
    $content = @(
        "# LINT_SYNTAX FAIL",
        "",
        "- Date: $(Get-Date -Format o)",
        "- RepoRoot: $RepoRoot",
        "- Command: $commandUsed",
        "- Status: FAIL",
        "- Error: $err"
    ) -join "`n"
    Write-Evidence -Path $EvidenceFailRel -Content $content
    $State = Mark-Step -State $State -StepName $StepName -Status "FAIL" -EvidencePath $EvidenceFailRel -Meta @{ error = $err; force = [bool]$Force }
    Update-Dashboard -State $State
    throw
}
