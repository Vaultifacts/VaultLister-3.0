# Atomic state snapshot generator (avoids file-lock issues)
# Output: claude-docs/docs/project-control/STATE_SNAPSHOT.md

$Out = "claude-docs/docs/project-control/STATE_SNAPSHOT.md"
$Dir = Split-Path $Out
New-Item -ItemType Directory -Force -Path $Dir | Out-Null

# Write to a temp file first, then replace
$Tmp = Join-Path $Dir ("STATE_SNAPSHOT.tmp.{0}.md" -f $PID)

function Add-Line([string]$s) { Add-Content -Encoding UTF8 -Path $Tmp -Value $s }
function Add-Section([string]$title) { Add-Line ""; Add-Line "## $title"; Add-Line "-----" }

# Start fresh
Set-Content -Encoding UTF8 -Path $Tmp -Value "# STATE SNAPSHOT"
Add-Line ""
Add-Line ("Generated: {0} UTC" -f (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ"))

Add-Section "Git Status"
git status 2>&1 | ForEach-Object { Add-Line $_ }

Add-Section "Recent Commits (last 15)"
git log -n 15 --oneline 2>&1 | ForEach-Object { Add-Line $_ }

Add-Section "Diff Stat (working tree vs HEAD)"
git diff --stat 2>&1 | ForEach-Object { Add-Line $_ }

Add-Section "Key Diff (U3, first 400 lines)"
git diff -U3 2>&1 | Select-Object -First 400 | ForEach-Object { Add-Line $_ }

Add-Section "Repo Tree (tree /F)"
tree /F 2>&1 | ForEach-Object { Add-Line $_ }

Add-Section "TODO/FIXME Scan (top 200 hits)"
$pattern = "TODO|FIXME|HACK|XXX|NOT IMPLEMENTED|stub|placeholder"
Get-ChildItem -Recurse -File -ErrorAction SilentlyContinue |
  Select-String -Pattern $pattern -ErrorAction SilentlyContinue |
  Select-Object -First 200 |
  ForEach-Object { Add-Line $_.ToString() }

Add-Section "Package Scripts (if present)"
if (Test-Path "package.json") {
  try {
    $pkg = Get-Content package.json -Raw | ConvertFrom-Json
    ($pkg.scripts | ConvertTo-Json -Depth 10) | ForEach-Object { Add-Line $_ }
  } catch {
    Get-Content package.json | ForEach-Object { Add-Line $_ }
  }
} else {
  Add-Line "package.json not found"
}

Add-Line ""
Add-Line "Snapshot generated successfully."

# Replace output atomically (with a few retries in case of brief locks)
$maxAttempts = 8
for ($i = 1; $i -le $maxAttempts; $i++) {
  try {
    Move-Item -Force -Path $Tmp -Destination $Out
    Write-Host "Done. Wrote $Out"
    exit 0
  } catch {
    Start-Sleep -Milliseconds 250
    if ($i -eq $maxAttempts) {
      Write-Error "Failed to write $Out because it's locked. Close anything viewing STATE_SNAPSHOT.md (VS Code/Claude Code preview) and retry."
      Write-Error $_
      exit 1
    }
  }
}