# Repo Hardening Action Plan V2.3

## Repo-Aligned Corrections

- `/api/workers/health` is payload-only on the wire. The Phase 1 contract applies to the public JSON body returned by the route, not to the internal `{ status, data }` handler structure.
- The blocking smoke gate is Playwright-only and smoke-only. It does not include `bun:test` files or broader exploratory E2E suites.

## Phase 1 Scope

- Shared `.test-baseline` parsing across local hook, CI, and deploy workflows
- Blocking Playwright smoke gate in CI and deploy
- App and worker observability hardening
- Repo hygiene fixes for lint and operator documentation

## Baseline Rules

- Keep `.test-baseline` as a single file
- Canonical tokens remain:
  - `KNOWN_FAILURES=<n>`
  - `KNOWN_FAIL: <name>`
- Ignore comments, blank lines, and future `[section]` headers
- Normalize bun failure names by stripping trailing timing suffixes
- Fail on named regressions or counts above baseline

## Smoke Manifest

Phase 1 blocking smoke command:

```bash
bun run test:e2e:smoke
```

Smoke-only Playwright specs:

- `e2e/tests/smoke-auth.spec.js`
- `e2e/tests/smoke-settings.spec.js`
- `e2e/tests/smoke-integrations.spec.js`
- `e2e/tests/smoke-listing-create.spec.js`
- `e2e/tests/smoke-listing-draft.spec.js`
- `e2e/tests/smoke-listing-publish-safe.spec.js`

## Worker Health Contract

Phase 1 public response:

```json
{
  "version": "v1",
  "overall": "ok | degraded",
  "timestamp": "ISO-8601",
  "workers": {
    "taskWorker": {
      "status": "ok | starting | stale | stopped",
      "lastRun": "ISO-8601 | null",
      "intervalMs": 10000,
      "staleThresholdMs": 30000
    }
  }
}
```

Current worker keys:

- `taskWorker`
- `gdprWorker`
- `priceCheckWorker`
- `emailPollingWorker`
- `tokenRefreshScheduler`

## Acceptance Criteria

- `.husky/pre-push`, `ci.yml`, and `deploy.yml` all use the shared baseline parser
- CI and deploy both block on `bun run test:e2e:smoke`
- `src/backend/server.js` initializes monitoring exactly once before serving traffic
- `worker/index.js` reports uncaught exceptions, unhandled rejections, and failed jobs through monitoring
- `scripts/launch-ops-check.mjs` validates `version: "v1"` and the full worker health field set
- `bun run lint` and `bun run lint:syntax` succeed against real frontend entrypoints
