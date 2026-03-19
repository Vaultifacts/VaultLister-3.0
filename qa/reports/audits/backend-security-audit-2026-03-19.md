# Backend Security Audit -- VaultLister 3.0

**Date:** 2026-03-19
**Auditor:** Security & Governance QA (Claude Sonnet 4.6)
**Scope:** `src/backend/routes/*.js`, `src/backend/middleware/*.js`, `src/backend/services/*.js`, `src/backend/workers/*.js`, `src/backend/server.js`
**Method:** Static analysis -- full read of all targeted files, grep-assisted pattern search for SQL injection candidates, cross-reference of route registrations vs. auth/CSRF/rate-limit middleware stacks.

---

## Executive Summary

17 findings across 10 scan categories. Two **Critical** findings require immediate remediation: the mock OAuth provider is served in production with no auth guard, and three major route trees (`/api/integrations`, `/api/monitoring`, `/api/settings`) are excluded from the centralized authentication middleware. These two issues together create unauthenticated access to OAuth simulation endpoints and potentially to all monitoring and settings APIs.

No SQL injection via user-controlled string interpolation was found. All dynamic SQL patterns trace to parameterized placeholders or validated identifiers.

| Severity | Count |
|----------|-------|
| Critical | 2 |
| High | 5 |
| Medium | 7 |
| Low | 3 |

---

## Findings Table

