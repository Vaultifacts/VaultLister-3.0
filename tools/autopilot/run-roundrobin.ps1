param(
    [int]$MaxIterations = 25,
    [int]$IpBlockMax = 3
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
        [Parameter(Mandatory = $true)][string]$LogPath
    )
    $stdoutPath = [System.IO.Path]::GetTempFileName()
    $stderrPath = [System.IO.Path]::GetTempFileName()
    try {
        $invokeFile = $FilePath
        $invokeArgs = $Arguments
        if ($FilePath.ToLowerInvariant().EndsWith(".ps1")) {
            $invokeFile = "powershell.exe"
            $invokeArgs = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $FilePath) + $Arguments
        }

        $proc = Start-Process -FilePath $invokeFile -ArgumentList $invokeArgs -NoNewWindow -Wait -PassThru -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
        $out = if (Test-Path $stdoutPath) { Get-Content -Raw -Encoding UTF8 $stdoutPath } else { "" }
        $err = if (Test-Path $stderrPath) { Get-Content -Raw -Encoding UTF8 $stderrPath } else { "" }
        ($out + $err) | Out-File -FilePath $LogPath -Encoding utf8
        return $proc.ExitCode
    } finally {
        if (Test-Path $stdoutPath) { Remove-Item -Force $stdoutPath }
        if (Test-Path $stderrPath) { Remove-Item -Force $stderrPath }
    }
}

function Invoke-ClaudeStep {
    param(
        [Parameter(Mandatory = $true)][string]$ClaudeExe,
        [Parameter(Mandatory = $true)][string]$PromptText,
        [Parameter(Mandatory = $true)][string]$LogPath
    )

    $candidates = @(
        @("-p", "--max-turns", "6", $PromptText),
        @("--print", "--max-turns", "6", $PromptText)
    )

    foreach ($args in $candidates) {
        $code = Invoke-NativeWithLog -FilePath $ClaudeExe -Arguments $args -LogPath $LogPath
        if ($code -eq 0) { return 0 }
    }
    return 1
}

function Invoke-CodexStep {
    param(
        [Parameter(Mandatory = $true)][string]$CodexExe,
        [Parameter(Mandatory = $true)][string]$PromptText,
        [Parameter(Mandatory = $true)][string]$LogPath
    )

    $promptPath = [System.IO.Path]::GetTempFileName()
    $stdoutPath = [System.IO.Path]::GetTempFileName()
    $stderrPath = [System.IO.Path]::GetTempFileName()
    try {
        Set-Content -Path $promptPath -Value $PromptText -Encoding UTF8
        $candidates = @(
            @("exec", "-"),
            @("e", "-")
        )

        foreach ($args in $candidates) {
            $proc = Start-Process -FilePath $CodexExe -ArgumentList $args -NoNewWindow -Wait -PassThru -RedirectStandardInput $promptPath -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
            $out = if (Test-Path $stdoutPath) { Get-Content -Raw -Encoding UTF8 $stdoutPath } else { "" }
            $err = if (Test-Path $stderrPath) { Get-Content -Raw -Encoding UTF8 $stderrPath } else { "" }
            ($out + $err) | Out-File -FilePath $LogPath -Encoding utf8
            if ($proc.ExitCode -eq 0) { return 0 }
        }
        return 1
    } finally {
        if (Test-Path $promptPath) { Remove-Item -Force $promptPath }
        if (Test-Path $stdoutPath) { Remove-Item -Force $stdoutPath }
        if (Test-Path $stderrPath) { Remove-Item -Force $stderrPath }
    }
}

function Read-FileText {
    param([Parameter(Mandatory = $true)][string]$Path)
    return (Get-Content -Raw -Encoding UTF8 $Path)
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
if (!(Test-Path $claudePromptPath)) { throw "Missing required file: $claudePromptPath" }
if (!(Test-Path $codexPromptPath)) { throw "Missing required file: $codexPromptPath" }

$claudeExe = Ensure-Tool -Name "claude"
$codexExe = Ensure-Tool -Name "codex"

for ($i = 1; $i -le $MaxIterations; $i++) {
    $iter = "{0:D2}" -f $i
    Write-Host "=== AUTOPILOT ITERATION $iter ==="

    $claudeLog = Join-Path $logsDir ("claude_plan_iter{0}.txt" -f $iter)
    $codexLog = Join-Path $logsDir ("codex_exec_iter{0}.txt" -f $iter)
    $npmLog = Join-Path $logsDir ("npm_test_iter{0}.txt" -f $iter)
    $smokeLog = Join-Path $logsDir ("runbook_smoke_iter{0}.txt" -f $iter)

    $taskText = Read-FileText -Path $taskPath
    $claudePromptTemplate = Read-FileText -Path $claudePromptPath
    $claudePrompt = @"
$claudePromptTemplate

TASK FILE CONTENT:
$taskText
"@

    $claudeCode = Invoke-ClaudeStep -ClaudeExe $claudeExe -PromptText $claudePrompt -LogPath $claudeLog
    if ($claudeCode -ne 0) {
        throw "Claude step failed at iteration $iter. See $claudeLog"
    }

    $codexTemplate = Read-FileText -Path $codexPromptPath
    $codexPrompt = @"
$codexTemplate

INPUT FILES:
- TASK: $taskPath
- CLAUDE_PLAN_OUTPUT: $claudeLog
"@

    $codexCode = Invoke-CodexStep -CodexExe $codexExe -PromptText $codexPrompt -LogPath $codexLog
    if ($codexCode -ne 0) {
        throw "Codex step failed at iteration $iter. See $codexLog"
    }

    $npmCode = Invoke-NativeWithLog -FilePath "npm.cmd" -Arguments @("test") -LogPath $npmLog
    $smokeCode = Invoke-NativeWithLog -FilePath "npm.cmd" -Arguments @("run", "runbook:smoke") -LogPath $smokeLog

    $npmText = Read-FileText -Path $npmLog
    $ipBlockCount = ([regex]::Matches($npmText, 'temporarily blocked due to repeated violations')).Count

    if ($smokeCode -ne 0) {
        Write-Host "STOP: runbook:smoke failed (iteration $iter)."
        break
    }
    if ($npmCode -eq 0) {
        Write-Host "STOP: npm test passed (iteration $iter)."
        break
    }
    if ($ipBlockCount -eq 0) {
        Write-Host "STOP: IP-block signature disappeared (iteration $iter)."
        break
    }
    if ($ipBlockCount -le $IpBlockMax) {
        Write-Host "STOP: IP-block signature reached threshold ($ipBlockCount <= $IpBlockMax) at iteration $iter."
        break
    }
    if ($i -eq $MaxIterations) {
        Write-Host "STOP: Max iterations reached ($MaxIterations)."
    }
}
