# VaultLister 3.0 — Prioritized Remediation Plan
**Date:** 2026-03-12
**Source:** Final QA Master Report + 6 domain audits + 6 generation reports
**Scope:** Top 20 issues ranked by production risk, grouped into 4 implementation phases

---

## Top 20 Issues (Ranked by Risk)

### 1. REM-01: Cross-listing workflow has zero integration tests
- **Domain:** Core Product
- **Audit ref:** Core Product audit — High-Risk Gap #2
- **Risk:** Critical
- **Impact:** Reliability — the product's primary feature (listing to 9 marketplaces) has no automated regression protection. A single broken code path affects all users.
- **Recommended fix:** Create an integration test that exercises the cross-listing flow end-to-end: create inventory item → select platforms → generate listings → verify listing records created with correct platform/status. Mock marketplace API calls but use real DB.
- **Files involved:** `src/backend/routes/listings.js`, `src/backend/routes/inventory.js`, `src/backend/services/platformSync/*.js`, `src/tests/` (new file)
- **Complexity:** Large
- **Change type:** Code change (new test file)
- **Isolation:** Can be done in isolation — no schema or infra changes needed

---

### 2. REM-02: `expect([200,500])` anti-pattern in 30+ test files
- **Domain:** Architecture & Reliability
- **Audit ref:** Architecture audit — H17; Reliability gap #1
- **Risk:** Critical
- **Impact:** Reliability — tests that accept HTTP 500 as passing create false coverage confidence. Real regressions pass CI silently.
- **Recommended fix:** Audit all test files containing `expect([200, 500])` or similar patterns. Replace each with the specific expected status code. Where a test genuinely can return multiple codes, split into separate test cases with distinct assertions.
- **Files involved:** 30+ files in `src/tests/` (see `infra-coverage-model.test.js` anti-pattern scan for full list)
- **Complexity:** Large (volume, not difficulty)
- **Change type:** Code change (test cleanup)
- **Isolation:** Can be done in isolation — test-only changes, no production code affected

---

### 3. REM-03: `legal.js` data export leaked `password_hash` and `oauth_access_token`
- **Domain:** Security & Governance
- **Audit ref:** Security audit — H5/H15; Generation — Bug #1
- **Risk:** Critical
- **Impact:** Security — PII/credential exposure via the data export endpoint. User data exports could contain password hashes and OAuth tokens.
- **Recommended fix:** **FIXED** during QA — `redactRow()` applied. Verify fix persists and add regression test.
- **Files involved:** `src/backend/routes/legal.js`
- **Complexity:** Small (already fixed)
- **Change type:** Code change (verified)
- **Isolation:** Fixed in isolation

---

### 4. REM-04: No prompt injection protection in AI inputs
- **Domain:** Security & Governance
- **Audit ref:** Security audit — H1; Environment audit — H29
- **Risk:** High
- **Impact:** Security — user content is passed directly to the Anthropic API with only `<` escaping. Malicious input could manipulate AI behavior, extract system prompts, or generate harmful content.
- **Recommended fix:** Add input sanitization layer in `src/shared/ai/` before all Claude API calls. Implement: (1) strip known prompt injection patterns, (2) add system prompt boundary markers, (3) limit user input length, (4) add output validation.
- **Files involved:** `src/shared/ai/listing-generator.js`, `src/shared/ai/image-analyzer.js`, `src/shared/ai/` (new sanitizer module)
- **Complexity:** Medium
- **Change type:** Code change
- **Isolation:** Can be done in isolation

---

### 5. REM-05: `DISABLE_CSRF` env var can bypass all CSRF protection
- **Domain:** Security & Governance
- **Audit ref:** Security audit — H7; Final report — Risk #6
- **Risk:** High
- **Impact:** Security — setting `DISABLE_CSRF=true` in production disables all CSRF protection with no warning. Could be accidentally set in staging or production.
- **Recommended fix:** Add a production guard: if `NODE_ENV=production` and `DISABLE_CSRF=true`, log a critical warning and refuse to start (or force-enable CSRF). Add env validation in `src/backend/env.js`.
- **Files involved:** `src/backend/middleware/csrf.js`, `src/backend/env.js`
- **Complexity:** Small
- **Change type:** Code change
- **Isolation:** Can be done in isolation

---

