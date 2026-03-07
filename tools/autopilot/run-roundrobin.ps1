param(
    [int]$MaxIterations = 25,
    [int]$IpBlockMax = 3,
    [switch]$AutoCommit,
    [ValidateSet("CodexOnly", "RoundRobin")]
    [string]$Mode = "CodexOnly"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Find-RepoRoot {
    $dir = Resolve-Path $PSScriptRoot
    while ($true) {
        $pkg = Join-Path $dir "package.json"
        if (Test-Path $pkg) {
            return $dir
        }
        $parent = Split-Path -Path $dir -Parent
        if ([string]::IsNullOrWhiteSpace($parent) -or $parent -eq $dir) {
            throw "Autopilot aborted: package.json not found while walking upward from $PSScriptRoot"
        }
        $dir = $parent
    }
}

function Get-ToolPath {
    param(
        [Parameter(Mandatory = $true)][string]$Name
    )
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if ($null -eq $cmd) { return $null }
    $source = $cmd.Source
    if ($cmd.CommandType -eq "ExternalScript" -and $source.ToLowerInvariant().EndsWith(".ps1")) {
        $cmdSibling = [System.IO.Path]::ChangeExtension($source, ".cmd")
        if (Test-Path $cmdSibling) {
            return $cmdSibling
        }
    }
    return $source
}

function Ensure-Tool {
    param(
        [Parameter(Mandatory = $true)][string]$Name
    )
    $path = Get-ToolPath -Name $Name
    if ($null -eq $path) {
        throw "Required tool '$Name' not found on PATH. Install/configure it, then rerun."
    }
    try {
        & $path --version | Out-Host
    } catch {
        throw "Tool '$Name' found at '$path' but '--version' failed: $($_.Exception.Message)"
    }
    return $path
}

function Invoke-NativeWithLog {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [Parameter(Mandatory = $true)][string]$LogPath,
        [Parameter(Mandatory = $true)][int]$TimeoutSeconds,
        [Parameter(Mandatory = $true)][string]$StepName,
        # Set when the command does NOT spawn background processes (e.g. direct bun test).
        # Merges stderr into stdout so bun's test result lines are captured in the log.
        # DO NOT set for npm test — the background test server would hold the merged pipe open.
        [switch]$MergeStderr
    )
    $logDir = Split-Path -Path $LogPath -Parent
    if (-not (Test-Path $logDir)) {
        New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    }

    # Remove stale log before writing (prevents IOException from inherited handles in prior runs)
    if (Test-Path $LogPath) { Remove-Item -Force $LogPath -ErrorAction SilentlyContinue }

    $startStamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    @(
        "[$startStamp] Starting step: $StepName"
        "Command: $FilePath $($Arguments -join ' ')"
    ) | Set-Content -Path $LogPath -Encoding UTF8

    $appendLogBestEffort = {
        param([Parameter(Mandatory = $true)][string]$Value)
        for ($appendAttempt = 1; $appendAttempt -le 3; $appendAttempt++) {
            try {
                Add-Content -Path $LogPath -Value $Value -ErrorAction Stop
                return
            } catch {
                if ($appendAttempt -lt 3) {
                    Start-Sleep -Milliseconds 200
                }
            }
        }
    }

    $ecFile = [System.IO.Path]::GetTempFileName()
    $stderrPath = [System.IO.Path]::GetTempFileName()
    $wrapperPath = [System.IO.Path]::GetTempFileName() + ".ps1"
    try {
        # Wrap command in a PS1 that writes $LASTEXITCODE to a file.
        # Start-Process -PassThru ExitCode is always null on this Windows setup;
        # $LASTEXITCODE via the & operator is the only reliable mechanism.
        $esc = { param($s) "'" + ($s -replace "'", "''") + "'" }
        $allArgs = @($FilePath) + $Arguments
        $invokeExpr = "& " + (($allArgs | ForEach-Object { & $esc $_ }) -join " ")
        $ecFileEsc = $ecFile -replace "'", "''"
        $stderrRedirect = if ($MergeStderr) { " 2>&1" } else { "" }
        $wrapperContent = @"
Set-StrictMode -Off
`$ErrorActionPreference = 'SilentlyContinue'
$invokeExpr$stderrRedirect
`$LASTEXITCODE | Set-Content -Path '$ecFileEsc' -Encoding UTF8
"@
        Set-Content -Path $wrapperPath -Value $wrapperContent -Encoding UTF8

        $proc = Start-Process -FilePath "powershell.exe" `
            -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $wrapperPath) `
            -NoNewWindow -PassThru `
            -RedirectStandardOutput $LogPath `
            -RedirectStandardError $stderrPath

        $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
        while (-not $proc.HasExited) {
            if ((Get-Date) -ge $deadline) {
                try {
                    Stop-Process -Id $proc.Id -Force -ErrorAction Stop
                } catch {
                    & $appendLogBestEffort ("Failed to stop timed out process id {0}: {1}" -f $proc.Id, $_.Exception.Message)
                }
                & $appendLogBestEffort ("TIMEOUT: Step '{0}' exceeded {1}s and was terminated." -f $StepName, $TimeoutSeconds)
                if (Test-Path $stderrPath) {
                    $timeoutErr = Get-Content -Raw -Encoding UTF8 $stderrPath
                    if (-not [string]::IsNullOrWhiteSpace($timeoutErr)) {
                        & $appendLogBestEffort $timeoutErr
                    }
                }
                return 124
            }
            Start-Sleep -Seconds 2
        }

        if (Test-Path $stderrPath) {
            $err = Get-Content -Raw -Encoding UTF8 $stderrPath
            if (-not [string]::IsNullOrWhiteSpace($err)) {
                & $appendLogBestEffort $err
            }
        }
        $proc.WaitForExit()

        # Read real exit code from file written by the wrapper PS1
        Start-Sleep -Milliseconds 500
        $exitCode = -1
        if (Test-Path $ecFile) {
            $ecText = (Get-Content -Raw -Encoding UTF8 $ecFile).Trim()
            $parsed = 0
            if ([int]::TryParse($ecText, [ref]$parsed)) { $exitCode = $parsed }
        }
        return $exitCode
    } finally {
        foreach ($tmp in @($stderrPath, $ecFile, $wrapperPath)) {
            if ($tmp -and (Test-Path $tmp)) {
                try { Remove-Item -Force -ErrorAction Stop $tmp } catch {}
            }
        }
    }
}

