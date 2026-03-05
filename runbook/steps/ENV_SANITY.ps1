param(
    [switch]$Force
)

. "$PSScriptRoot/../_bootstrap.ps1"
. "$PSScriptRoot/../_state.ps1"
. "$PSScriptRoot/../_helpers.ps1"

$StepName = "ENV_SANITY"
$State = Get-RunbookState
$EvidenceRel = "docs/evidence/ENV_SANITY.md"
$EvidenceFailRel = "docs/evidence/ENV_SANITY_FAIL.md"

try {
    Set-Location $RepoRoot

    $nodeVersionRaw = (& node --version 2>&1 | Out-String).Trim()
    if (-not $nodeVersionRaw) {
        throw "Unable to determine Node version."
    }

    $nodeMajor = -1
    $m = [regex]::Match($nodeVersionRaw, "^v(\d+)\.")
    if ($m.Success) {
        $nodeMajor = [int]$m.Groups[1].Value
    }
    if ($nodeMajor -lt 18) {
        throw "Node version must be >= 18. Found: $nodeVersionRaw"
    }

    $hasBun = [bool](Get-Command bun -ErrorAction SilentlyContinue)
    if (-not $hasBun) {
        throw "bun is required for this repository but was not found."
    }
    $bunVersionRaw = (& bun --version 2>&1 | Out-String).Trim()

    $content = @"
# ENV_SANITY

- Date: $(Get-Date -Format o)
- RepoRoot: $RepoRoot
- Node version: $nodeVersionRaw
- Node major: $nodeMajor
- Bun available: $hasBun
- Bun version: $bunVersionRaw
- Status: PASS
"@
    Write-Evidence -Path $EvidenceRel -Content $content

    $oldFailPath = Join-Path $RepoRoot $EvidenceFailRel
    if (Test-Path $oldFailPath) {
        Remove-Item -Path $oldFailPath -Force
    }

    $State = Mark-Step -State $State -StepName $StepName -Status "PASS" -EvidencePath $EvidenceRel -Meta @{ node = $nodeVersionRaw; nodeMajor = $nodeMajor; bun = $bunVersionRaw; force = [bool]$Force }
    Update-Dashboard -State $State
}
catch {
    $err = $_.Exception.Message
    $content = @"
# ENV_SANITY FAIL

- Date: $(Get-Date -Format o)
- RepoRoot: $RepoRoot
- Status: FAIL
- Error: $err
"@
    Write-Evidence -Path $EvidenceFailRel -Content $content
    $State = Mark-Step -State $State -StepName $StepName -Status "FAIL" -EvidencePath $EvidenceFailRel -Meta @{ error = $err; force = [bool]$Force }
    Update-Dashboard -State $State
    throw
}
