$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function ConvertTo-PlainHashtable {
    param(
        [Parameter(ValueFromPipeline = $true)]
        $InputObject
    )

    if ($null -eq $InputObject) { return $null }

    if ($InputObject -is [System.Collections.IDictionary]) {
        $hash = @{}
        foreach ($k in $InputObject.Keys) {
            $hash[$k] = ConvertTo-PlainHashtable -InputObject $InputObject[$k]
        }
        return $hash
    }

    if ($InputObject -is [pscustomobject]) {
        $props = @($InputObject.PSObject.Properties | Where-Object { $_.MemberType -eq "NoteProperty" -or $_.MemberType -eq "Property" })
        $hash = @{}
        foreach ($prop in $props) {
            $hash[$prop.Name] = ConvertTo-PlainHashtable -InputObject $prop.Value
        }
        return $hash
    }

    if ($InputObject -is [System.Collections.IEnumerable] -and -not ($InputObject -is [string])) {
        $arr = @()
        foreach ($item in $InputObject) {
            $arr += ,(ConvertTo-PlainHashtable -InputObject $item)
        }
        return $arr
    }

    return $InputObject
}

function New-RunbookChecklist {
    param(
        [hashtable]$State
    )

    $repoRoot = $RepoRoot
    $evidenceDir = Join-Path $repoRoot "docs/evidence"
    $statePath = Join-Path $evidenceDir "runbook_state.json"
    $dashboardPath = Join-Path $evidenceDir "RUNBOOK_DASHBOARD.md"
    $envEvidencePath = Join-Path $evidenceDir "ENV_SANITY.md"
    $envFailPath = Join-Path $evidenceDir "ENV_SANITY_FAIL.md"
    $lintEvidencePath = Join-Path $evidenceDir "LINT_SYNTAX.md"
    $lintFailPath = Join-Path $evidenceDir "LINT_SYNTAX_FAIL.md"
    $testEvidencePath = Join-Path $evidenceDir "TEST_UNIT.md"
    $testFailPath = Join-Path $evidenceDir "TEST_UNIT_FAIL.md"
    $monitoringEvidencePath = Join-Path $evidenceDir "MONITORING_EVIDENCE.md"
    $monitoringFailPath = Join-Path $evidenceDir "MONITORING_EVIDENCE_FAIL.md"
    $backupEvidencePath = Join-Path $evidenceDir "BACKUP_EVIDENCE.md"
    $backupFailPath = Join-Path $evidenceDir "BACKUP_EVIDENCE_FAIL.md"
    $deploymentEvidencePath = Join-Path $evidenceDir "DEPLOYMENT_EVIDENCE.md"
    $deploymentFailPath = Join-Path $evidenceDir "DEPLOYMENT_EVIDENCE_FAIL.md"
    $performanceEvidencePath = Join-Path $evidenceDir "PERFORMANCE_EVIDENCE.md"
    $performanceFailPath = Join-Path $evidenceDir "PERFORMANCE_EVIDENCE_FAIL.md"
    $smokeEvidencePath = Join-Path $evidenceDir "SMOKE_PLAYWRIGHT.md"
    $smokeFailPath = Join-Path $evidenceDir "SMOKE_PLAYWRIGHT_FAIL.md"
    $resultsPath = Join-Path $repoRoot "playwright-report/results.json"
    $checklistPath = Join-Path $evidenceDir "RUNBOOK_CHECKLIST.md"
    $masterBacklogPath = Join-Path $repoRoot "docs/runbooks/STRICT_EXECUTABLE_PLAYBOOK_v3_1.md"
    $projectRoadmapPath = Join-Path $repoRoot "claude-docs/docs/project-control/PROJECT_ROADMAP.md"
    $progressAccountingPath = Join-Path $repoRoot "claude-docs/docs/project-control/PROGRESS_ACCOUNTING.md"
    $repositoryAnalysisPath = Join-Path $repoRoot "claude-docs/docs/project-control/REPOSITORY_ANALYSIS.md"
    $riskRegisterPath = Join-Path $repoRoot "claude-docs/docs/project-control/RISK_REGISTER.md"
    $gateEvalPath = Join-Path $repoRoot "docs/evidence/GATE_EVALUATION.json"
    $freshnessHours = 48

    $loadedState = @{
        version = 1
        steps = @{}
    }
    if (Test-Path $statePath) {
        try {
            $raw = Get-Content $statePath -Raw -Encoding UTF8
            if (-not [string]::IsNullOrWhiteSpace($raw)) {
                $parsed = ConvertTo-PlainHashtable -InputObject ($raw | ConvertFrom-Json)
                if ($parsed -is [hashtable]) {
                    $loadedState = $parsed
                }
            }
        }
        catch {
            $loadedState = @{
                version = 1
                steps = @{}
            }
        }
    }
    if (-not $loadedState.ContainsKey("steps") -or $null -eq $loadedState["steps"] -or -not ($loadedState["steps"] -is [hashtable])) {
        $loadedState["steps"] = @{}
    }

    $checks = @()
    $failedRequired = @()

    $hasNode = [bool](Get-Command node -ErrorAction SilentlyContinue)
    $checks += @{ name = "node available"; ok = $hasNode; required = $true; section = "PREREQ" }

    $hasNpxCmd = [bool](Get-Command npx.cmd -ErrorAction SilentlyContinue)
    $checks += @{ name = "npx.cmd available"; ok = $hasNpxCmd; required = $true; section = "PREREQ" }

    $hasPackage = Test-Path (Join-Path $repoRoot "package.json")
    $checks += @{ name = "package.json found"; ok = $hasPackage; required = $true; section = "PREREQ" }

    $hasEvidenceDir = Test-Path $evidenceDir
    $checks += @{ name = "docs/evidence exists"; ok = $hasEvidenceDir; required = $true; section = "Evidence System" }

    $hasStateFile = Test-Path $statePath
    $checks += @{ name = "runbook_state.json exists"; ok = $hasStateFile; required = $true; section = "Evidence System" }

    $hasDashboard = Test-Path $dashboardPath
    $checks += @{ name = "RUNBOOK_DASHBOARD.md exists"; ok = $hasDashboard; required = $true; section = "Evidence System" }

    $hasRoadmap = Test-Path $projectRoadmapPath
    $checks += @{ name = "PROJECT_ROADMAP.md exists"; ok = $hasRoadmap; required = $true; section = "Control Plane" }

    $hasProgress = Test-Path $progressAccountingPath
    $checks += @{ name = "PROGRESS_ACCOUNTING.md exists"; ok = $hasProgress; required = $true; section = "Control Plane" }

    $hasRepoAnalysis = Test-Path $repositoryAnalysisPath
    $checks += @{ name = "REPOSITORY_ANALYSIS.md exists"; ok = $hasRepoAnalysis; required = $true; section = "Control Plane" }

    $hasRiskRegister = Test-Path $riskRegisterPath
    $checks += @{ name = "RISK_REGISTER.md exists"; ok = $hasRiskRegister; required = $true; section = "Control Plane" }

    $roadmapAligned = $false
    if ($hasRoadmap) {
        $roadmapText = Get-Content -Path $projectRoadmapPath -Raw -Encoding UTF8
        $roadmapAligned = ($roadmapText -notmatch "(?im)NOT STARTED|IN PROGRESS")
    }
    $checks += @{ name = "roadmap has no pending milestone markers"; ok = $roadmapAligned; required = $true; section = "Control Plane" }

    $progressCurrent = $false
    if ($hasProgress) {
        $progressText = Get-Content -Path $progressAccountingPath -Raw -Encoding UTF8
        $today = (Get-Date).ToString("yyyy-MM-dd")
        $progressCurrent = $progressText -match [regex]::Escape($today)
    }
    $checks += @{ name = "progress log has today's entry"; ok = $progressCurrent; required = $true; section = "Control Plane" }

    $repoAnalysisCurrent = $false
    if ($hasRepoAnalysis) {
        $repoAnalysisText = Get-Content -Path $repositoryAnalysisPath -Raw -Encoding UTF8
        $repoAnalysisCurrent = ($repoAnalysisText -notmatch "(?im)42 commits ahead|372 fail|372 failures")
    }
    $checks += @{ name = "repository analysis has no known stale snapshot markers"; ok = $repoAnalysisCurrent; required = $true; section = "Control Plane" }

    $riskRegisterPopulated = $false
    if ($hasRiskRegister) {
        $riskText = Get-Content -Path $riskRegisterPath -Raw -Encoding UTF8
        $riskRegisterPopulated = $riskText -match "(?im)^\|\s*R-\d+"
    }
    $checks += @{ name = "risk register has concrete entries"; ok = $riskRegisterPopulated; required = $true; section = "Control Plane" }

    $gateEvalFresh = $false
    if (Test-Path $gateEvalPath) {
        try {
            $gateEval = ConvertTo-PlainHashtable -InputObject ((Get-Content -Path $gateEvalPath -Raw -Encoding UTF8 | ConvertFrom-Json))
            if ($gateEval -is [hashtable] -and $gateEval.ContainsKey("generatedAt") -and $gateEval["generatedAt"]) {
                $gen = [datetime]::Parse($gateEval["generatedAt"].ToString())
                $gateEvalFresh = ((Get-Date) - $gen).TotalHours -le $freshnessHours
            }
        }
        catch {
            $gateEvalFresh = $false
        }
    }
    $checks += @{ name = "gate evaluation is fresh (<= 48h)"; ok = $gateEvalFresh; required = $true; section = "Freshness" }

    $runbookStateFresh = $false
    if ($loadedState["steps"].Count -gt 0) {
        $latest = $null
        foreach ($stepName in $loadedState["steps"].Keys) {
            $stepObj = $loadedState["steps"][$stepName]
            if ($stepObj -is [hashtable] -and $stepObj.ContainsKey("timestamp") -and $stepObj["timestamp"]) {
                try {
                    $ts = [datetime]::Parse($stepObj["timestamp"].ToString())
                    if ($null -eq $latest -or $ts -gt $latest) { $latest = $ts }
                }
                catch { }
            }
        }
        if ($latest) {
            $runbookStateFresh = ((Get-Date) - $latest).TotalHours -le $freshnessHours
        }
    }
    $checks += @{ name = "runbook state is fresh (<= 48h)"; ok = $runbookStateFresh; required = $true; section = "Freshness" }

    $gitCleanPolicy = $false
    if (Get-Command git -ErrorAction SilentlyContinue) {
        try {
            $statusLines = @((& git status --short 2>$null) -split "`r?`n" | Where-Object { $_ -and $_.Trim().Length -gt 0 })
            $disallowed = @($statusLines | Where-Object { $_ -notmatch "^\s*[ MADRCU\?\!]+\s+\.mcp\.json$" })
            $gitCleanPolicy = ($disallowed.Count -eq 0)
        }
        catch {
            $gitCleanPolicy = $false
        }
    }
    $checks += @{ name = "git status clean (allow .mcp.json only)"; ok = $gitCleanPolicy; required = $true; section = "Git Hygiene" }

    $envStatusPass = $false
    if ($loadedState["steps"].ContainsKey("ENV_SANITY")) {
        $step = $loadedState["steps"]["ENV_SANITY"]
        if ($step -is [hashtable] -and $step.ContainsKey("status") -and $step["status"] -eq "PASS") {
            $envStatusPass = $true
        }
    }
    $checks += @{ name = "ENV_SANITY status == PASS"; ok = $envStatusPass; required = $true; section = "Step: ENV_SANITY" }

    $envEvidenceOk = Test-Path $envEvidencePath
    $checks += @{ name = "ENV_SANITY evidence markdown exists"; ok = $envEvidenceOk; required = $true; section = "Step: ENV_SANITY" }

    $envNoFailEvidence = -not (Test-Path $envFailPath)
    $checks += @{ name = "ENV_SANITY no FAIL evidence file present"; ok = $envNoFailEvidence; required = $true; section = "Step: ENV_SANITY" }

    $lintStatusPass = $false
    if ($loadedState["steps"].ContainsKey("LINT_SYNTAX")) {
        $step = $loadedState["steps"]["LINT_SYNTAX"]
        if ($step -is [hashtable] -and $step.ContainsKey("status") -and $step["status"] -eq "PASS") {
            $lintStatusPass = $true
        }
    }
    $checks += @{ name = "LINT_SYNTAX status == PASS"; ok = $lintStatusPass; required = $true; section = "Step: LINT_SYNTAX" }

    $lintEvidenceOk = Test-Path $lintEvidencePath
    $checks += @{ name = "LINT_SYNTAX evidence markdown exists"; ok = $lintEvidenceOk; required = $true; section = "Step: LINT_SYNTAX" }

    $lintNoFailEvidence = -not (Test-Path $lintFailPath)
    $checks += @{ name = "LINT_SYNTAX no FAIL evidence file present"; ok = $lintNoFailEvidence; required = $true; section = "Step: LINT_SYNTAX" }

    $testStatusPass = $false
    if ($loadedState["steps"].ContainsKey("TEST_UNIT")) {
        $step = $loadedState["steps"]["TEST_UNIT"]
        if ($step -is [hashtable] -and $step.ContainsKey("status") -and $step["status"] -eq "PASS") {
            $testStatusPass = $true
        }
    }
    $checks += @{ name = "TEST_UNIT status == PASS"; ok = $testStatusPass; required = $true; section = "Step: TEST_UNIT" }

    $testEvidenceOk = Test-Path $testEvidencePath
    $checks += @{ name = "TEST_UNIT evidence markdown exists"; ok = $testEvidenceOk; required = $true; section = "Step: TEST_UNIT" }

    $testNoFailEvidence = -not (Test-Path $testFailPath)
    $checks += @{ name = "TEST_UNIT no FAIL evidence file present"; ok = $testNoFailEvidence; required = $true; section = "Step: TEST_UNIT" }

    $monitoringStatusPass = $false
    if ($loadedState["steps"].ContainsKey("MONITORING_EVIDENCE")) {
        $step = $loadedState["steps"]["MONITORING_EVIDENCE"]
        if ($step -is [hashtable] -and $step.ContainsKey("status") -and $step["status"] -eq "PASS") {
            $monitoringStatusPass = $true
        }
    }
    $checks += @{ name = "MONITORING_EVIDENCE status == PASS"; ok = $monitoringStatusPass; required = $true; section = "Step: MONITORING_EVIDENCE" }
    $monitoringEvidenceOk = Test-Path $monitoringEvidencePath
    $checks += @{ name = "MONITORING_EVIDENCE evidence markdown exists"; ok = $monitoringEvidenceOk; required = $true; section = "Step: MONITORING_EVIDENCE" }
    $monitoringNoFailEvidence = -not (Test-Path $monitoringFailPath)
    $checks += @{ name = "MONITORING_EVIDENCE no FAIL evidence file present"; ok = $monitoringNoFailEvidence; required = $true; section = "Step: MONITORING_EVIDENCE" }

    $backupStatusPass = $false
    if ($loadedState["steps"].ContainsKey("BACKUP_EVIDENCE")) {
        $step = $loadedState["steps"]["BACKUP_EVIDENCE"]
        if ($step -is [hashtable] -and $step.ContainsKey("status") -and $step["status"] -eq "PASS") {
            $backupStatusPass = $true
        }
    }
    $checks += @{ name = "BACKUP_EVIDENCE status == PASS"; ok = $backupStatusPass; required = $true; section = "Step: BACKUP_EVIDENCE" }
    $backupEvidenceOk = Test-Path $backupEvidencePath
    $checks += @{ name = "BACKUP_EVIDENCE evidence markdown exists"; ok = $backupEvidenceOk; required = $true; section = "Step: BACKUP_EVIDENCE" }
    $backupNoFailEvidence = -not (Test-Path $backupFailPath)
    $checks += @{ name = "BACKUP_EVIDENCE no FAIL evidence file present"; ok = $backupNoFailEvidence; required = $true; section = "Step: BACKUP_EVIDENCE" }

    $deploymentStatusPass = $false
    if ($loadedState["steps"].ContainsKey("DEPLOYMENT_EVIDENCE")) {
        $step = $loadedState["steps"]["DEPLOYMENT_EVIDENCE"]
        if ($step -is [hashtable] -and $step.ContainsKey("status") -and $step["status"] -eq "PASS") {
            $deploymentStatusPass = $true
        }
    }
    $checks += @{ name = "DEPLOYMENT_EVIDENCE status == PASS"; ok = $deploymentStatusPass; required = $true; section = "Step: DEPLOYMENT_EVIDENCE" }
    $deploymentEvidenceOk = Test-Path $deploymentEvidencePath
    $checks += @{ name = "DEPLOYMENT_EVIDENCE evidence markdown exists"; ok = $deploymentEvidenceOk; required = $true; section = "Step: DEPLOYMENT_EVIDENCE" }
    $deploymentNoFailEvidence = -not (Test-Path $deploymentFailPath)
    $checks += @{ name = "DEPLOYMENT_EVIDENCE no FAIL evidence file present"; ok = $deploymentNoFailEvidence; required = $true; section = "Step: DEPLOYMENT_EVIDENCE" }

    $performanceStatusPass = $false
    if ($loadedState["steps"].ContainsKey("PERFORMANCE_EVIDENCE")) {
        $step = $loadedState["steps"]["PERFORMANCE_EVIDENCE"]
        if ($step -is [hashtable] -and $step.ContainsKey("status") -and $step["status"] -eq "PASS") {
            $performanceStatusPass = $true
        }
    }
    $checks += @{ name = "PERFORMANCE_EVIDENCE status == PASS"; ok = $performanceStatusPass; required = $true; section = "Step: PERFORMANCE_EVIDENCE" }
    $performanceEvidenceOk = Test-Path $performanceEvidencePath
    $checks += @{ name = "PERFORMANCE_EVIDENCE evidence markdown exists"; ok = $performanceEvidenceOk; required = $true; section = "Step: PERFORMANCE_EVIDENCE" }
    $performanceNoFailEvidence = -not (Test-Path $performanceFailPath)
    $checks += @{ name = "PERFORMANCE_EVIDENCE no FAIL evidence file present"; ok = $performanceNoFailEvidence; required = $true; section = "Step: PERFORMANCE_EVIDENCE" }

    $statusPass = $false
    if ($loadedState["steps"].ContainsKey("SMOKE_PLAYWRIGHT")) {
        $step = $loadedState["steps"]["SMOKE_PLAYWRIGHT"]
        if ($step -is [hashtable] -and $step.ContainsKey("status") -and $step["status"] -eq "PASS") {
            $statusPass = $true
        }
    }
    $checks += @{ name = "status == PASS"; ok = $statusPass; required = $true; section = "Step: SMOKE_PLAYWRIGHT" }

    $hasSmokeEvidence = Test-Path $smokeEvidencePath
    $checks += @{ name = "evidence markdown exists"; ok = $hasSmokeEvidence; required = $true; section = "Step: SMOKE_PLAYWRIGHT" }

    $hasResults = Test-Path $resultsPath
    $checks += @{ name = "results.json exists"; ok = $hasResults; required = $true; section = "Step: SMOKE_PLAYWRIGHT" }

    $sizeOk = $false
    if ($hasResults) {
        $sizeOk = ((Get-Item $resultsPath).Length -gt 10)
    }
    $checks += @{ name = "results.json size > 10 bytes"; ok = $sizeOk; required = $true; section = "Step: SMOKE_PLAYWRIGHT" }

    $parseOk = $false
    $jsonKeysExpected = $false
    if ($hasResults -and $hasNode) {
        try {
            $keysRaw = & node -e "const fs=require('fs');const p=process.argv[1];try{let txt=fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'');const s=txt.indexOf('{');const e=txt.lastIndexOf('}');if(s<0||e<=s)process.exit(2);txt=txt.slice(s,e+1);const r=JSON.parse(txt);console.log(Object.keys(r).join(','));}catch{process.exit(2)}" "$resultsPath"
            if ($LASTEXITCODE -eq 0) {
                $parseOk = $true
                if ($keysRaw) {
                    $keys = $keysRaw -split ","
                    $hasSuites = $keys -contains "suites"
                    $hasStats = $keys -contains "stats"
                    $jsonKeysExpected = ($hasSuites -and $hasStats)
                }
            }
        }
        catch {
            $parseOk = $false
            $jsonKeysExpected = $false
        }
    }
    $checks += @{ name = "results.json parses"; ok = $parseOk; required = $true; section = "Step: SMOKE_PLAYWRIGHT" }

    $noFailEvidence = -not (Test-Path $smokeFailPath)
    $checks += @{ name = "no FAIL evidence file present"; ok = $noFailEvidence; required = $true; section = "Step: SMOKE_PLAYWRIGHT" }

    $checks += @{ name = "results.json has 'suites' and 'stats' keys"; ok = $jsonKeysExpected; required = $false; section = "Optional" }
    $masterBacklogExists = Test-Path $masterBacklogPath
    $checks += @{ name = "master backlog file exists"; ok = $masterBacklogExists; required = $false; section = "Optional" }

    $futureQueue = @()
    $futureQueueTotal = 0
    if ($masterBacklogExists) {
        try {
            $backlogLines = Get-Content $masterBacklogPath -Encoding UTF8
            foreach ($line in $backlogLines) {
                if ($line -match "^\s*[-*]\s\[\s\]\s+(.*)$") {
                    $futureQueue += $Matches[1].Trim()
                }
            }
            $futureQueueTotal = $futureQueue.Count
        }
        catch {
            $futureQueue = @()
            $futureQueueTotal = 0
        }
    }

    $mark = {
        param([bool]$ok)
        if ($ok) { return "[x]" }
        return "[ ]"
    }

    $lines = @()
    $lines += "# Runbook Checklist (Auto)"
    $lines += ""
    $lines += "Generated: $((Get-Date).ToString('o'))"
    $lines += "RepoRoot: $repoRoot"
    $lines += ""
    $lines += "## PREREQ"
    $lines += ""
    $lines += "* $(& $mark $hasNode) node available"
    $lines += "* $(& $mark $hasNpxCmd) npx.cmd available"
    $lines += "* $(& $mark $hasPackage) package.json found"
    $lines += ""
    $lines += "## Evidence System"
    $lines += ""
    $lines += "* $(& $mark $hasEvidenceDir) docs/evidence exists"
    $lines += "* $(& $mark $hasStateFile) runbook_state.json exists"
    $lines += "* $(& $mark $hasDashboard) RUNBOOK_DASHBOARD.md exists"
    $lines += ""
    $lines += "## Control Plane"
    $lines += ""
    $lines += "* $(& $mark $hasRoadmap) PROJECT_ROADMAP.md exists"
    $lines += "* $(& $mark $hasProgress) PROGRESS_ACCOUNTING.md exists"
    $lines += "* $(& $mark $hasRepoAnalysis) REPOSITORY_ANALYSIS.md exists"
    $lines += "* $(& $mark $hasRiskRegister) RISK_REGISTER.md exists"
    $lines += "* $(& $mark $roadmapAligned) roadmap has no pending milestone markers"
    $lines += "* $(& $mark $progressCurrent) progress log has today's entry"
    $lines += "* $(& $mark $repoAnalysisCurrent) repository analysis has no known stale snapshot markers"
    $lines += "* $(& $mark $riskRegisterPopulated) risk register has concrete entries"
    $lines += ""
    $lines += "## Freshness"
    $lines += ""
    $lines += "* $(& $mark $gateEvalFresh) gate evaluation is fresh (<= 48h)"
    $lines += "* $(& $mark $runbookStateFresh) runbook state is fresh (<= 48h)"
    $lines += ""
    $lines += "## Git Hygiene"
    $lines += ""
    $lines += "* $(& $mark $gitCleanPolicy) git status clean (allow .mcp.json only)"
    $lines += ""
    $lines += "## Step: ENV_SANITY"
    $lines += ""
    $lines += "* $(& $mark $envStatusPass) status == PASS"
    $lines += "* $(& $mark $envEvidenceOk) evidence markdown exists"
    $lines += "* $(& $mark $envNoFailEvidence) no FAIL evidence file present"
    $lines += ""
    $lines += "## Step: LINT_SYNTAX"
    $lines += ""
    $lines += "* $(& $mark $lintStatusPass) status == PASS"
    $lines += "* $(& $mark $lintEvidenceOk) evidence markdown exists"
    $lines += "* $(& $mark $lintNoFailEvidence) no FAIL evidence file present"
    $lines += ""
    $lines += "## Step: TEST_UNIT"
    $lines += ""
    $lines += "* $(& $mark $testStatusPass) status == PASS"
    $lines += "* $(& $mark $testEvidenceOk) evidence markdown exists"
    $lines += "* $(& $mark $testNoFailEvidence) no FAIL evidence file present"
    $lines += ""
    $lines += "## Step: MONITORING_EVIDENCE"
    $lines += ""
    $lines += "* $(& $mark $monitoringStatusPass) status == PASS"
    $lines += "* $(& $mark $monitoringEvidenceOk) evidence markdown exists"
    $lines += "* $(& $mark $monitoringNoFailEvidence) no FAIL evidence file present"
    $lines += ""
    $lines += "## Step: BACKUP_EVIDENCE"
    $lines += ""
    $lines += "* $(& $mark $backupStatusPass) status == PASS"
    $lines += "* $(& $mark $backupEvidenceOk) evidence markdown exists"
    $lines += "* $(& $mark $backupNoFailEvidence) no FAIL evidence file present"
    $lines += ""
    $lines += "## Step: DEPLOYMENT_EVIDENCE"
    $lines += ""
    $lines += "* $(& $mark $deploymentStatusPass) status == PASS"
    $lines += "* $(& $mark $deploymentEvidenceOk) evidence markdown exists"
    $lines += "* $(& $mark $deploymentNoFailEvidence) no FAIL evidence file present"
    $lines += ""
    $lines += "## Step: PERFORMANCE_EVIDENCE"
    $lines += ""
    $lines += "* $(& $mark $performanceStatusPass) status == PASS"
    $lines += "* $(& $mark $performanceEvidenceOk) evidence markdown exists"
    $lines += "* $(& $mark $performanceNoFailEvidence) no FAIL evidence file present"
    $lines += ""
    $lines += "## Step: SMOKE_PLAYWRIGHT"
    $lines += ""
    $lines += "* $(& $mark $statusPass) status == PASS"
    $lines += "* $(& $mark $hasSmokeEvidence) evidence markdown exists"
    $lines += "* $(& $mark $hasResults) results.json exists"
    $lines += "* $(& $mark $sizeOk) results.json size > 10 bytes"
    $lines += "* $(& $mark $parseOk) results.json parses"
    $lines += "* $(& $mark $noFailEvidence) no FAIL evidence file present"
    $lines += ""
    $lines += "## Optional"
    $lines += ""
    $lines += "* $(& $mark $jsonKeysExpected) results.json has 'suites' and 'stats' keys"
    $lines += "* $(& $mark $masterBacklogExists) master backlog file exists"
    $lines += ""
    $lines += "## Future Work Queue (From Master Backlog)"
    $lines += ""
    if ($masterBacklogExists) {
        $lines += "- Total remaining items: $futureQueueTotal"
        if ($futureQueueTotal -gt 0) {
            foreach ($item in $futureQueue) {
                $lines += "- [ ] $item"
            }
        }
        else {
            $lines += "- [x] No unchecked backlog items found."
        }
    }
    else {
        $lines += "- [ ] Master backlog file missing: docs/runbooks/STRICT_EXECUTABLE_PLAYBOOK_v3_1.md"
    }
    $lines += ""
    $lines += "## Links"
    $lines += ""
    $lines += "* [RUNBOOK_DASHBOARD.md](docs/evidence/RUNBOOK_DASHBOARD.md)"
    $lines += "* [SMOKE_PLAYWRIGHT.md](docs/evidence/SMOKE_PLAYWRIGHT.md)"
    $lines += "* [runbook_state.json](docs/evidence/runbook_state.json)"
    $lines += "* [STRICT_EXECUTABLE_PLAYBOOK_v3_1.md](docs/runbooks/STRICT_EXECUTABLE_PLAYBOOK_v3_1.md)"

    foreach ($check in $checks) {
        if ($check.required -and (-not $check.ok)) {
            $failedRequired += $check.name
        }
    }

    $markdown = ($lines -join "`n")
    Set-Content -Path $checklistPath -Value $markdown -Encoding UTF8

    return @{
        ok = ($failedRequired.Count -eq 0)
        failed = $failedRequired
        markdown = $markdown
    }
}
