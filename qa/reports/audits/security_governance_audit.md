# Security & Governance — Domain Audit Report
**Date:** 2026-03-12
**Domain:** Security & Governance (7 categories)
**Auditor:** Claude (automated source inspection + test evidence review)
**Source taxonomy:** qa/domains/security_governance.md + qa/full_testing_taxonomy.md (categories 24-25, 35-36, 38-40)

---

## Methodology

1. Read all middleware in `src/backend/middleware/` (auth, csrf, rateLimiter, securityHeaders, errorHandler, validate, cache, cdn, requestLogger)
2. Read security-critical routes: auth.js, security.js, gdpr.js, legal.js, oauth.js, socialAuth.js, monitoring.js, community.js
3. Read security services: auditLog.js, encryption.js, gdprWorker.js, webhookProcessor.js, tokenRefreshScheduler.js, monitoring.js
4. Read frontend token handling: store.js, auth.js
5. Inspected all automation bots in `src/shared/automations/` for credential handling
6. Searched for prompt injection protections in `src/shared/ai/`
7. Inventoried all existing security test files (17 files found)
8. Read `.env.example` for secret management patterns
9. Checked `docs/` for security documentation

---

## Category 1: Security / Abuse Resistance

### Taxonomy mapping
Full taxonomy #24: Security, Abuse Resistance, and Adversarial Behavior

### Current State: Partial

#### Strengths (verified with evidence)

**Injection prevention:**
- SQL: All queries use parameterized statements across all inspected routes (auth.js, gdpr.js, legal.js, security.js). `legal.js:6-10` uses `ALLOWED_AUDIT_TABLES` whitelist for dynamic table names. `security-regression.test.js:117-176` tests custom query parameterization, UNION injection, blocked tables.
- XSS: `escapeHtml()` used extensively in frontend (3724 occurrences across 32 files). CSP nonce system in `securityHeaders.js:256-272` with `strict-dynamic` in production. `security.test.js:67-98` tests XSS payload storage.
- CSRF: Full implementation in `csrf.js` — crypto.randomBytes(32) tokens, 4-hour expiry, one-time use, session binding. Skip list for public auth endpoints and incoming webhooks. `middleware-csrf-expanded.test.js` (21+ tests), `middleware-csrf.test.js`, `middleware-csrf-coverage.test.js`.

**Authentication security:**
- JWT: HS256 explicitly set (prevents algorithm confusion), 15-min access tokens, 7-day refresh tokens, issuer/audience validation, refresh token rotation on use (`auth.js:622-624`). `middleware-auth.test.js` tests token gen/verify.
- Password: bcrypt with 12 rounds, 12-char minimum with uppercase/lowercase/number/special requirements (`auth.js:66-86`). Async bcrypt to avoid blocking.
- Account lockout: 5 failed attempts → 15-min lockout using security_logs table (`auth.js:109-138`). Masked email in logs to avoid PII storage (`auth.js:100-106`).
- MFA: TOTP + backup codes + WebAuthn + SMS. Rate-limited MFA verification. Atomic token consumption prevents TOCTOU race (`auth.js:503-508`). `mfaLoginFlow.test.js` (307 lines), `enhancedMFA.test.js` (355 lines).
- Anti-enumeration: Registration and password reset return generic messages to prevent email enumeration (`auth.js:258-261`, `auth.js:882-883`).
- Session management: 10-session cap per user (`auth.js:204-225`), session invalidation on password change (`auth.js:795-814`).

**Token storage (frontend):**
- Tokens stored in sessionStorage only (tab-scoped) — never localStorage (`store.js:392-395`). HttpOnly cookies for refresh token. localStorage used only for non-sensitive user identity (name, avatar).

**Security headers:**
- CSP with nonce + strict-dynamic in production, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, HSTS in production, Permissions-Policy, Cross-Origin headers. `middleware-securityHeaders-expanded.test.js` (37+ tests), `middleware-securityHeaders.test.js`.

**Rate limiting:**
- `RateLimiter` class with per-route limits (default: 100/min, auth: 10/15min, mutation: 30/min, expensive: 10/min). 3-violation permanent block. Loopback IPs exempt. `middleware-rateLimiter.test.js`, `arch-caching-etag.test.js:136-203`.

