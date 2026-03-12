# Core Product Domain — Coverage Audit
**Date:** 2026-03-11
**Auditor:** Claude Code (manual evidence verification)
**Scope:** Core Product domain only — 7 taxonomy categories
**Method:** Read all referenced test files; search for missing cases; no assumptions made

---

## Summary

| Category | Status | Risk | Auto/Manual |
|---|---|---|---|
| Domain Correctness / Business Rules | Partial | High | Partial Automation |
| UI / Interaction Behavior | Partial | High | Partial Automation |
| Accessibility | Partial | Medium | Partial Automation |
| Input / Validation / Parsing | Partial | High | Automated |
| Client / Server State Consistency | Partial | High | Partial Automation |
| Authentication / Session Lifecycle | Covered | High | Automated |
| Authorization / Isolation | Partial | High | Automated |

---

## 1. Domain Correctness and Business Rule Integrity

### Verified Coverage

**Inventory CRUD (basic)** — `src/tests/inventory.test.js`
- POST /inventory creates item (201), auto-generates SKU, rejects missing listPrice (400)
- GET /inventory list, filter by status/category/search/sort, paginate
- GET /inventory/:id returns item, 404 on missing
- PUT /inventory/:id updates item
- DELETE /inventory/:id hard-delete
- **Caveat:** Uses hardcoded demo user credentials (`demo@vaultlister.com`) not isolated per-test users. Tests can fail silently if the demo user doesn't exist or has stale data.

**Listing archive/unarchive state transitions** — `src/tests/listings-archive.test.js:21-62`
- POST /listings/:id/archive → archived state
- POST /listings/:id/unarchive → restored; unarchive on active item → 400
- 404 on nonexistent listing

**Listing sub-features** — `src/tests/listings-gaps-expanded.test.js:14-102`
- Folder CRUD (create, delete)
- Schedule-price-drop, competitor-pricing, time-to-sell — tested as 404 paths only (no happy path with a real listing)
- List, filter by status=active, stats endpoint

**Onboarding flow** — `src/tests/onboarding-expanded.test.js:28-128`
- GET /onboarding/progress, POST with valid role, POST without role (400), POST with invalid role (400)

**Tier permission enforcement** — `src/tests/middleware-auth.test.js:66-102`
- Unit test: free/starter/pro tier checks for listings, aiFeatures, automations
- checkTierPermission() returns correct `allowed` and `limit` values

### Missing / Uncovered

| Gap | Risk | Type |
|---|---|---|
| Cross-listing workflow: the core "cross-list item to platform X" action has no HTTP integration test | High | Automatable |
| Offer state machine: accept/reject/counter/expire transitions have no tests | High | Automatable |
| Sale recording + inventory deduction: marking an item as sold and verifying quantity deduction is untested | High | Automatable |
| Duplicate submission prevention: double-clicking Create/Save is untested at both API and UI layers | High | Automatable (API) / Manual (UI) |
| inventory.test.js uses demo user credentials — tests can silently pass with wrong data if demo user has seeded data; tests are not isolated | Medium | Automatable refactor |
| Offer creation/deletion endpoint coverage: no test for POST /offers, GET /offers, PATCH /offers/:id | High | Automatable |

---

## 2. User Experience, Interface, and Interaction Behavior

### Verified Coverage

**Login / auth E2E flow** — `e2e/tests/auth.spec.js:12-143`
- Login form renders (fields, button visible)
- Invalid credentials → toast-error visible
- Successful login → navigates to #dashboard
- Session persist after page reload → stays on #dashboard
- Logout → redirects to #login
- Accessing protected route unauthenticated → redirect (weak assertion — only checks body visible)

