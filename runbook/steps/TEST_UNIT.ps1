param(
    [switch]$Force
)

. "$PSScriptRoot/../_bootstrap.ps1"
. "$PSScriptRoot/../_state.ps1"
. "$PSScriptRoot/../_helpers.ps1"

$StepName = "TEST_UNIT"
$State = Get-RunbookState
$EvidenceRel = "docs/evidence/TEST_UNIT.md"
$EvidenceFailRel = "docs/evidence/TEST_UNIT_FAIL.md"
$serverProcess = $null
$setupOutput = ""
$testOutput = ""
$teardownOutput = ""
$setupExitCode = -1
$exitCode = -1
$teardownExitCode = -1

try {
    Set-Location $RepoRoot

    $setupCommand = "pre-stop + direct test server start"
    $commandUsed = "cmd.exe /d /c `"set NODE_ENV=test&&set PORT=3001&&set TEST_BASE_URL=http://localhost:3001&&set DISABLE_RATE_LIMIT=true&&set DISABLE_CSRF=true&& bun test`""
    $teardownCommand = "stop direct test server + bun run dev:stop"
    $serverStdOutPath = Join-Path $RepoRoot "docs/evidence/TEST_UNIT_SERVER.out.log"
    $serverStdErrPath = Join-Path $RepoRoot "docs/evidence/TEST_UNIT_SERVER.err.log"

    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $preStopOutput = (& cmd.exe /d /c "bun run dev:stop" 2>&1 | Out-String)
        $serverCommand = "Set-Location '$RepoRoot'; `$env:NODE_ENV='test'; `$env:PORT='3001'; `$env:TEST_BASE_URL='http://localhost:3001'; `$env:DISABLE_RATE_LIMIT='true'; `$env:DISABLE_CSRF='true'; bun run src/backend/server.js"
        $serverProcess = Start-Process -FilePath "powershell" -ArgumentList @("-NoProfile", "-Command", $serverCommand) -PassThru -RedirectStandardOutput $serverStdOutPath -RedirectStandardError $serverStdErrPath
        $setupOutput = @(
            "--- Pre-stop ---",
            $preStopOutput.TrimEnd(),
            "",
            "--- Start Command ---",
            $serverCommand,
            "",
            "--- Server PID ---",
            "$(if($serverProcess){$serverProcess.Id}else{'N/A'})",
            "",
            "--- Server Logs ---",
            "stdout: $serverStdOutPath",
            "stderr: $serverStdErrPath"
        ) -join "`n"
        $setupExitCode = 0
    }
    finally {
        $ErrorActionPreference = $prevEap
    }
    if ($setupExitCode -ne 0) {
        throw "$setupCommand failed with exit code $setupExitCode.`n$setupOutput"
    }

    $healthReady = $false
    $healthAttempts = 0
    while ($healthAttempts -lt 90 -and -not $healthReady) {
        $healthAttempts++
        $client = $null
        try {
            $client = New-Object System.Net.Sockets.TcpClient
            $async = $client.BeginConnect("127.0.0.1", 3001, $null, $null)
            if ($async.AsyncWaitHandle.WaitOne(1000, $false) -and $client.Connected) {
                $healthReady = $true
            }
        }
        catch {
            $healthReady = $false
        }
        finally {
            if ($client) { $client.Close() }
        }
        if (-not $healthReady) {
            Start-Sleep -Seconds 1
        }
    }
    if (-not $healthReady) {
        throw "Test server did not open TCP port 3001 within timeout."
    }

    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $testOutput = (& cmd.exe /d /c "set NODE_ENV=test&&set PORT=3001&&set TEST_BASE_URL=http://localhost:3001&&set DISABLE_RATE_LIMIT=true&&set DISABLE_CSRF=true&& bun test" 2>&1 | Out-String)
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $prevEap
    }

    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $teardownParts = @()
        if ($serverProcess -and -not $serverProcess.HasExited) {
            Stop-Process -Id $serverProcess.Id -Force
            $teardownParts += "Stopped server PID $($serverProcess.Id)"
        }
        $postStopOutput = (& cmd.exe /d /c "bun run dev:stop" 2>&1 | Out-String)
        $teardownParts += $postStopOutput.TrimEnd()
        $teardownOutput = $teardownParts -join "`n"
        $teardownExitCode = 0
    }
    finally {
        $ErrorActionPreference = $prevEap
    }

    $output = @(
        "--- Setup Command ---",
        $setupCommand,
        $setupOutput.TrimEnd(),
        "",
        "--- Test Command ---",
        $commandUsed,
        $testOutput.TrimEnd(),
        "",
        "--- Teardown Command ---",
        $teardownCommand,
        $teardownOutput.TrimEnd()
    ) -join "`n"

    if ($exitCode -ne 0) {
        throw "$commandUsed failed with exit code $exitCode.`n$output"
    }

    $content = @(
        "# TEST_UNIT",
        "",
        "- Date: $(Get-Date -Format o)",
        "- RepoRoot: $RepoRoot",
        "- Command: $commandUsed",
        "- Exit code: $exitCode",
        "- Setup exit code: $setupExitCode",
        "- Teardown exit code: $teardownExitCode",
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
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $teardownParts = @()
        if ($serverProcess -and -not $serverProcess.HasExited) {
            Stop-Process -Id $serverProcess.Id -Force
            $teardownParts += "Stopped server PID $($serverProcess.Id)"
        }
        $teardownAttempt2 = (& cmd.exe /d /c "bun run dev:stop" 2>&1 | Out-String)
        $teardownParts += $teardownAttempt2.TrimEnd()
        $teardownAttempt = $teardownParts -join "`n"
    }
    finally {
        $ErrorActionPreference = $prevEap
    }
    $content = @(
        "# TEST_UNIT FAIL",
        "",
        "- Date: $(Get-Date -Format o)",
        "- RepoRoot: $RepoRoot",
        "- Command: cmd.exe /d /c `"set NODE_ENV=test&&set PORT=3001&&set TEST_BASE_URL=http://localhost:3001&&set DISABLE_RATE_LIMIT=true&&set DISABLE_CSRF=true&& bun test`"",
        "- Status: FAIL",
        "- Error: $err",
        "",
        "## Teardown Attempt",
        "",
        '```',
        $teardownAttempt.TrimEnd(),
        '```'
    ) -join "`n"
    Write-Evidence -Path $EvidenceFailRel -Content $content
    $State = Mark-Step -State $State -StepName $StepName -Status "FAIL" -EvidencePath $EvidenceFailRel -Meta @{ error = $err; force = [bool]$Force }
    Update-Dashboard -State $State
    throw
}
