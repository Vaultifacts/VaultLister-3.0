---
name: test
description: Run VaultLister 3.0 test suite — unit, integration, E2E, visual
trigger: /test
---

# /test — VaultLister 3.0 Tests

## Full Suite
```
bun run test:all
```

## Individual Suites

| Suite | Command |
|-------|---------|
| Unit tests | `bun run test:unit` |
| Auth tests | `bun test src/tests/auth.test.js` |
| Security tests | `bun test src/tests/security.test.js` |
| E2E tests | `bun run test:e2e` |
| Visual tests | `node scripts/visual-test.js` |
| Coverage report | `bun run test:coverage` |

## Failure Protocol
- Report all failures verbatim
- Do not auto-fix without user instruction
- Do not delete failing tests to make the suite pass
- Append summary results to `audit-log.md`
- Reference `.test-baseline` for known flaky test count before escalating
