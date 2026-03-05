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

    if ($InputObject -is [System.Collections.IEnumerable] -and -not ($InputObject -is [string])) {
        $arr = @()
        foreach ($item in $InputObject) {
            $arr += ,(ConvertTo-PlainHashtable -InputObject $item)
        }
        return $arr
    }

    $props = @()
    if ($InputObject.PSObject) {
        $props = @($InputObject.PSObject.Properties | Where-Object { $_.MemberType -ne "Method" })
    }
    if ($props.Length -gt 0) {
        $hash = @{}
        foreach ($prop in $props) {
            $hash[$prop.Name] = ConvertTo-PlainHashtable -InputObject $prop.Value
        }
        return $hash
    }

    return $InputObject
}

function Get-RunbookState {
    $statePath = Join-Path $RepoRoot "docs/evidence/runbook_state.json"
    if (!(Test-Path $statePath)) {
        return @{
            version = 1
            steps = @{}
        }
    }

    $raw = Get-Content $statePath -Raw -Encoding UTF8
    if ([string]::IsNullOrWhiteSpace($raw)) {
        return @{
            version = 1
            steps = @{}
        }
    }

    $loaded = ConvertTo-PlainHashtable -InputObject ($raw | ConvertFrom-Json)
    if (-not $loaded.ContainsKey("version")) { $loaded["version"] = 1 }
    if (-not $loaded.ContainsKey("steps")) { $loaded["steps"] = @{} }
    if ($null -eq $loaded["steps"]) { $loaded["steps"] = @{} }
    return $loaded
}

function Save-RunbookState {
    param(
        [hashtable]$State
    )
    $statePath = Join-Path $RepoRoot "docs/evidence/runbook_state.json"
    $json = $State | ConvertTo-Json -Depth 20
    Set-Content -Path $statePath -Value $json -Encoding UTF8
}

function Should-RunStep {
    param(
        [hashtable]$State,
        [string]$StepName,
        [bool]$Force
    )
    if ($Force) { return $true }
    if (-not $State["steps"].ContainsKey($StepName)) { return $true }
    return ($State["steps"][$StepName]["status"] -ne "PASS")
}

function Mark-Step {
    param(
        [hashtable]$State,
        [string]$StepName,
        [string]$Status,
        [string]$EvidencePath,
        [hashtable]$Meta = @{}
    )
    $State["steps"][$StepName] = @{
        status = $Status
        timestamp = (Get-Date).ToString("o")
        evidence = $EvidencePath
        meta = $Meta
    }
    Save-RunbookState -State $State
    return $State
}
