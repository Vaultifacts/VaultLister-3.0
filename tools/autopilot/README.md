# Round-Robin Autopilot

## Run

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/autopilot/run-roundrobin.ps1
```

## What It Does
- Runs Claude as planner/reviewer in print mode.
- Runs Codex as executor in non-interactive mode.
- Runs validations each iteration:
  - `npm test`
  - `npm run runbook:smoke`
- Logs everything to `tools/autopilot/logs/`.
- Stops when one stop condition is reached.

## Stop Conditions
- `npm test` passes
- OR IP-block signature disappears from npm output
- OR `runbook:smoke` fails
- OR max iterations reached

