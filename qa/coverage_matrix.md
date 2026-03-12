# QA Coverage Matrix

Update this file after each audit/generation pass.

## Status Legend
- Covered
- Partial
- Manual Required
- Uncovered

## Automation Legend
- Automated
- Partial Automation
- Manual Only
- Not Determined

| Domain | Category | Status | Automation | Risk | Evidence | Missing Coverage | Last Updated |
|---|---|---|---|---|---|---|---|
| Core Product | Business logic | Partial | Automated | High | src/tests/inventory.test.js:87-151 (CRUD create/update/delete), src/tests/listings-archive.test.js:22-62 (archive/unarchive state), src/tests/listings-gaps-expanded.test.js:14-102 (list/filter/folders), src/tests/onboarding-expanded.test.js:13-128 (onboarding flow), src/tests/middleware-auth.test.js:66-102 (tier checks), src/tests/offers-state-machine.test.js:123-283 (accept/decline/counter state transitions, double-response prevention, counter amount validation) | No tests for cross-listing workflow (core feature); no sale recording + inventory deduction test; no duplicate submission prevention; inventory.test.js uses hardcoded demo credentials — not isolated | 2026-03-12 |
| Core Product | UI / interaction behavior | Partial | Partial Automation | High | e2e/tests/auth.spec.js:12-143 (login/logout/persist/protected redirect), e2e/tests/inventory.spec.js:1-80 (navigate/display/search/filter — URL-level only), e2e/tests/qa-guardian.spec.js:28-57 (dashboard), e2e/tests/quinn-v3-error-states-audit.spec.js (500 error, timeout, malformed response, 401 mid-session, offline recovery) | No keyboard-only workflow tests; no multi-tab conflict tests; no optimistic update rollback tests; empty-state assertions absent for all screens except dashboard; form duplicate-click prevention untested; inventory E2E assertions are URL-only with no content verification | 2026-03-11 |
| Core Product | Accessibility | Partial | Partial Automation | Medium | e2e/tests/accessibility.spec.js:67-119 (axe WCAG 2.1 AA — 6 pages), e2e/tests/quinn-v3-accessibility-audit.spec.js (guardian axe scans) | Known violations baselined and suppressed in CI on every scanned page (color-contrast, label, button-name, select-name) — real defects not fixed; no keyboard-only navigation tests; no focus trap tests for modals; no screen reader assertion tests; no zoom/reflow tests | 2026-03-11 |
| Core Product | Input / validation / parsing | Covered | Automated | High | src/tests/validation.test.js:1-218 (unit — all validators), src/tests/shared-helpers.test.js:1-476 (unit — helpers, sanitize, enums), src/tests/inventory.test.js:115-131 (POST /inventory missing field → 400), src/tests/inventory-validation-http.test.js (HTTP-layer: title/price/condition/quantity boundary cases, XSS strip, auth guard — 22 tests), src/tests/mfaLoginFlow.test.js:243-270 (MFA input validation), src/tests/security-expanded.test.js:92-146 (password reset validation) | No Unicode/emoji/RTL input tests; no pasted-content tests; listings/offers HTTP-layer field validation not yet verified | 2026-03-12 |
| Core Product | State consistency | Partial | Partial Automation | High | e2e/tests/auth.spec.js:74-96 (session persist after reload), e2e/tests/quinn-v3-error-states-audit.spec.js (P4 offline recovery, P3 auth 401 handling), src/tests/offers-state-machine.test.js:262-283 (double-response prevention) | No optimistic update rollback tests; no stale client state tests; no multi-tab consistency tests; no read-after-write verification | 2026-03-12 |
| Core Product | Authentication / session lifecycle | Covered | Automated | High | src/tests/middleware-auth.test.js:1-64 (token gen/verify unit), src/tests/tokenLifecycle.test.js:1-110 (access/refresh rotation integration), src/tests/sessionManagement.test.js:1-253 (list/revoke/max-limit/cross-user isolation), src/tests/mfaLoginFlow.test.js:1-307 (TOTP, backup codes, replay), src/tests/enhancedMFA.test.js:1-355 (WebAuthn, SMS, disable), src/tests/security-expanded.test.js:1-224 (forgot/reset password, verify email), src/tests/session-lifecycle-gaps.test.js (expired JWT on 3 endpoints, password change invalidates sessions, revoke-all blocks refresh — 10 tests) | No account deletion lifecycle test; no OAuth login lifecycle test | 2026-03-12 |
| Core Product | Authorization / isolation | Covered | Automated | High | src/tests/sessionManagement.test.js:134-141, 224-253 (cross-user session isolation), src/tests/cross-user-auth-expanded.test.js:16-264 (list-level isolation: inventory/listings/automations/reports/webhooks/notifications; IDOR write/delete/read for inventory; IDOR read for orders/listings/sales; auth guards; invalid/expired token rejection), src/tests/offers-state-machine.test.js:113-118,151-155,194-198,252-256 (IDOR for all offer actions), src/tests/middleware-auth.test.js:66-102 (tier enforcement) | Pro-tier features not verified to be blocked at API layer; some IDOR tests use conditional skips (silent pass if item creation fails) | 2026-03-12 |
| Data Systems | Test data realism / quality | Uncovered | Not Determined | Low | No formal seed data validation or Unicode/emoji tests | No export endpoints implemented; defer until test infra matures | 2026-03-12 |
| Data Systems | Database / persistence correctness | Covered | Automated | High | src/tests/data-systems-db-constraints.test.js:1-340 (UNIQUE: email/username/shops/analytics/listings gap; CHECK: inventory status/condition, listings status, offers status; FK CASCADE: user→sessions, user→inventory, listing→offers; FK SET NULL: inventory→sales; FTS5 triggers: insert/update/delete-bug; cleanupExpiredData — 21 tests) | Statement cache LRU eviction untested (low risk); WAL mode concurrency untested (manual) | 2026-03-12 |
| Data Systems | Data integrity / migration / reconciliation | Partial | Partial Automation | High | src/tests/data-systems-db-constraints.test.js:135-145 (listings UNIQUE gap documented); src/tests/dataIntegrity.test.js (cross-user isolation) | No migration rollback tests (SQLite append-only — manual); no orphan record detection; listings UNIQUE constraint absent from live DB (BUG-3); no inventory-count vs listings-count reconciliation | 2026-03-12 |
| Data Systems | Search / filtering / reporting | Partial | Partial Automation | Medium | src/tests/data-systems-db-constraints.test.js:262-340 (FTS5 insert/update/delete triggers, brand indexing); src/tests/dataIntegrity.test.js (basic FTS5 search) | FTS5 hyphen handling causes "no such column" errors (known); pre-existing FTS5 index corruption (stale rowids); escapeLike() not directly tested; search result ordering untested | 2026-03-12 |
| Data Systems | Files / imports / exports | Uncovered | Manual Only | Medium | none | No CSV/JSON export endpoints implemented yet; no image upload tests; no backup file integrity tests — defer until export feature is built | 2026-03-12 |
| Data Systems | Financial / numerical correctness | Covered | Automated | High | src/tests/data-systems-net-profit.test.js:1-300 (net_profit formula: no-fee/platform-fee/shipping/all-fees/sellerShippingCost override; round-trip persistence; sale_price/platform_fee storage; validation: missing salePrice/platform/invalid platform → 400; purchase precision: floating-point, mixed fractional, total with shipping+tax; negative/empty guards; sales list: platform filter, date filter, pagination — 22 tests) | FIFO cost layer query blocked by BUG-2 (sales.js references non-existent user_id on inventory_cost_layers); no multi-currency tests | 2026-03-12 |
| Architecture & Reliability | API / protocol / contracts | Uncovered | Not Determined | High | none yet | audit not run | YYYY-MM-DD |
| Architecture & Reliability | Integrations / dependencies | Uncovered | Not Determined | High | none yet | audit not run | YYYY-MM-DD |
| Architecture & Reliability | Reliability / failure modes / recovery | Uncovered | Not Determined | High | none yet | audit not run | YYYY-MM-DD |
| Architecture & Reliability | Async / messaging / distributed behavior | Uncovered | Not Determined | High | none yet | audit not run | YYYY-MM-DD |
| Architecture & Reliability | Caching / CDN / proxy behavior | Uncovered | Not Determined | Medium | none yet | audit not run | YYYY-MM-DD |
| Architecture & Reliability | Observability / alerting | Uncovered | Not Determined | High | none yet | audit not run | YYYY-MM-DD |
| Security & Governance | Security / abuse resistance | Uncovered | Not Determined | High | none yet | audit not run | YYYY-MM-DD |
| Security & Governance | Privacy / compliance / auditability | Uncovered | Not Determined | High | none yet | audit not run | YYYY-MM-DD |
| Security & Governance | Offboarding / decommissioning | Uncovered | Not Determined | Medium | none yet | audit not run | YYYY-MM-DD |
| Security & Governance | Moderation / trust / safety | Uncovered | Not Determined | Medium | none yet | audit not run | YYYY-MM-DD |
| Security & Governance | Human/manual recovery workflows | Uncovered | Not Determined | Medium | none yet | audit not run | YYYY-MM-DD |
| Security & Governance | Ecosystem / contractual expectations | Uncovered | Not Determined | Medium | none yet | audit not run | YYYY-MM-DD |
| Security & Governance | Severity / blast radius / recoverability | Uncovered | Not Determined | High | none yet | audit not run | YYYY-MM-DD |
| Environment & Quality | Localization / regional behavior | Uncovered | Not Determined | Medium | none yet | audit not run | YYYY-MM-DD |
| Environment & Quality | Time / scheduling / expiry | Uncovered | Not Determined | High | none yet | audit not run | YYYY-MM-DD |
| Environment & Quality | Performance / capacity | Uncovered | Not Determined | High | none yet | audit not run | YYYY-MM-DD |
| Environment & Quality | Compatibility / environment coverage | Uncovered | Not Determined | Medium | none yet | audit not run | YYYY-MM-DD |
| Environment & Quality | AI/ML/ranking assurance | Uncovered | Not Determined | Medium | none yet | audit not run | YYYY-MM-DD |
| Environment & Quality | Documentation / runbooks | Uncovered | Not Determined | Medium | none yet | audit not run | YYYY-MM-DD |
| Environment & Quality | Exploratory / fuzz / chaos discovery | Uncovered | Not Determined | Medium | none yet | audit not run | YYYY-MM-DD |
| Environment & Quality | Oracles / invariants / reference truth | Uncovered | Not Determined | High | none yet | audit not run | YYYY-MM-DD |
| Infrastructure & Delivery | Requirements / scope / acceptance integrity | Uncovered | Not Determined | Medium | none yet | audit not run | YYYY-MM-DD |
| Infrastructure & Delivery | Setup / bootstrap / provisioning | Uncovered | Not Determined | Medium | none yet | audit not run | YYYY-MM-DD |
| Infrastructure & Delivery | Deployment / release / config | Uncovered | Not Determined | High | none yet | audit not run | YYYY-MM-DD |
| Infrastructure & Delivery | Build / packaging / supply chain | Uncovered | Not Determined | High | none yet | audit not run | YYYY-MM-DD |
| Infrastructure & Delivery | CI/CD / test harness | Uncovered | Not Determined | High | none yet | audit not run | YYYY-MM-DD |
| Infrastructure & Delivery | Admin / operator / internal tooling | Uncovered | Not Determined | High | none yet | audit not run | YYYY-MM-DD |
| Infrastructure & Delivery | Infrastructure / runtime failures | Uncovered | Not Determined | High | none yet | audit not run | YYYY-MM-DD |
| Infrastructure & Delivery | Backup / restore / DR | Uncovered | Not Determined | High | none yet | audit not run | YYYY-MM-DD |
| Infrastructure & Delivery | Coverage model assurance | Uncovered | Not Determined | High | none yet | audit not run | YYYY-MM-DD |