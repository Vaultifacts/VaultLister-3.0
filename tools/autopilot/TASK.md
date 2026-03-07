# Round-Robin Autopilot Task

## Current Task
Reduce bcrypt rounds in `provisionLocalUserToken` from 12 to 1 in test mode.

When 264 test files run concurrently via `npm test`, all their `beforeAll` hooks call
`provisionLocalUserToken` simultaneously. Each call does `await bcrypt.hash(password, 12)`
which takes ~400ms of CPU per hash. With 264 concurrent hashes, the event loop is
saturated at startup — this causes HTTP login calls and subsequent API requests to time
out, producing 401s that cascade into hundreds of named test failures.

Individual test files pass fine in isolation. The failures are purely a concurrency-at-
startup problem caused by CPU saturation from 264 simultaneous bcrypt-12 hashes.

Focus on failures matching:
- test failures where status 401 is received but not expected (caused by invalid/expired token)

Root cause: `provisionLocalUserToken` in `src/tests/helpers/auth.helper.js` always uses
`bcrypt.hash(password, 12)` regardless of environment. In test mode, password correctness
is irrelevant for local provisioning (the user is created in DB and a JWT is minted
directly — the password is never verified by the server for these locally-provisioned tokens).

Fix approach (test-only, minimal):
- In `provisionLocalUserToken`, detect test mode and use 1 bcrypt round instead of 12:

  ```js
  const bcryptRounds = (process.env.NODE_ENV === 'test') ? 1 : 12;
  const passwordHash = await bcrypt.hash(password, bcryptRounds);
  ```

- This reduces the CPU spike at test startup from ~400ms × 264 concurrent hashes
  to ~1ms × 264, eliminating the saturation that causes cascading failures.
- Do NOT modify any route handler or production code.
- Do NOT change bcrypt rounds anywhere in `src/backend/` — only in the test helper.

## Target Signature
TargetSignatureRegex: Expected to contain.*401|401.*Expected to contain
TargetThreshold: 0

## Scope Rules
- Keep production behavior unchanged.
- Any bypass or softening must apply only in test mode.
- Use minimal, PR-like patches each iteration.
- Always write clear logs and a concise next-step recommendation.

## Contracts (Do Not Break)
- Do not change runbook/gate commands.
- Do not change evidence contract paths:
  - `docs/evidence/RUNBOOK_CHECKLIST.md`
  - `docs/evidence/RUNBOOK_DASHBOARD.md`
  - `docs/evidence/runbook_state.json`
  - `docs/evidence/GATE_EVALUATION.json`
- Do not change gate doc paths:
  - `claude-docs/docs/project-control/COMPLETION_GATES.md`
  - `claude-docs/docs/project-control/QUALITY_GATES.md`
- Do not change `scripts/lib/gate-evaluator.mjs` exported API:
  - `evaluateGates`
  - `renderCompletionGates`
  - `renderQualityGates`
  - `renderFinalAudit`

## Iteration Validation (Required Every Iteration)
1. `npm test`
2. `npm run runbook:smoke`

## Stop Conditions
- `npm test` exits `0`
- OR target signature count reaches threshold from task settings
- OR `npm run runbook:smoke` fails
- OR max iterations reached