**Encryption:**
- OAuth tokens encrypted with AES-256-GCM before SQLite storage (`encryption.js:36-53`). Legacy CBC decrypt supported. Production key validation. `service-encryption.test.js` (14 tests).

#### Gaps (High Risk)

| ID | Gap | Risk | Automatable |
|----|-----|------|-------------|
| H1 | No prompt injection sanitization in AI inputs — user content passed directly to Anthropic API | High | Yes — unit test |
| H2 | No file upload abuse prevention (size limits, type validation, malicious file scanning) | High | Partial — needs endpoint implementation |
| H3 | No SSRF prevention — external URL inputs (image URLs, webhook endpoints) not validated | High | Yes — unit test |
| H4 | Community posts store raw user content (title, body) — no HTML sanitization on storage, only tag sanitization | Medium | Yes — unit test |
| H5 | `legal.js:80-94` data export includes `SELECT *` from all tables — may leak sensitive columns (password_hash, oauth_token) that aren't redacted like in `gdpr.js:34-38` | High | Yes — unit test |
| H6 | No brute force protection on CSRF token guessing (tokens are 64 hex chars so low risk, but no rate limit on 403 responses) | Low | No |
| H7 | `DISABLE_CSRF` env var bypasses CSRF in non-production — could be accidentally set in staging | Medium | Yes — unit test |
| H8 | `unsafe-eval` removed but `unsafe-inline` still present in CSP script-src (mitigated by nonce in production but not in dev) | Medium | Manual |
| H9 | Admin check uses `user.is_admin` field but no admin role in schema.sql CREATE TABLE — relies on manual DB flag | Medium | Yes — unit test |
| H10 | No Content-Security-Policy-Report-Only header for testing CSP changes before enforcement | Low | Manual |

---

## Category 2: Privacy / Compliance / Auditability

### Taxonomy mapping
Full taxonomy #25: Privacy, Compliance, Auditability, and Governance

### Current State: Partial

#### Strengths (verified with evidence)

**GDPR implementation:**
- Full GDPR route in `gdpr.js`: data export, account deletion (30-day grace period), cancellation, consent management (4 consent types), data rectification with strict field mapping.
- Export redacts sensitive columns: `password_hash`, `mfa_secret`, `mfa_backup_codes`, `oauth_token`, etc. (`gdpr.js:34-38`).
- `gdprWorker.js`: hourly job processes pending deletions, sends 3-day reminder emails, cleans up old exports after 7 days.
- Account deletion uses transaction, anonymizes sales data (keeps for financial records), deletes from 19+ tables.

**Legal/compliance:**
- `legal.js`: cookie consent (analytics/marketing/functional), ToS versioning + acceptance tracking with IP/user-agent, data audit endpoint.
- Data audit uses `ALLOWED_AUDIT_TABLES` whitelist to prevent table name injection (`legal.js:6-10`).

**Audit logging:**
- Comprehensive `auditLog.js` service: 10 event categories, 4 severity levels, sensitive field redaction, compliance report generation.
- Audit log table with proper indexes (user, category, severity, action, resource, date).
- Retention policy: 90 days for standard logs, 730 days (2 years) for critical/security logs.
- Admin-only audit query endpoints with proper authorization.
- Platform sync audit logging via `platformAuditLog.js`.

**PII handling:**
- Email masking in auth logs (`auth.js:100-106`): `alice@example.com` → `a***@example.com`.
- User SELECT queries exclude `password_hash` (`auth.js:98-101`).
- Sensitive fields redacted in audit log details (`auditLog.js:31-51`).

#### Gaps (High Risk)