| # | File | Line(s) | Severity | OWASP | Category | Description |
|---|------|---------|----------|-------|----------|-------------|
| B-01 | `src/backend/routes/mock-oauth.js` | 1-end | **Critical** | A05 Security Misconfiguration | Stub/mock endpoint in production | Mock OAuth provider registered at `/mock-oauth` and `/api/mock-oauth` in `server.js` (lines 519, 927-962) with no `NODE_ENV` guard and no authentication requirement. Any unauthenticated caller can complete fake OAuth flows against the application in production. |
| B-02 | `src/backend/server.js` | 523-597 | **Critical** | A01 Broken Access Control | Auth bypass -- missing route protection | `protectedPrefixes` array excludes `/api/integrations`, `/api/monitoring`, and `/api/settings` despite all three route trees being registered in `apiRoutes`. The centralized `authenticateToken` middleware is never invoked for requests to these three route trees. Individual route handlers may add their own checks but this is unverified and inconsistent. |
| B-03 | `src/backend/server.js` | 446-468 | **High** | A05 Security Misconfiguration | Information leakage -- public status endpoint | `GET /api/status` is public (not in `protectedPrefixes`) and returns `process.version`, `process.env.NODE_ENV`, `process.uptime()`, database connection metrics, SQLite statement cache statistics, and WebSocket connection counts. Provides a free fingerprinting oracle to unauthenticated callers. |
| B-04 | `src/backend/server.js` | 469-505 | **High** | A05 Security Misconfiguration | Information leakage -- public worker health endpoint | `GET /api/workers/health` is public and returns all background worker names, running state, lastRun timestamps, and scheduled interval configuration. Exposes the application task topology without authentication. |
| B-05 | `src/backend/services/auditLog.js` | 431 | **High** | A01 Broken Access Control | Permission escalation -- enterprise tier as admin | Admin gate for `/api/audit/logs`, `/api/audit/compliance`, and `/api/audit/security-alerts` accepts `subscription_tier === 'enterprise'` in addition to `is_admin`. All other admin routes use `is_admin` exclusively. Any enterprise subscriber can read the full audit log of all users. |
| B-06 | `src/backend/routes/auth.js` | 451-488 | **High** | A07 Identification and Authentication Failures | Missing rate limiting on demo-login | `POST /api/auth/demo-login` does not call `applyRateLimit`. The endpoint performs a real bcrypt comparison (12 rounds) and is not guarded by the auth lockout mechanism, enabling CPU-exhaustion or enumeration attacks at unlimited request rates. |
| B-07 | `src/backend/routes/security.js` | 167-225 | **High** | A07 Identification and Authentication Failures | Missing rate limiting on password reset token consumption | `POST /api/security/reset-password` is in the CSRF skip list and applies no rate limiter. Without rate limiting, an attacker who knows the reset URL format can brute-force the token space for any user whose reset was recently triggered. |
| B-08 | `src/backend/middleware/csrf.js` | 148, 208 | **Medium** | A01 Broken Access Control | CSRF session binding uses IP only | CSRF token sessions are keyed solely on the client IP address. Users behind shared NAT or corporate proxies share the same CSRF session namespace. A token issued to one user at a shared IP is structurally valid for any other user at that IP. |
| B-09 | `src/backend/middleware/csrf.js` | 1-end | **Medium** | A05 Security Misconfiguration | In-memory CSRF store invalidated on restart | CSRF tokens are stored in a process-local `Map`. A server restart invalidates all active CSRF tokens simultaneously; every authenticated user receives a 403 on their next mutation until they reload. Multi-instance deployments are incompatible with this design. |
| B-10 | `src/backend/routes/auth.js` | 705-750, 752-817 | **Medium** | A07 Identification and Authentication Failures | Dual auth code path on profile/password update | `PUT /api/auth/profile` and `PUT /api/auth/password` re-implement token verification via a direct `verifyToken()` call instead of using `ctx.user` from the `authenticateToken` middleware. This creates a second auth code path that may diverge from middleware behavior without being caught by existing tests. |
| B-11 | `src/backend/routes/monitoring.js` | 230-278 | **Medium** | A05 Security Misconfiguration | Unauthenticated RUM metric ingestion | `POST /api/monitoring/rum` is public with no per-IP or per-session rate limit. Unauthenticated callers can flood arbitrary metric batches into the `rum_events` table, polluting analytics dashboards with `user_id = null` entries. |
| B-12 | `src/backend/server.js` | 1343 | **Medium** | A05 Security Misconfiguration | 404 response reflects raw pathname | The 404 handler returns `{ error: 'Not Found', path: pathname, status: 404 }`. The raw `pathname` is reflected verbatim, constituting path disclosure and potentially exposing internal route structure to scanners. |
| B-13 | `src/backend/routes/socialAuth.js` | ~40-80 | **Medium** | A07 Identification and Authentication Failures | Social auth state tokens lost on restart | OAuth state tokens for social login flows are stored in a process-local `Map` with a 10,000-entry cap. A server restart invalidates all in-progress social login flows with no recovery path other than retrying. |
| B-14 | `src/backend/routes/gdpr.js` | ~160-170 | **Medium** | A04 Insecure Design | GDPR export data stored unencrypted | The full GDPR data export JSON blob (all user PII) is stored unencrypted in the `data_export_requests.export_data` SQLite column with a 7-day exposure window. Any actor with read access to the SQLite file can extract all export data in plaintext. |
| B-15 | `src/backend/routes/mock-oauth.js` | 225-231 | **Medium** | A03 Injection | Open redirect in mock OAuth authorize page | The HTML authorize page embeds `redirect_uri` and `state` query parameters directly into inline JavaScript via template literals without sanitization, enabling open redirect to any URI. Moot if B-01 is remediated by removing the endpoint from production. |
| B-16 | `src/backend/utils/encryption.js` | ~15-25 | **Low** | A05 Security Misconfiguration | Dev fallback encryption and JWT keys in non-production | Fallback values (`dev-only-key-not-for-production!!` and `dev-only-secret-not-for-production`) are used when `OAUTH_ENCRYPTION_KEY` and `JWT_SECRET` are absent. Startup warnings are logged but the application continues. A staging environment missing these vars silently uses the published fallback key. |
| B-17 | `src/backend/routes/auth.js` | ~390-420 | **Low** | A07 Identification and Authentication Failures | Auth lockout bypassed for loopback IPs | `isAuthLockoutBypassed()` returns `true` for any loopback address. An attacker with SSRF capability or a compromised internal service can bypass the login lockout mechanism entirely by routing requests through localhost. |