**Inventory page UI** — `e2e/tests/inventory.spec.js:1-80`
- Navigate to inventory page via nav button
- Display items (weak — just checks URL stays on #inventory)
- Search input interaction (conditional, no assertion on results)
- Filter by status (conditional, no assertion on filtered output)
- Statistics section visibility (conditional)
- **Weakness:** All assertions are URL-level only; no assertions on rendered content, row counts, or error states

**Dashboard and error states** — `e2e/tests/qa-guardian.spec.js:28-57`, `e2e/tests/quinn-v3-error-states-audit.spec.js`
- Dashboard renders without blank screen
- API 500 on GET /inventory → error state shown, not blank
- Network timeout → loading states, abort recovery
- Malformed API response → handled
- Auth 401 mid-session → redirect / error display
- Offline → reconnect on online (P4)

### Missing / Uncovered

| Gap | Risk | Type |
|---|---|---|
| Keyboard-only workflow: no test verifies any full workflow (login → navigate → create item → save) can be completed without mouse | High | Manual (initial), Automatable (Playwright) |
| Multi-tab conflict: opening the app in two tabs and making a change in one is untested | Medium | Automatable (Playwright multi-page) |
| Optimistic UI rollback: saving an item, having the server return an error, and verifying the UI reverts is untested | High | Automatable |
| Empty-state assertions: inventory, listings, offers, and analytics empty states have no E2E assertions (only dashboard is partially checked) | Medium | Automatable |
| Form duplicate-click prevention: double-submitting a form (rapid clicks on Save/Create) is untested at E2E layer | High | Automatable |
| Loading-state assertions: no test verifies a spinner appears while fetching data, then disappears when done | Low | Automatable |
| Multi-step flow testing: the cross-listing flow (select item → choose platforms → submit → result) has no E2E coverage | High | Automatable |

---

## 3. Accessibility and Inclusive Use

### Verified Coverage

**axe-core WCAG 2.1 AA scans** — `e2e/tests/accessibility.spec.js:67-119`
- 6 pages scanned: login, register, dashboard, inventory, listings, analytics
- Passes: no *new* critical/serious violations (regression detection only)
- **Critical caveat:** Known violations are baselined and excluded rather than fixed:
  - `color-contrast` — excluded on all 6 pages
  - `label` — excluded on login and register
  - `button-name` — excluded on dashboard and analytics
  - `select-name` — excluded on dashboard, inventory, listings, analytics
  - `aria-required-children` — excluded on analytics
- These are real, live accessibility defects that affect screen reader and low-vision users

**Quinn guardian axe scans** — `e2e/tests/quinn-v3-accessibility-audit.spec.js`
- Additional axe scans with per-page excludes; same baseline-exclusion pattern

### Missing / Uncovered

| Gap | Risk | Type |
|---|---|---|
| Baselined violations are real defects — `color-contrast`, `label`, `button-name`, `select-name` failures exist on every major page and are suppressed rather than remediated | High | Manual fix required |
| Keyboard-only navigation tests: no test exercises Tab/Shift+Tab through a full page, or Enter/Space on interactive elements | High | Automatable (Playwright keyboard) |
| Focus trap tests: no test verifies that modal dialogs trap focus and return focus to trigger on close | High | Automatable |
| Screen reader assertions: no tests verify `aria-label`, `aria-live` announcements, or landmark roles are semantically correct | High | Manual + partial Automation |
| Zoom and reflow tests: no test verifies layout at 200% or 400% zoom, or at narrow (320px) widths | Medium | Automatable |
| Motion sensitivity: no test verifies `prefers-reduced-motion` disables animations | Low | Automatable |

---

## 4. Input, Validation, Parsing, and Content Handling

### Verified Coverage

**Validator unit tests** — `src/tests/validation.test.js:1-218`
- isPresent, isNonEmptyString, isValidNumber, isPositiveNumber, isNonNegativeNumber, isValidInteger, isInRange
- minLength, maxLength, lengthInRange
- isValidEmail, isValidUrl, isValidPhone, isValidDateFormat, isValidISODateTime, isValidUUID, isValidSlug
- isValidPrice, isValidQuantity, isValidSKU, isValidBarcode
- isArray, isNonEmptyArray, arrayMinLength, arrayMaxLength, isObject, hasRequiredKeys, isOneOf, areAllOneOf
- createSchema, Rules

**Helper/sanitize/enum unit tests** — `src/tests/shared-helpers.test.js:1-476`
- parseBoolean, parseIntBounded, parsePagination, buildPaginationMeta, safeJsonParse
- validateRequired, validateLength, validateRange, validateEnum, validateEmail, validateUrl, validateHexColor, validatePrice
- sanitizeString (XSS-relevant input sanitization)
- VALID_PLATFORMS, VALID_CONDITIONS, VALID_INVENTORY_STATUSES, VALID_ORDER_STATUSES enum validation

**Server-side inventory validation (basic)** — `src/tests/inventory.test.js:115-131`
- POST /inventory without listPrice → 400 with error body

**MFA input validation** — `src/tests/mfaLoginFlow.test.js:243-270`
- Invalid/missing TOTP code returns correct rejection

**Password reset validation** — `src/tests/security-expanded.test.js:92-146`
- Forgot password / reset password field validation

### Missing / Uncovered

| Gap | Risk | Type |
|---|---|---|
| Server-side validation for inventory title length, description length, price range: only missing-price tested; max-length, negative-price, XSS-in-title are not tested via HTTP | High | Automatable |
| Unicode, emoji, RTL text input: no test submits Unicode or emoji in title/description fields and verifies correct storage + retrieval | Medium | Automatable |
| Pasted content handling: no test simulates clipboard paste into form fields | Low | Manual |
| Client/server validation consistency: validators in `validation.js` are tested in isolation; no test confirms the same rules are applied at the HTTP layer for inventory, listings, or offers | High | Automatable |
| File input validation: image upload field type/size enforcement has no client-side E2E test coverage | Medium | Automatable |

---

## 5. Client State, Server State, and Cross-Layer Consistency

### Verified Coverage

**Session persistence after reload** — `e2e/tests/auth.spec.js:74-96`
- Login → reload → still on dashboard (token persisted)

**Offline detection and recovery** — `e2e/tests/quinn-v3-error-states-audit.spec.js` (P4)
- Offline detection UI shown; recovers on reconnect

**Auth error mid-session** — `e2e/tests/quinn-v3-error-states-audit.spec.js` (P3)
- 401 response handled (redirect or error display without blank screen)

### Missing / Uncovered

| Gap | Risk | Type |
|---|---|---|
| Optimistic update rollback: create/update item optimistically shown in UI, server returns error, UI should revert — untested | High | Automatable |
| Stale client state: user opens inventory, background change occurs (another session updates an item), client state is never refreshed — not tested | Medium | Manual / Automatable with multi-page |
| Multi-tab consistency: two open tabs; action in tab A should reflect in tab B (via WebSocket or on-focus refresh) — untested | Medium | Automatable (Playwright multi-page) |
| Read-after-write: POST /inventory item then immediately GET /inventory/:id returns the created item — not explicitly tested as a consistency check | Low | Automatable |
| Session expiry mid-workflow: access token expires while user is on the inventory create form; form submit should trigger refresh or graceful redirect — untested | High | Automatable |

---

## 6. Authentication, Identity, Session, and Account Lifecycle

### Verified Coverage

**Token generation and verification (unit)** — `src/tests/middleware-auth.test.js:1-64`
- generateToken, verifyToken, generateRefreshToken
- Tampered token rejected, empty/null rejected, custom expiry

**Access token / refresh rotation (integration)** — `src/tests/tokenLifecycle.test.js:1-110`
- Fresh access token accepted at /auth/me and /inventory
- Garbage / malformed JWT rejected (401)
- Missing Authorization header rejected (401)
- POST /auth/refresh with valid token → new access token
- Refresh rotation: new refresh token ≠ old refresh token
- POST /auth/refresh with invalid token → 401
- New access token from refresh accepted

**Session management (integration)** — `src/tests/sessionManagement.test.js:1-253`
- New user has ≥1 session after registration
- Session shape validation (id, created_at, expires_at, current flag)
- Session does not expose refresh_token
- Sessions ordered by created_at DESC
- 3 logins → 3 additional sessions; unique IDs
- Revoking a specific session removes it; 404 on nonexistent
- Cross-user revocation returns 404
- Revoke-all returns count; leaves ≤2 sessions
- Revoke-all does not affect other users
- Max 10 concurrent sessions enforced; newest survive pruning

**MFA login flow (integration)** — `src/tests/mfaLoginFlow.test.js:1-307`
- MFA-enabled login returns 202 + mfaRequired
- Valid TOTP code → full session token
- Invalid TOTP code → 401
- Missing code → 400
- Backup code consumption
- Replay attack (reuse same backup code → rejected)

**Enhanced MFA (integration)** — `src/tests/enhancedMFA.test.js:1-355`
- WebAuthn setup/verify flow
- SMS MFA setup/verify
- MFA disable requires password
- Backup code regeneration

**Password lifecycle (integration)** — `src/tests/security-expanded.test.js:1-224`
- POST /security/forgot-password: valid/invalid email handling
- POST /security/reset-password: invalid token → 400, valid token → success
- Send verification / verify-email flow
- MFA status endpoint, security events endpoint

### Missing / Uncovered

| Gap | Risk | Type |
|---|---|---|
| Session expiry mid-workflow: no test verifies behavior when a 15-min access token expires while the user is actively using a form (should trigger refresh, not blank screen or silent failure) | High | Automatable |
| Account deletion lifecycle: no test verifies that deleting an account invalidates all sessions and returns 401 on subsequent requests | High | Automatable |
| OAuth / social login lifecycle: no test verifies that OAuth tokens (eBay, Etsy, Poshmark) are stored, refreshed, and revoked correctly | High | Automatable (mocked) |
| Password change does not invalidate existing sessions: no test verifies old sessions become invalid after a password change | High | Automatable |

---

## 7. Authorization, Permissions, Ownership, and Isolation

### Verified Coverage

**Cross-user session isolation** — `src/tests/sessionManagement.test.js:134-141, 224-253`
- User A sessions not visible to User B
- User B cannot revoke User A's sessions (404)
- Revoke-all is scoped to current user only

**Auth guard on routes** — multiple test files
- GET /listings, /onboarding/progress without auth → 401/403
- Security endpoints (send-verification, mfa/status, events, mfa/disable) without auth → 401
- GET /inventory, /automations, /reports, /notifications without auth → 401/403/404

**IDOR read: inventory by ID** — `src/tests/cross-user-auth-expanded.test.js:164-183`
- User B cannot GET /inventory/:id belonging to User A (expects 403/404)
- **Caveat:** Test conditionally skips if item creation fails (no explicit assertion that item was created); silent pass is possible

**IDOR write/delete: inventory** — `src/tests/cross-user-auth-expanded.test.js:122-159`
- User B cannot PUT /inventory/:id belonging to User A (expects 403/404)
- User B cannot DELETE /inventory/:id belonging to User A (expects 403/404)
- Same conditional-skip caveat applies

**Cross-user listing isolation (list-level)** — `src/tests/cross-user-auth-expanded.test.js:32-46`
- User B's GET /listings returns no items from User A's list (IDs do not overlap)
- **Gap:** No IDOR test for GET /listings/:id by direct ID (only list-level isolation verified)

**Tier permission enforcement (unit)** — `src/tests/middleware-auth.test.js:66-102`
- free tier: no AI features, no automations, has listing limit
- starter tier: automations allowed
- pro tier: AI features allowed

### Missing / Uncovered

| Gap | Risk | Type |
|---|---|---|
| IDOR: GET /listings/:id — no test for User B accessing User A's specific listing by direct ID (only list-level isolation is verified) | High | Automatable |
| IDOR: GET /sales/:id, GET /offers/:id — no test for cross-user direct object access on Sale or Offer entities | High | Automatable |
| Pro-tier UI features without API enforcement: no test verifies that a free-tier user who discovers a Pro feature's API endpoint is blocked at the backend (UI-hidden ≠ secured) | High | Automatable |
| IDOR conditional skip quality: the existing IDOR tests in cross-user-auth-expanded.test.js silently pass if item creation fails (no assertion that `itemId` was successfully obtained before proceeding) | Medium | Test quality fix |

---

## High-Risk Gaps Summary

Ranked by severity × likelihood of being untested in production:

1. **Session expiry mid-workflow** (Auth + State) — token expiry during form submission could cause silent data loss or blank screen
2. **Cross-listing workflow untested** (Business Rules) — the primary feature of the product has no integration test
3. **Offer state machine untested** (Business Rules) — accept/reject/counter/expire transitions are critical to reseller workflow
4. **IDOR: listings and sales by direct ID** (Authorization) — list-level isolation is tested but per-ID access is not
5. **Pro-tier API enforcement** (Authorization) — UI-hiding ≠ server enforcement; no test verifies the API rejects free-tier users
6. **Client/server validation consistency** (Input) — validators are unit-tested but not verified to match at HTTP layer
7. **Keyboard-only workflows** (Accessibility + UI) — no test can confirm the app is operable without a mouse
8. **Baselined a11y violations** (Accessibility) — known defects (`color-contrast`, `label`) are suppressed in CI, not fixed
9. **Password change session invalidation** (Auth) — existing sessions likely survive a password change
10. **Duplicate form submission** (UI + Business Rules) — double-submit can create duplicate inventory items or listings

---

## Notes on Test Quality Issues (Not Coverage Gaps, but Affect Reliability)

- `inventory.test.js` uses hardcoded `demo@vaultlister.com` credentials; if demo user is absent or has no data, tests pass vacuously or fail for the wrong reason. Should use `createTestUserWithToken()` pattern.
- IDOR tests in `cross-user-auth-expanded.test.js` use `if (createStatus === 201 || 200)` guard without an explicit assertion — conditional passes are indistinguishable from genuine passes in CI output.
- Several listings-gaps-expanded tests accept `[400, 404, 500]` as passing — 500 should never be an acceptable outcome in a passing test.
- `inventory.spec.js` E2E tests use `waitForTimeout(2000)` polling and URL-only assertions; they are fragile and provide minimal signal about actual rendered content.
