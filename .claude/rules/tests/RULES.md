# Test Rules — VaultLister 3.0
> Auto-loaded by Claude Code when editing files in tests/ or src/tests/. Overrides src/ rules for test files.

## Test Naming
- Unit test files: `[subject].test.js` (Bun:test)
- E2E test files: `[subject].e2e.js` (Playwright)
- Visual tests: handled by `scripts/visual-test.js`
- Test names: "should [expected behavior] when [condition]"

## Test Scope
- Unit tests: test one function or module in isolation; mock all external dependencies (DB, Playwright, Anthropic SDK)
- Integration tests: test one complete API flow (e.g., inventory create → cross-list → analytics update)
- E2E tests: test one complete user workflow end-to-end; use Playwright test fixtures
- Do not write tests for code you did not write or modify in this session

## Critical Test Protocols
- Auth/security: always run `bun test src/tests/auth.test.js src/tests/security.test.js` before any commit
- CSRF: test that all mutating routes reject requests without valid CSRF tokens
- Credential handling: mock all marketplace OAuth tokens in tests — never use real credentials in test fixtures
- SQL injection: test all search/filter inputs confirm they use parameterized queries
- IDOR: test that users cannot access other users' InventoryItems, Listings, or Sales

## Automation Tests
- Playwright bot tests: run against mock HTML fixtures — never against live marketplace websites in CI
- Rate limit tests: verify bots respect minimum delay between actions
- Audit log tests: verify every bot action generates an entry in `data/automation-audit.log`

## Test Failure Protocol
- Run `/test` to surface failures
- Report failures verbatim — do not auto-fix without user instruction
- Do not delete failing tests to make the suite pass
- If a test fails due to missing `.env` var: note this explicitly, do not mask as a code failure
- Test baseline: maintain a `.test-baseline` file with known flaky test count