function Invoke-ClaudeStep {
    param(
        [Parameter(Mandatory = $true)][string]$ClaudeExe,
        [Parameter(Mandatory = $true)][string]$PromptText,
        [Parameter(Mandatory = $true)][string]$LogPath
    )

    $promptPath = [System.IO.Path]::GetTempFileName()
    try {
        Set-Content -Path $promptPath -Value $PromptText -Encoding UTF8
        $candidates = @(
            @("-p", "--max-turns", "1"),
            @("--print", "--max-turns", "1")
        )

        foreach ($args in $candidates) {
            $raw = Get-Content -Raw -Encoding UTF8 $promptPath
            $output = $raw | & $ClaudeExe @args 2>&1
            $output | Out-File -FilePath $LogPath -Encoding utf8
            $code = $LASTEXITCODE
            if ($null -eq $code) { $code = 0 }
            if ($code -eq 0) { return 0 }
        }
        return 1
    } finally {
        if (Test-Path $promptPath) { Remove-Item -Force $promptPath }
    }
}

function Invoke-CodexStep {
    param(
        [Parameter(Mandatory = $true)][string]$CodexExe,
        [Parameter(Mandatory = $true)][string]$PromptText,
        [Parameter(Mandatory = $true)][string]$LogPath
    )

    $promptPath = [System.IO.Path]::GetTempFileName()
    $stderrPath = [System.IO.Path]::GetTempFileName()
    try {
        Set-Content -Path $promptPath -Value $PromptText -Encoding UTF8
        $candidates = @(
            @("exec", "-"),
            @("e", "-")
        )

        foreach ($candidateArgs in $candidates) {
            # Use & operator + $LASTEXITCODE — Start-Process ExitCode is always null on this host.
            # Temporarily suppress Stop on stderr writes (NativeCommandError from version-info lines).
            $savedEAP = $ErrorActionPreference
            $ErrorActionPreference = 'Continue'
            $output = Get-Content -Raw -Encoding UTF8 $promptPath | & $CodexExe @candidateArgs 2>$stderrPath
            $code = $LASTEXITCODE
            $ErrorActionPreference = $savedEAP
            if ($null -eq $code) { $code = 1 }
            $err = if (Test-Path $stderrPath) { Get-Content -Raw -Encoding UTF8 $stderrPath } else { "" }
            ($output + $err) | Out-File -FilePath $LogPath -Encoding utf8
            if ($code -eq 0) { return 0 }
        }
        return 1
    } finally {
        if (Test-Path $promptPath) { Remove-Item -Force $promptPath }
        if (Test-Path $stderrPath) { Remove-Item -Force $stderrPath -ErrorAction SilentlyContinue }
    }
}