### 6. REM-06: No key rotation mechanism for JWT_SECRET or OAUTH_ENCRYPTION_KEY
- **Domain:** Security & Governance
- **Audit ref:** Security audit — H41; Final report — Risk #7
- **Risk:** High
- **Impact:** Security — a compromised JWT_SECRET allows forging all tokens indefinitely. A compromised OAUTH_ENCRYPTION_KEY exposes all marketplace OAuth tokens. No rotation path exists.
- **Recommended fix:** (1) Support dual-key verification for JWT (accept old + new key during rotation window). (2) Add a re-encryption script for OAUTH_ENCRYPTION_KEY that decrypts with old key and re-encrypts with new key. (3) Document rotation procedure in runbook.
- **Files involved:** `src/backend/middleware/auth.js`, `src/backend/services/encryption.js`, `scripts/` (new rotation script), `docs/DEPLOYMENT_RUNBOOK.md`
- **Complexity:** Large
- **Change type:** Code change + documentation
- **Isolation:** Requires coordinated deployment — rotation window must be planned

---

### 7. REM-07: CI lint `node --check` hangs on ESM files
- **Domain:** Infrastructure & Delivery
- **Audit ref:** Infrastructure audit — H7/H10; Final report — Risk #4
- **Risk:** High
- **Impact:** Operational — `node --check` in ci.yml hangs on ESM files, potentially causing CI timeout or silent failure on every push.
- **Recommended fix:** Replace `node --check` with `bun --check` or remove the syntax check step entirely (Bun's test runner catches syntax errors). Update ci.yml.
- **Files involved:** `.github/workflows/ci.yml`
- **Complexity:** Small
- **Change type:** Infrastructure change
- **Isolation:** Can be done in isolation

---

### 8. REM-08: No deploy rollback mechanism
- **Domain:** Infrastructure & Delivery
- **Audit ref:** Infrastructure audit — H4; Final report — Risk #5
- **Risk:** High
- **Impact:** Operational — `deploy.yml` pulls a new container but has no rollback step if the health check fails after 60s. A failed deploy leaves production in a degraded state.
- **Recommended fix:** Add rollback step to deploy.yml: (1) tag current running image before pull, (2) if health check fails, restore previous image tag, (3) send failure notification. Alternatively, use Docker Compose with previous image pinning.
- **Files involved:** `.github/workflows/deploy.yml`, `docker-compose.yml`
- **Complexity:** Medium
- **Change type:** Infrastructure change
- **Isolation:** Requires deployment planning — test in staging first

---

### 9. REM-09: FIFO cost query returned wrong batch order
- **Domain:** Data Systems
- **Audit ref:** Data Systems audit — BUG-2; Generation — Bug #2
- **Risk:** High
- **Impact:** Data integrity — `ORDER BY created_at DESC` returned newest cost layers first instead of oldest, causing incorrect FIFO cost calculations for all sales with cost layers.
- **Recommended fix:** **FIXED** during QA — changed to `ORDER BY created_at ASC`. Verify fix persists.
- **Files involved:** `src/backend/routes/sales.js`
- **Complexity:** Small (already fixed)
- **Change type:** Code change (verified)
- **Isolation:** Fixed in isolation

---

### 10. REM-10: FTS5 delete trigger missing `rowid`
- **Domain:** Data Systems
- **Audit ref:** Data Systems audit — BUG-1
- **Risk:** High
- **Impact:** Data integrity — deleted inventory rows remain in the FTS5 index permanently. Subsequent searches throw `fts5: missing row N from content table` errors.
- **Recommended fix:** **FIXED** via migration 097 — added `rowid` to delete trigger. Verify migration applied.
- **Files involved:** `src/backend/db/schema.sql`, `src/backend/db/migrations/097_fix_fts5_delete_trigger.sql`
- **Complexity:** Small (already fixed)
- **Change type:** Migration (applied)
- **Isolation:** Fixed in isolation

---

### 11. REM-11: No timeouts on 6 external integration paths
- **Domain:** Architecture & Reliability
- **Audit ref:** Architecture audit — DC-3; High-risk gap #5
- **Risk:** High
- **Impact:** Reliability — a hung external service (Anthropic API, Notion SDK, platform sync, Slack webhook, OAuth refresh) blocks the request/worker indefinitely.
- **Recommended fix:** Add `AbortController` with timeout to all external fetch calls. The outgoing webhook pattern in `webhookProcessor.js` (30s timeout) is the template. Apply to: Anthropic SDK calls, Notion SDK calls, platform sync fetch calls, Slack monitoring, OAuth token refresh.
- **Files involved:** `src/shared/ai/listing-generator.js`, `src/shared/ai/image-analyzer.js`, `src/backend/services/notionService.js`, `src/backend/services/platformSync/*.js`, `src/backend/services/monitoring.js`, `src/backend/services/tokenRefreshScheduler.js`
- **Complexity:** Medium
- **Change type:** Code change
- **Isolation:** Can be done in isolation — each service can be updated independently

---

### 12. REM-12: Silent error swallowing in AI integrations
- **Domain:** Architecture & Reliability
- **Audit ref:** Architecture audit — DC-2
- **Risk:** High
- **Impact:** Reliability/Observability — AI service calls use `catch (_) {}` that silently discard errors. Failures produce no log entry, no metric, and no user feedback.
- **Recommended fix:** Replace `catch (_) {}` with structured error logging in each catch block. Log the error via the structured logger, track failure count in monitoring, and surface a user-facing error state (e.g., "AI generation unavailable, using template fallback").
- **Files involved:** `src/shared/ai/listing-generator.js`, `src/shared/ai/image-analyzer.js`
- **Complexity:** Small
- **Change type:** Code change
- **Isolation:** Can be done in isolation

---

### 13. REM-13: No OAuth token revocation before account deletion
- **Domain:** Security & Governance
- **Audit ref:** Security audit — H20
- **Risk:** High
- **Impact:** Security/Compliance — when a user deletes their account, OAuth tokens for eBay/Etsy/Poshmark/etc. are deleted from the database but not revoked at the platform. The tokens remain valid at the marketplace until they naturally expire.
- **Recommended fix:** Add platform-specific token revocation calls to `gdprWorker.js` before deleting `oauth_accounts` and `shops` records. Each platform's revocation endpoint differs — implement per-platform revocation in `src/backend/services/platformSync/`.
- **Files involved:** `src/backend/workers/gdprWorker.js`, `src/backend/services/platformSync/*.js`
- **Complexity:** Large
- **Change type:** Code change
- **Isolation:** Requires per-platform API integration — can be rolled out incrementally per platform

---

### 14. REM-14: `gdprWorker.js` missing `data_rectification_requests` table
- **Domain:** Security & Governance
- **Audit ref:** Security audit — H24; Generation — Bug #3
- **Risk:** Medium
- **Impact:** Compliance — data rectification request records survive account deletion, violating GDPR right-to-be-forgotten.
- **Recommended fix:** **FIXED** during QA — added to `USER_DATA_TABLES`. Verify fix persists.
- **Files involved:** `src/backend/workers/gdprWorker.js`
- **Complexity:** Small (already fixed)
- **Change type:** Code change (verified)
- **Isolation:** Fixed in isolation

---

### 15. REM-15: Community post title/body stored unsanitized (XSS)
- **Domain:** Security & Governance
- **Audit ref:** Security audit — H4/H28; Generation — Bug #2
- **Risk:** Medium
- **Impact:** Security — raw HTML in community post titles and bodies was a stored XSS vector.
- **Recommended fix:** **FIXED** during QA — `escapeHtml()` applied at storage time. Verify fix persists.
- **Files involved:** `src/backend/routes/community.js`
- **Complexity:** Small (already fixed)
- **Change type:** Code change (verified)
- **Isolation:** Fixed in isolation

---

### 16. REM-16: No circuit breaker on external dependencies
- **Domain:** Architecture & Reliability
- **Audit ref:** Architecture audit — Reliability gap #2
- **Risk:** High
- **Impact:** Reliability — a failing external dependency (marketplace API, AI service, Notion) is hammered indefinitely with no backoff or circuit breaking. Can cascade into rate limiting, IP bans, or resource exhaustion.
- **Recommended fix:** Implement a simple circuit breaker utility: track consecutive failures per service; after N failures, open the circuit (return fallback immediately) for a cooldown period; half-open after cooldown to test recovery. Apply to: platform sync, AI services, Notion, Slack.
- **Files involved:** `src/backend/services/` (new circuit breaker utility), all external integration callers
- **Complexity:** Large
- **Change type:** Code change (new feature)
- **Isolation:** Can be done in isolation — utility is additive

---

### 17. REM-17: `FEATURE_*` env vars documented but unused in code
- **Domain:** Infrastructure & Delivery
- **Audit ref:** Infrastructure audit — H5/L3; Final report — Risk #8
- **Risk:** Medium
- **Impact:** Operational — 3 feature flags (`FEATURE_AI_LISTINGS`, `FEATURE_AUTOMATIONS`, `FEATURE_ANALYTICS`) are documented in `.env.example` but no code reads them. Config appears functional but has no effect.
- **Recommended fix:** Either (1) wire the feature flags into the relevant route handlers and middleware, or (2) remove them from `.env.example` to eliminate config drift. Option 1 is preferred if feature gating is desired.
- **Files involved:** `.env.example`, `src/backend/routes/` (relevant routes), `src/backend/middleware/` (new feature flag middleware)
- **Complexity:** Medium
- **Change type:** Code change
- **Isolation:** Can be done in isolation

---

### 18. REM-18: No file upload abuse prevention
- **Domain:** Security & Governance
- **Audit ref:** Security audit — H2; Final report — Risk #9
- **Risk:** Medium
- **Impact:** Security — image uploads to marketplace bots have no type validation, size limits, or malicious content scanning.
- **Recommended fix:** Add upload middleware: (1) validate MIME type against allowlist (image/jpeg, image/png, image/webp), (2) enforce max file size (10MB), (3) validate magic bytes match declared MIME type, (4) strip EXIF metadata. Apply to any endpoint accepting file uploads.
- **Files involved:** `src/backend/middleware/` (new upload validation middleware), relevant upload routes
- **Complexity:** Medium
- **Change type:** Code change (new middleware)
- **Isolation:** Can be done in isolation

---

### 19. REM-19: Backend locale hardcoded to en-US
- **Domain:** Environment & Quality
- **Audit ref:** Environment audit — H2; Final report — Risk #10
- **Risk:** Medium
- **Impact:** UX — all server-side formatting (dates, prices) uses en-US regardless of user locale. Non-English users see US-formatted dates and prices.
- **Recommended fix:** Read user's `locale` column from the users table and pass it to `formatDate()`, `formatDateTime()`, and `formatPrice()` in `src/backend/shared/utils.js`. Fall back to en-US if no locale is set.
- **Files involved:** `src/backend/shared/utils.js`, routes that call formatting functions
- **Complexity:** Medium
- **Change type:** Code change
- **Isolation:** Can be done in isolation — formatting is utility-level

---

### 20. REM-20: Listings table missing UNIQUE(inventory_id, platform) constraint
- **Domain:** Data Systems
- **Audit ref:** Data Systems audit — BUG-3
- **Risk:** Medium
- **Impact:** Data integrity — duplicate listings for the same inventory item + platform pair can be inserted, causing sync conflicts and double-listing.
- **Recommended fix:** **PARTIALLY FIXED** — migration 096 adds the unique index. Verify migration applied and dedup script ran successfully. Add regression test.
- **Files involved:** `src/backend/db/migrations/096_add_listings_unique_constraint.sql`, `src/backend/db/schema.sql`
- **Complexity:** Small (migration exists)
- **Change type:** Migration (verify applied)
- **Isolation:** Requires migration — verify no duplicate data exists before applying

---

## Implementation Phases

### Phase 1 — Critical Production Risks
**Goal:** Eliminate issues that could cause data loss, security breaches, or silent production failures.
**Timeline guidance:** Address immediately.

| Order | Issue | Complexity | Status |
|-------|-------|-----------|--------|
| 1.1 | REM-03: legal.js PII leak | Small | **FIXED** — verify regression test |
| 1.2 | REM-09: FIFO cost query order | Small | **FIXED** — verify regression test |
| 1.3 | REM-10: FTS5 delete trigger | Small | **FIXED** — verify migration 097 |
| 1.4 | REM-14: GDPR worker missing table | Small | **FIXED** — verify fix |
| 1.5 | REM-15: Community XSS | Small | **FIXED** — verify fix |
| 1.6 | REM-05: DISABLE_CSRF production guard | Small | New code change |
| 1.7 | REM-07: CI lint ESM hang | Small | Infrastructure fix |
| 1.8 | REM-12: AI silent error swallowing | Small | New code change |

**Coordination notes:** Items 1.1–1.5 are already fixed — just verify. Items 1.6–1.8 are independent small fixes.

---

### Phase 2 — Data Integrity & Security Improvements
**Goal:** Close security gaps and protect data integrity.

| Order | Issue | Complexity | Status |
|-------|-------|-----------|--------|
| 2.1 | REM-04: Prompt injection protection | Medium | New code |
| 2.2 | REM-18: File upload abuse prevention | Medium | New middleware |
| 2.3 | REM-20: Listings UNIQUE constraint | Small | Verify migration 096 |
| 2.4 | REM-11: External integration timeouts | Medium | Code change (6 services) |
| 2.5 | REM-13: OAuth token revocation on deletion | Large | Per-platform rollout |
| 2.6 | REM-06: Key rotation mechanism | Large | Code + docs + deployment |

**Coordination notes:**
- REM-11 can be done service-by-service independently
- REM-13 requires platform API documentation review — roll out per marketplace
- REM-06 requires deployment planning for the rotation window — schedule separately
- REM-20 requires checking for existing duplicate data before applying constraint

---

### Phase 3 — Reliability & Infrastructure Hardening
**Goal:** Improve system resilience, observability, and deployment safety.

| Order | Issue | Complexity | Status |
|-------|-------|-----------|--------|
| 3.1 | REM-02: Clean up expect([200,500]) anti-pattern | Large (volume) | Test-only cleanup |
| 3.2 | REM-01: Cross-listing integration tests | Large | New test file |
| 3.3 | REM-08: Deploy rollback mechanism | Medium | Infrastructure |
| 3.4 | REM-16: Circuit breaker | Large | New feature |
| 3.5 | REM-17: FEATURE_* config drift | Medium | Code or config |

**Coordination notes:**
- REM-02 is high-volume but low-risk per file — can be parallelized across contributors
- REM-01 requires understanding the full cross-listing flow — read design docs first
- REM-08 requires staging environment to test rollback — coordinate with deployment
- REM-16 is a new utility — design the API before implementation
- REM-17 is a product decision (wire flags vs. remove them) — needs stakeholder input

---

### Phase 4 — Quality & Maintainability Improvements
**Goal:** Improve developer experience, user experience, and long-term maintainability.

| Order | Issue | Complexity | Status |
|-------|-------|-----------|--------|
| 4.1 | REM-19: Backend locale support | Medium | Code change |

**Additional items from audits (beyond top 20, included for completeness):**

| Item | Domain | Description | Complexity |
|------|--------|-------------|-----------|
| Pagination response shape inconsistency | Architecture | 6+ different shapes across routes | Medium |
| API docs only cover auth/MFA endpoints | Environment | Complete API.md for all routes | Medium |
| No DST transition tests | Environment | Test scheduled events crossing DST | Small |
| Frontend Cache class unbounded | Architecture | Add LRU/max-size eviction | Small |
| WebSocket permanent disconnect after 5 retries | Architecture | Add reconnect button or extended retry | Small |
| qa-guardian.yml unpinned actions | Infrastructure | SHA-pin GitHub Actions | Small |
| No admin creation mechanism | Security | Implement admin role management | Large |
| No content moderation system | Security | Report/flag/ban workflow | Large |
| No service worker tests | Environment | Playwright E2E for offline behavior | Medium |

---

## Coordination & Dependencies

### Can Be Fixed Safely in Isolation
- REM-01 through REM-05, REM-07, REM-09 through REM-12, REM-14 through REM-19

### Require Coordinated Changes
- **REM-06** (Key rotation): Requires auth middleware + encryption service + deployment runbook changes simultaneously. Must be deployed with a rotation window where both old and new keys are valid.
- **REM-08** (Deploy rollback): Requires deploy.yml + docker-compose changes tested together in staging.
- **REM-13** (OAuth revocation): Each platform has different revocation APIs — coordinate with marketplace API documentation. Roll out one platform at a time.

### Require Schema Migrations or Deployment Planning
- **REM-10** (FTS5 trigger): Migration 097 — **already created**, verify it ran.
- **REM-20** (Listings UNIQUE): Migration 096 — **already created**, verify it ran and no duplicate data exists.
- **REM-06** (Key rotation): Deployment must be planned — old key must remain valid during rotation window.
- **REM-08** (Deploy rollback): Test rollback procedure in staging before enabling in production.

---

## Summary

| Phase | Issues | Fixed | New Work | Complexity |
|-------|--------|-------|----------|-----------|
| Phase 1: Critical | 8 | 5 already fixed | 3 small changes | Small |
| Phase 2: Security | 6 | 1 partially fixed | 5 new items | Medium–Large |
| Phase 3: Reliability | 5 | 0 | 5 new items | Medium–Large |
| Phase 4: Quality | 1+ | 0 | 1+ items | Medium |
| **Total** | **20** | **6** | **14** | |

**Immediate wins:** 5 bugs already fixed during QA (REM-03, 09, 10, 14, 15) — verify regression tests exist. 3 small fixes in Phase 1 (REM-05, 07, 12) can be completed in a single session.

**Highest-impact next actions:**
1. Verify all 5 QA-fixed bugs have regression tests
2. Add DISABLE_CSRF production guard (REM-05) — 15 minutes
3. Fix CI lint ESM hang (REM-07) — 15 minutes
4. Add error logging to AI catch blocks (REM-12) — 30 minutes
5. Add prompt injection sanitization (REM-04) — 2–4 hours