| ID | Gap | Risk | Automatable |
|----|-----|------|-------------|
| H11 | No tests for GDPR data export (completeness, redaction, correctness) | High | Yes |
| H12 | No tests for account deletion (data actually removed, sales anonymized, cascade correct) | High | Yes |
| H13 | No tests for consent management (grant/revoke/persistence) | Medium | Yes |
| H14 | No tests for audit log service (redaction, retention, compliance report) | High | Yes |
| H15 | `gdpr.js` and `legal.js` have DUPLICATE data export endpoints — `legal.js` version doesn't redact sensitive columns | High | Yes — unit test |
| H16 | No data retention policy enforcement — `cleanupExpiredData` in database.js doesn't clean user_consents, data_rectification_requests, or audit_logs based on consent withdrawals | Medium | Yes |
| H17 | No "right to be forgotten" verification test — no test that after deletion, FTS5 index, sessions, notifications, etc. are actually cleaned | High | Yes |
| H18 | Audit log `user_id` is SET NULL on user deletion — loses attribution for security-critical events | Medium | Manual (design) |
| H19 | No consent version tracking (consent types are hardcoded strings, no migration path when consent categories change) | Low | Manual (design) |

---

## Category 3: Offboarding / Decommissioning

### Taxonomy mapping
Full taxonomy #35: Lifecycle, Offboarding, Decommissioning, and End-of-Life

### Current State: Partial

#### Strengths

- Account deletion with 30-day grace period + cancellation (`gdpr.js:66-100`)
- GDPR worker processes pending deletions hourly (`gdprWorker.js:13-47`)
- Deletion reminder emails 3 days before execution (`gdprWorker.js:134-173`)
- Sales data anonymized, not deleted (financial record keeping) (`gdprWorker.js:77-83`)
- OAuth account records deleted as part of account deletion (`gdprWorker.js:66` — `oauth_accounts` in table list)
- Session cleanup included in deletion (`sessions` in USER_DATA_TABLES)
- Deletion logged to audit_logs (`gdprWorker.js:120-130`)

#### Gaps

| ID | Gap | Risk | Automatable |
|----|-----|------|-------------|
| H20 | No OAuth token revocation on account deletion — OAuth tokens for eBay/Etsy/Poshmark are encrypted in shops table but not revoked at platform before deletion | High | Partial — needs platform API mock |
| H21 | No test for GDPR worker (processAccountDeletions, sendDeletionReminders, cleanupExportRequests) | High | Yes |
| H22 | FTS5 inventory index entries not cleaned on user deletion (FTS5 is a content-sync table — deleting from `inventory` should trigger FTS5 delete, but untested for user-level cascade) | Medium | Yes |
| H23 | No integration disconnect flow — when user disconnects a marketplace (sets shop status to 'disconnected'), OAuth tokens should be revoked at the platform and encrypted tokens deleted | Medium | Partial |
| H24 | `data_rectification_requests` table not in GDPR worker's USER_DATA_TABLES — rectification records survive deletion | Low | Yes |
| H25 | Export data stored in `data_export_requests.export_data` as JSON blob — no encryption at rest, potentially contains PII for 7 days | Medium | Manual (design) |

---

## Category 4: Moderation / Trust / Safety

### Taxonomy mapping
Full taxonomy #36: Content Moderation, Trust, Safety, and Policy Enforcement

### Current State: Uncovered

#### Evidence

- `community.js` handles forum posts (discussion, success, tip) with basic input validation (title: 200 chars, content: 10K chars, tags: max 10 with HTML stripping).
- **No moderation system found**: No report/flag endpoints, no ban/block functionality, no moderation queue, no content review workflow.
- Community post content is stored as raw user input — only tags are sanitized (`community.js:47`). Titles and body are not HTML-escaped on storage.
- No user blocking/banning mechanism exists in any inspected route.
- No content takedown endpoint found.
- No abuse reporting flow.

#### Gaps

| ID | Gap | Risk | Automatable |
|----|-----|------|-------------|
| H26 | No content moderation system — no report, flag, or review workflow | High | No — feature missing |
| H27 | No user blocking/banning mechanism | High | No — feature missing |
| H28 | Community post title and body not HTML-sanitized on storage | Medium | Yes — unit test |
| H29 | No content takedown or removal propagation (search index, cache) | Medium | No — feature missing |
| H30 | No abuse rate limiting on community post creation | Medium | Yes — verify rate limit applied |

---

## Category 5: Human/Manual Recovery Workflows

### Taxonomy mapping
Full taxonomy #38: Human Support, Manual Operations, and Recovery Workflows

### Current State: Uncovered

#### Evidence