function Invoke-CodexPreflight {
    param(
        [Parameter(Mandatory = $true)][string]$CodexExe,
        [Parameter(Mandatory = $true)][string]$LogPath
    )
    $probePrompt = "Reply with exactly PRECHECK_OK."
    return (Invoke-CodexStep -CodexExe $CodexExe -PromptText $probePrompt -LogPath $LogPath)
}

function Read-FileText {
    param([Parameter(Mandatory = $true)][string]$Path)
    return (Get-Content -Raw -Encoding UTF8 $Path)
}

function Get-TaskSetting {
    param(
        [Parameter(Mandatory = $true)][string]$TaskText,
        [Parameter(Mandatory = $true)][string]$Key
    )
    $m = [regex]::Match($TaskText, "(?im)^\s*$([regex]::Escape($Key))\s*:\s*(.+?)\s*$")
    if ($m.Success) {
        return $m.Groups[1].Value.Trim()
    }
    return $null
}

$repoRoot = Find-RepoRoot
Set-Location $repoRoot

$autoRoot = Join-Path $repoRoot "tools/autopilot"
$logsDir = Join-Path $autoRoot "logs"
if (!(Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
}

$taskPath = Join-Path $autoRoot "TASK.md"
$claudePromptPath = Join-Path $autoRoot "prompts/claude_plan.txt"
$codexPromptPath = Join-Path $autoRoot "prompts/codex_execute.txt"

if (!(Test-Path $taskPath)) { throw "Missing required file: $taskPath" }
if ($Mode -eq "RoundRobin" -and !(Test-Path $claudePromptPath)) { throw "Missing required file: $claudePromptPath" }
if ($Mode -eq "RoundRobin" -and !(Test-Path $codexPromptPath)) { throw "Missing required file: $codexPromptPath" }

$codexExe = Ensure-Tool -Name "codex"
if ($Mode -eq "RoundRobin") {
    $claudeExe = Ensure-Tool -Name "claude"
}

$noProgressStreak = 0
$autopilotBranch = ""
if ($AutoCommit) {
    $branchNow = (& git rev-parse --abbrev-ref HEAD 2>$null).Trim()
    if ([string]::IsNullOrWhiteSpace($branchNow)) {
        throw "Unable to determine current git branch for auto-commit mode."
    }
    if ($branchNow -eq "HEAD") {
        throw "Detached HEAD detected. Checkout a branch before using -AutoCommit."
    }
    if (-not $branchNow.StartsWith("autopilot/roundrobin-")) {
        $stamp = Get-Date -Format "yyyyMMdd-HHmm"
        $autopilotBranch = "autopilot/roundrobin-$stamp"
        & git checkout -b $autopilotBranch | Out-Host
    } else {
        $autopilotBranch = $branchNow
    }
}

$taskTextGlobal = Read-FileText -Path $taskPath
$targetRegex = Get-TaskSetting -TaskText $taskTextGlobal -Key "TargetSignatureRegex"
if ([string]::IsNullOrWhiteSpace($targetRegex)) {
    $targetRegex = 'temporarily blocked due to repeated violations'
}
$targetThresholdRaw = Get-TaskSetting -TaskText $taskTextGlobal -Key "TargetThreshold"
$targetThreshold = $IpBlockMax
if (-not [string]::IsNullOrWhiteSpace($targetThresholdRaw)) {
    $parsed = 0
    if ([int]::TryParse($targetThresholdRaw, [ref]$parsed)) {
        $targetThreshold = $parsed
    }
}

$preflightLog = Join-Path $logsDir "codex_preflight.txt"
$preflightCode = Invoke-CodexPreflight -CodexExe $codexExe -LogPath $preflightLog
$preflightText = if (Test-Path $preflightLog) { Read-FileText -Path $preflightLog } else { "" }
if ($preflightCode -ne 0) {
    Write-Host "STOP: Codex preflight failed; rerun in a writable / permission-capable context."
    exit 1
}
if (
    $preflightText -match 'sandbox:\s*read-only' -or
    $preflightText -match 'Access is denied' -or
    $preflightText -match 'failed to install system skills'
) {
    Write-Host "STOP: Codex execution context is not writable; rerun in a workspace-write / permission-capable context."
    exit 1
}

for ($i = 1; $i -le $MaxIterations; $i++) {
    $iter = "{0:D2}" -f $i
    Write-Host "=== AUTOPILOT ITERATION $iter ==="

    $claudeLog = Join-Path $logsDir ("claude_plan_iter{0}.txt" -f $iter)
    $codexLog = Join-Path $logsDir ("codex_exec_iter{0}.txt" -f $iter)
    $npmLog = Join-Path $logsDir ("npm_test_iter{0}.txt" -f $iter)
    $smokeLog = Join-Path $logsDir ("runbook_smoke_iter{0}.txt" -f $iter)
    $bunTargetLog = Join-Path $logsDir ("bun_targeted_iter{0}.txt" -f $iter)

    $taskText = Read-FileText -Path $taskPath
    if ($Mode -eq "RoundRobin") {
        $claudePromptTemplate = Read-FileText -Path $claudePromptPath
        $claudePrompt = @"
$claudePromptTemplate

TASK FILE CONTENT:
$taskText
"@

        $claudeCode = Invoke-ClaudeStep -ClaudeExe $claudeExe -PromptText $claudePrompt -LogPath $claudeLog
        if ($claudeCode -ne 0) {
            $claudeErr = Read-FileText -Path $claudeLog
            if ($claudeErr -match "Reached max turns") {
                Write-Host "STOP: Claude planner exceeded turn budget; tighten planner prompt."
                break
            }
            throw "Claude step failed at iteration $iter. See $claudeLog"
        }

        $codexTemplate = Read-FileText -Path $codexPromptPath
        $codexPrompt = @"
$codexTemplate

INPUT FILES:
- TASK: $taskPath
- CLAUDE_PLAN_OUTPUT: $claudeLog
"@
    } else {
        $codexPrompt = @"
You are Codex in executor mode.

Task brief:
$taskText

Execution requirements:
- First target this failure signature regex in npm output:
  $targetRegex
- If it maps to an in-repo message, report exact file path and function/condition.
- If it is test-assertion output, identify representative failing tests and request-path cause.
- Then apply only the smallest safe fix to make tests hermetic in test mode.
- Preserve production behavior unchanged.
- Do not modify runbook/gate/evidence contracts listed in the task.

After patching, run:
- npm test
- npm run runbook:smoke

Output exactly:
CHANGES
VALIDATION
NEXT
"@
    }

    $codexCode = 1
    $codexMaxAttempts = 3
    for ($attempt = 1; $attempt -le $codexMaxAttempts; $attempt++) {
        Write-Host ("Codex attempt {0}/{1}" -f $attempt, $codexMaxAttempts)
        $codexCode = Invoke-CodexStep -CodexExe $codexExe -PromptText $codexPrompt -LogPath $codexLog
        if ($codexCode -eq 0) {
            break
        }
        if ($attempt -lt $codexMaxAttempts) {
            Start-Sleep -Seconds 5
        }
    }
    if ($codexCode -ne 0) {
        throw "Codex step failed at iteration $iter after $codexMaxAttempts attempts. See $codexLog"
    }

    $trackedLines = @(& git status --porcelain --untracked-files=no 2>$null)
    $untrackedLines = @((& git ls-files --others --exclude-standard 2>$null) | Where-Object { $_ -notlike "tools/autopilot/logs/*" })
    $hasChanges = ($trackedLines.Length -gt 0) -or ($untrackedLines.Length -gt 0)
    if ($hasChanges) {
        $noProgressStreak = 0
        if ($AutoCommit) {
            & git add -A | Out-Host
            & git commit -m ("autopilot: iter {0}" -f $iter) | Out-Host
        }
    } else {
        $noProgressStreak++
        Write-Host "No repo changes detected this iteration. Streak: $noProgressStreak"
        if ($noProgressStreak -ge 2) {
            Write-Host "STOP: no progress for 2 consecutive iterations."
            break
        }
    }

    # Kill any lingering test server before writing npm_test log header.
    # The previous npm test starts a bun server via test:setup; that server keeps a file handle
    # open on the log file. Remove-Item silently fails on a locked file, causing Set-Content to
    # crash. Running dev:stop first releases the handle before Invoke-NativeWithLog writes.
    $savedEAP2 = $ErrorActionPreference
    $ErrorActionPreference = 'SilentlyContinue'
    & "npm.cmd" "run" "dev:stop" 2>$null | Out-Null
    $ErrorActionPreference = $savedEAP2
    Start-Sleep -Milliseconds 800

    Write-Host ("Starting outer npm test for iteration {0}" -f $iter)
    $npmCode = Invoke-NativeWithLog -FilePath "npm.cmd" -Arguments @("test") -LogPath $npmLog -TimeoutSeconds 2400 -StepName ("outer npm test iteration {0}" -f $iter)
    Write-Host ("Finished outer npm test with code {0}" -f $npmCode)

    # Run targeted bun tests with stderr merged — bun writes test results to stderr, not stdout.
    # This command does NOT spawn a background server so MergeStderr is safe (no pipe-hold hang).
    # The test server started by npm test is still running at this point.
    $bunExe = Get-ToolPath -Name "bun"
    if ($null -eq $bunExe) { $bunExe = "bun" }
    $bunTargetArgs = @("test", "--env-file", ".env",
        "src/tests/authEndpoints.test.js",
        "src/tests/auth.test.js",
        "src/tests/security.test.js")
    $env:NODE_ENV = "test"
    $env:TEST_BASE_URL = "http://localhost:3100"
    $env:PORT = "3100"
    Write-Host ("Starting targeted bun test for iteration {0}" -f $iter)
    $bunCode = Invoke-NativeWithLog -FilePath $bunExe -Arguments $bunTargetArgs -LogPath $bunTargetLog -TimeoutSeconds 120 -StepName ("bun targeted test iteration {0}" -f $iter) -MergeStderr
    Write-Host ("Finished targeted bun test with code {0}" -f $bunCode)

    Write-Host ("Starting outer runbook smoke for iteration {0}" -f $iter)
    $smokeCode = Invoke-NativeWithLog -FilePath "npm.cmd" -Arguments @("run", "runbook:smoke") -LogPath $smokeLog -TimeoutSeconds 600 -StepName ("outer runbook smoke iteration {0}" -f $iter)
    Write-Host ("Finished outer runbook smoke with code {0}" -f $smokeCode)

    # Use the targeted bun test log for signature matching — it captures bun's stderr (test results).
    # The npm log only has stdout (console.log lines), which never contains assertion failures.
    $targetText = Read-FileText -Path $bunTargetLog
    $targetCount = ([regex]::Matches($targetText, $targetRegex)).Count
    Write-Host "Target signature count: $targetCount (regex: $targetRegex)"

    if ($smokeCode -ne 0) {
        Write-Host "STOP: runbook:smoke failed (iteration $iter)."
        break
    }
    if ($npmCode -eq 0) {
        Write-Host "STOP: npm test passed (iteration $iter)."
        break
    }
    if ($targetCount -eq 0) {
        Write-Host "STOP: Target signature disappeared (iteration $iter)."
        break
    }
    if ($targetCount -le $targetThreshold) {
        Write-Host "STOP: Target signature reached threshold ($targetCount <= $targetThreshold) at iteration $iter."
        break
    }
    if ($i -eq $MaxIterations) {
        Write-Host "STOP: Max iterations reached ($MaxIterations)."
    }
}