---

## SQL Injection Assessment

All dynamic SQL template literal patterns were grepped and manually traced to their source.

| Pattern | Locations | Verdict |
|---------|-----------|---------|
| `IN (${placeholders})` | `inventory.js:588`, `reports.js`, `teams.js` | Safe -- `placeholders` always built as `Array(n).fill('?').join(',')` |
| `UPDATE SET ${updates.join(', ')}` | `shippingLabels.js`, `help.js`, `inventory.js` | Safe -- `updates` arrays built from hardcoded column name strings |
| `SELECT * FROM ${table}` | `gdpr.js:43,118` | Safe -- `table` from hardcoded `USER_DATA_TABLES` constant |
| Dynamic table/column names | `database.js` | Safe -- `validateIdentifier()` enforced before all interpolation |
| Date filter strings | `sales.js:346-354` | Safe -- if/else whitelist, only hardcoded strings used |
| Report query builder | `reports.js` | Safe -- `ALLOWED_TABLES`/`ALLOWED_OPERATORS` whitelists enforced |
| Rate limit dashboard hours | `rateLimitDashboard.js:194-208` | Safe -- value `parseInt`-ed and clamped before use |
| FTS5 query | `inventory.js:117` | Safe -- input sanitized before FTS5 construction |

**No SQL injection via user-controlled string interpolation was identified.**

---

## Auth Bypass Assessment

| Route Tree | Protected By | Status |
|-----------|-------------|--------|
| `/api/auth/*` | Selectively (routes opt in) | Correct -- auth routes intentionally public |
| `/api/inventory/*` | `protectedPrefixes` | Protected |
| `/api/listings/*` | `protectedPrefixes` | Protected |
| `/api/sales/*` | `protectedPrefixes` | Protected |
| `/api/offers/*` | `protectedPrefixes` | Protected |
| `/api/gdpr/*` | `protectedPrefixes` | Protected |
| `/api/teams/*` | `protectedPrefixes` | Protected |
| `/api/audit/*` | `protectedPrefixes` | Protected |
| `/api/integrations/*` | Not in `protectedPrefixes` | **UNPROTECTED -- B-02** |
| `/api/monitoring/*` | Not in `protectedPrefixes` | **UNPROTECTED -- B-02** |
| `/api/settings/*` | Not in `protectedPrefixes` | **UNPROTECTED -- B-02** |
| `/mock-oauth/*` | None | **UNPROTECTED -- B-01** |

---

## CSRF Gap Assessment

| Endpoint | In CSRF Skip List | Notes |
|----------|------------------|-------|
| `/api/auth/login` | Yes | Correct -- pre-auth |
| `/api/auth/refresh` | Yes | Correct -- token rotation |
| `/api/auth/demo-login` | Yes | Missing rate limit (B-06) |
| `/api/security/reset-password` | Yes | Missing rate limit (B-07) |
| `/api/webhooks/*` | Yes | Correct -- Stripe signature verification |
| `PUT /api/auth/profile` | No (protected) | Uses dual auth path (B-10) |
| `PUT /api/auth/password` | No (protected) | Uses dual auth path (B-10) |

CSRF token issuance and validation logic is correct. B-08 and B-09 are infrastructure concerns, not algorithm errors.

---

## Rate Limit Gap Assessment

| Endpoint | Rate Limited | Finding |
|----------|-------------|---------|
| `POST /api/auth/login` | Yes | OK |
| `POST /api/auth/register` | Yes | OK |
| `POST /api/auth/demo-login` | No | B-06 |
| `POST /api/security/reset-password` | No | B-07 |
| `POST /api/monitoring/rum` | No | B-11 |
| All other mutating routes | Yes | OK |

---

## Verified Controls (Confirmed Safe by Source Inspection)