- Admin endpoints exist in `monitoring.js` (metrics, errors, alerts, security events — all gated by `user.is_admin`), `auditLog.js` (log query, admin activity, compliance report), `feedback.js` (feedback analytics), `pushNotifications.js` (broadcast, templates).
- No support impersonation capability found (searched for `impersonat`, `sudo`, `support.*access`).
- No manual account recovery endpoint (admin-assisted password reset, MFA bypass).
- No manual refund/reversal mechanism.
- No manual data correction tool beyond the user-facing GDPR rectification endpoint.
- Admin role is checked via `user.is_admin` but there is no admin creation/management flow.

#### Gaps

| ID | Gap | Risk | Automatable |
|----|-----|------|-------------|
| H31 | No admin-assisted account recovery (MFA lockout, email loss) | High | No — feature missing |
| H32 | No manual refund/reversal mechanism | Medium | No — feature missing |
| H33 | No admin user management (create admin, revoke admin, list admins) | Medium | No — feature missing |
| H34 | Admin endpoints not tested for proper is_admin gating | High | Yes — unit test |
| H35 | No audit trail for admin actions in monitoring endpoints (viewing errors, acknowledging alerts) | Medium | Yes — unit test |

---

## Category 6: Ecosystem / Contractual Expectations

### Taxonomy mapping
Full taxonomy #39: Ecosystem, Contractual, and External Expectation Compliance

### Current State: Partial

#### Evidence

- **Rate limit compliance**: All automation bots import `RATE_LIMITS` from `rate-limits.js`. Per-platform rate limits defined. `jitteredDelay()` helper for randomized delays. Bots read credentials from `process.env` only (verified: all 6 bots use `process.env.PLATFORM_PASSWORD`).
- **eBay**: OAuth mode toggle (mock/real) via `EBAY_ENVIRONMENT` env var. Sandbox/production API URL switching.
- **ToS management**: ToS versioning, acceptance tracking with IP/user-agent. Current ToS acceptance status check.
- **Marketplace credentials**: All stored in `.env`, never hardcoded. OAuth tokens encrypted with AES-256-GCM.

#### Gaps

| ID | Gap | Risk | Automatable |
|----|-----|------|-------------|
| H36 | No marketplace API Terms of Service compliance documentation — unclear if automation complies with Poshmark/Mercari/Depop ToS | High | Manual |
| H37 | No API deprecation handling — if a marketplace changes their API, no detection or graceful degradation | Medium | No — design gap |
| H38 | Bot automation audit log (`data/automation-audit.log`) referenced in CLAUDE.md but not verified in actual bot code | Medium | Yes — code inspection |
| H39 | No rate limit compliance tests for automation bots | Medium | Yes — unit test |
| H40 | No SLA/SLO definitions for the application itself | Low | Manual |

---

## Category 7: Severity / Blast Radius / Recoverability

### Taxonomy mapping
Full taxonomy #40: Severity, Risk, Blast Radius, and Recoverability Modeling

### Current State: Uncovered

#### Analysis

**Single points of failure:**
- `JWT_SECRET` compromise → all active tokens can be forged. No key rotation mechanism. All sessions vulnerable until secret rotated + all users forced to re-login.
- `OAUTH_ENCRYPTION_KEY` compromise → all stored marketplace OAuth tokens can be decrypted. No key rotation support.
- SQLite database corruption → total data loss (single file). WAL mode provides some crash resilience but no built-in replication.
- `EFFECTIVE_SECRET` dev fallback (`'dev-only-secret-not-for-production'`) in `auth.js:19` — if accidentally deployed, all tokens are forgeable.

**Blast radius assessment:**
| Scenario | Blast Radius | Detectability | Recoverability |
|----------|-------------|---------------|----------------|
| JWT_SECRET leak | All users | Low (no monitoring) | Medium (rotate key, force logout all) |
| OAUTH_ENCRYPTION_KEY leak | All marketplace connections | Low | Low (must re-encrypt all tokens) |
| SQLite DB corruption | All data | Medium (health check exists) | Low (depends on backup frequency) |
| XSS via community post | All users viewing post | Low (CSP may block) | High (delete post) |
| CSRF bypass | Per-session | Medium (CSRF logging exists) | High (fix + rotate tokens) |
| OAuth token leak (single user) | One user's marketplace accounts | Low | Medium (revoke at platform, re-connect) |

