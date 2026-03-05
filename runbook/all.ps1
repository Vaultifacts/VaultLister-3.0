param(
    [switch]$Force,
    [string]$Only,
    [switch]$CI
)

. "$PSScriptRoot/_bootstrap.ps1"
. "$PSScriptRoot/_state.ps1"
. "$PSScriptRoot/_helpers.ps1"

$State = Get-RunbookState
$Steps = @(
    @{ Name = "ENV_SANITY"; Path = (Join-Path $PSScriptRoot "steps/ENV_SANITY.ps1") }
    @{ Name = "LINT_SYNTAX"; Path = (Join-Path $PSScriptRoot "steps/LINT_SYNTAX.ps1") }
    @{ Name = "TEST_UNIT"; Path = (Join-Path $PSScriptRoot "steps/TEST_UNIT.ps1") }
    @{ Name = "MONITORING_EVIDENCE"; Path = (Join-Path $PSScriptRoot "steps/MONITORING_EVIDENCE.ps1") }
    @{ Name = "BACKUP_EVIDENCE"; Path = (Join-Path $PSScriptRoot "steps/BACKUP_EVIDENCE.ps1") }
    @{ Name = "DEPLOYMENT_EVIDENCE"; Path = (Join-Path $PSScriptRoot "steps/DEPLOYMENT_EVIDENCE.ps1") }
    @{ Name = "PERFORMANCE_EVIDENCE"; Path = (Join-Path $PSScriptRoot "steps/PERFORMANCE_EVIDENCE.ps1") }
    @{ Name = "SMOKE_PLAYWRIGHT"; Path = (Join-Path $PSScriptRoot "steps/SMOKE_PLAYWRIGHT.ps1") }
)

if ($Only) {
    $Steps = $Steps | Where-Object { $_.Name -eq $Only }
    if ($Steps.Count -eq 0) {
        throw "Unknown step: $Only"
    }
}

foreach ($step in $Steps) {
    $run = Should-RunStep -State $State -StepName $step.Name -Force ([bool]$Force)
    if ($run) {
        & $step.Path -Force:$Force
    }
    else {
        Write-Host "Skipping $($step.Name): already PASS"
    }
    $State = Get-RunbookState
    Update-Dashboard -State $State
    New-RunbookChecklist -State $State | Out-Null
}

if ($CI) {
    $State = Get-RunbookState
    $r = New-RunbookChecklist -State $State
    if (-not $r.ok) {
        Write-Host "CI gate failed: required checklist items not satisfied."
        foreach ($item in $r.failed) {
            Write-Host " - $item"
        }
        exit 1
    }
}