- JWT verification specifies explicit `HS256` algorithm and validates `iss`/`aud` claims -- prevents algorithm confusion attacks.
- Refresh tokens are type-checked to prevent use as access tokens.
- bcryptjs at 12 rounds throughout auth routes.
- AES-256-GCM used for all new OAuth token encryption; CBC legacy supported for decryption only with documented key rotation.
- Stripe webhook raw body used for signature verification.
- SSRF protection (`isInternalUrl()`) present in webhook dispatch.
- PKCE implemented for Etsy OAuth.
- OAuth state tokens stored in DB with expiry for non-social OAuth flows.
- Community post titles and bodies HTML-escaped at storage time.
- GDPR data export excludes `password_hash` and raw OAuth tokens via `redactRow()`.
- RBAC in `teams.js` prevents `owner` role assignment via invitation; role escalation prevention enforced.
- `validateIdentifier()` enforced in `database.js` before all dynamic SQL identifier interpolation.

---

## Remediation Priority

| Priority | Finding | Effort |
|----------|---------|--------|
| P0 -- Immediate | B-01 mock-oauth in production | Low -- add `NODE_ENV !== 'production'` guard in `server.js` route registration |
| P0 -- Immediate | B-02 missing `protectedPrefixes` entries | Low -- add three route prefixes to `protectedPrefixes` array in `server.js` |
| P1 -- This sprint | B-05 enterprise tier as admin escalation | Low -- remove enterprise check from audit log admin gate in `auditLog.js:431` |
| P1 -- This sprint | B-06 demo-login no rate limit | Low -- add `applyRateLimit` call to demo-login handler in `auth.js` |
| P1 -- This sprint | B-07 reset-password no rate limit | Low -- add rate limiter to password reset token consumption in `security.js` |
| P1 -- This sprint | B-03 public `/api/status` fingerprinting | Medium -- add auth or redact `runtime`/`environment`/`uptime` fields |
| P1 -- This sprint | B-04 public `/api/workers/health` | Low -- add to `protectedPrefixes` or add inline auth check in `server.js` |
| P2 -- Backlog | B-08 CSRF IP-only binding | Medium -- include user ID in CSRF session key post-login |
| P2 -- Backlog | B-09 in-memory CSRF store | High -- migrate to DB-backed or Redis-backed CSRF token store |
| P2 -- Backlog | B-10 dual auth code path | Low -- remove manual `verifyToken()` calls; use `ctx.user` from middleware |
| P2 -- Backlog | B-11 unauthenticated RUM ingestion | Medium -- add per-IP rate limit to RUM endpoint |
| P2 -- Backlog | B-12 pathname in 404 response | Trivial -- remove `path` field from 404 JSON response |
| P2 -- Backlog | B-13 social auth state lost on restart | High -- persist state tokens to DB (same pattern as non-social OAuth) |
| P2 -- Backlog | B-14 unencrypted GDPR export data | High -- encrypt `export_data` column at write time using AES-256-GCM |
| P2 -- Backlog | B-15 open redirect in mock-oauth HTML | Deferred -- moot if B-01 removes the endpoint from production |
| P3 -- Low | B-16 dev fallback keys in staging | Medium -- add startup abort when fallback key detected outside `development` |
| P3 -- Low | B-17 loopback lockout bypass | Low -- remove loopback bypass from `isAuthLockoutBypassed()` |

---

## Methodology Notes

- All findings based on static analysis of the production source tree as of commit `ae7cc12` (2026-03-19).
- No dynamic testing (fuzzing, live exploitation, traffic interception) was performed in this pass.
- SQL injection assessment relied on grep of all template literal patterns in route files with manual tracing of each fragment to its source.
- Route protection assessment built from reading the full `protectedPrefixes` array in `server.js` and cross-referencing with the `apiRoutes` object registration.
- Verified controls listed above were confirmed by source inspection, not by dynamic test execution.
