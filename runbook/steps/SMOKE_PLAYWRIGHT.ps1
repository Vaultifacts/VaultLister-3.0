param(
    [switch]$Force
)

. "$PSScriptRoot/../_bootstrap.ps1"
. "$PSScriptRoot/../_state.ps1"
. "$PSScriptRoot/../_helpers.ps1"

$StepName = "SMOKE_PLAYWRIGHT"
$State = Get-RunbookState
$ReportDir = Join-Path $RepoRoot "playwright-report"
$Results = Join-Path $ReportDir "results.json"
$EvidenceRel = "docs/evidence/SMOKE_PLAYWRIGHT.md"
$EvidenceFailRel = "docs/evidence/SMOKE_PLAYWRIGHT_FAIL.md"

try {
    if (!(Test-Path $ReportDir)) {
        New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
    }

    $pwVersion = npx.cmd --no-install playwright --version
    npx.cmd --no-install playwright test --reporter=json | Set-Content -Path $Results -Encoding UTF8

    if (!(Test-Path $Results)) {
        throw "Playwright JSON report missing."
    }

    $size = (Get-Item $Results).Length
    if ($size -le 10) {
        throw "Playwright report too small ($size bytes)."
    }

    # Some test hooks may print log lines before JSON; normalize to the JSON object payload.
    $rawResults = Get-Content -Path $Results -Raw -Encoding UTF8
    $firstBrace = $rawResults.IndexOf("{")
    $lastBrace = $rawResults.LastIndexOf("}")
    if ($firstBrace -lt 0 -or $lastBrace -lt 0 -or $lastBrace -le $firstBrace) {
        throw "Playwright JSON report did not contain a valid JSON object."
    }
    $jsonOnly = $rawResults.Substring($firstBrace, $lastBrace - $firstBrace + 1)
    $jsonOnly | Set-Content -Path $Results -Encoding UTF8

    $jsonKeys = node -e "const fs=require('fs');const p=process.argv[1];const txt=fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'');const r=JSON.parse(txt);console.log(Object.keys(r).join(','));" "$Results"

    $content = @"
# SMOKE_PLAYWRIGHT

- Date: $(Get-Date -Format o)
- RepoRoot: $RepoRoot
- Commands:
  - npx --no-install playwright --version
  - npx --no-install playwright test --reporter=json > playwright-report/results.json
  - node -e "const r=require('./playwright-report/results.json'); console.log(Object.keys(r));"
- Results file: playwright-report/results.json
- Size: $size bytes
- JSON keys: $jsonKeys
- Status: PASS
"@
    Write-Evidence -Path $EvidenceRel -Content $content
    $oldFailPath = Join-Path $RepoRoot $EvidenceFailRel
    if (Test-Path $oldFailPath) {
        Remove-Item -Path $oldFailPath -Force
    }

    $State = Mark-Step -State $State -StepName $StepName -Status "PASS" -EvidencePath $EvidenceRel -Meta @{ size = $size; jsonKeys = $jsonKeys; force = [bool]$Force }
    Update-Dashboard -State $State
}
catch {
    $err = $_.Exception.Message
    $failContent = @"
# SMOKE_PLAYWRIGHT FAIL

- Date: $(Get-Date -Format o)
- RepoRoot: $RepoRoot
- Status: FAIL
- Error: $err
"@
    Write-Evidence -Path $EvidenceFailRel -Content $failContent
    $State = Mark-Step -State $State -StepName $StepName -Status "FAIL" -EvidencePath $EvidenceFailRel -Meta @{ error = $err; force = [bool]$Force }
    Update-Dashboard -State $State
    throw
}