#### Gaps

| ID | Gap | Risk | Automatable |
|----|-----|------|-------------|
| H41 | No key rotation mechanism for JWT_SECRET or OAUTH_ENCRYPTION_KEY | High | No — feature missing |
| H42 | No formal risk registry or severity classification | Medium | Manual |
| H43 | No blast radius documentation for critical failure scenarios | Medium | Manual |
| H44 | Dev-only JWT secret fallback could leak to production — only `logger.warn` protection, no startup abort in staging | Medium | Yes — unit test |
| H45 | No automated detection of compromised credentials (e.g., monitoring for anomalous token usage patterns) | Medium | No — feature missing |

---

## Test Evidence Summary

### Existing security test files (17 files, ~450+ tests)

| File | Tests | Coverage Area |
|------|-------|---------------|
| security.test.js | ~35 | SQL injection, XSS, JWT, password, auth, input validation, CSRF |
| security-expanded.test.js | ~20 | Auth guards, email verification, forgot/reset password, MFA disable/status |
| security-regression.test.js | ~15 | Webhook secrets, cron validation, query parameterization, IDOR, bounds |
| e2e-security.test.js | ~10 | Webhook lifecycle, automation security, auth token lifecycle, cross-resource isolation |
| middleware-auth.test.js | ~15 | Token generation/verification, tier enforcement |
| middleware-auth-coverage.test.js | ~10 | Additional auth middleware coverage |
| middleware-csrf.test.js | ~10 | CSRF token validation |
| middleware-csrf-expanded.test.js | ~21 | CSRF config, lifecycle, add/validate/apply |
| middleware-csrf-coverage.test.js | ~10 | Additional CSRF coverage |
| middleware-securityHeaders.test.js | ~10 | Security header configuration |
| middleware-securityHeaders-expanded.test.js | ~37 | CSP config, nonce, presets, headers |
| middleware-rateLimiter.test.js | ~10 | Rate limiter behavior |
| service-encryption.test.js | ~14 | Token encryption/decryption, state token, hash |
| cross-user-auth.test.js | ~15 | Cross-user isolation |
| cross-user-auth-expanded.test.js | ~25 | IDOR across resources |
| mfaLoginFlow.test.js | ~30 | TOTP, backup codes, replay prevention |
| enhancedMFA.test.js | ~35 | WebAuthn, SMS, MFA disable |

### Areas with ZERO test coverage

1. GDPR data export (gdpr.js export endpoint)
2. Account deletion lifecycle (gdpr.js + gdprWorker.js)
3. Consent management (gdpr.js consent endpoints)
4. Audit log service (auditLog.js — log, redact, query, retention, compliance report)
5. Legal routes (legal.js — cookie consent, ToS acceptance, data audit)
6. Admin endpoint authorization gating (monitoring.js is_admin checks)
7. Community content sanitization
8. Prompt injection prevention in AI inputs
9. Automation bot audit logging
10. Key rotation / secret management

---

## Risk Summary

| Risk Level | Count | Examples |
|------------|-------|---------|
| High | 18 | Prompt injection, data export leaks PII, no moderation, no admin recovery, no key rotation, GDPR untested |
| Medium | 18 | CSP unsafe-inline, consent versioning, FTS5 cleanup, admin management, rate limit compliance |
| Low | 5 | CSP report-only, brute force on CSRF, SLA definitions |

## Recommendations (Priority Order)

1. **GDPR/privacy test suite** — export, deletion, consent, audit log (H11-H17, H21) — high risk, fully automatable
2. **Admin endpoint gating tests** — verify is_admin enforcement on monitoring, push, feedback routes (H34) — high risk, automatable
3. **Prompt injection protection** — sanitize user input before passing to Anthropic API (H1) — high risk, automatable
4. **Fix legal.js data export** — add same column redaction as gdpr.js (H15) — high risk, code fix + test
5. **Community content sanitization** — HTML-escape titles and body on storage (H28) — medium risk, code fix + test
6. **Content moderation system** — implement report/flag/ban/review workflow (H26-H27) — high risk, large feature
7. **Key rotation mechanism** — JWT_SECRET and OAUTH_ENCRYPTION_KEY (H41) — high risk, design + implementation
