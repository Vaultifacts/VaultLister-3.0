# VaultLister 3.0 — Max-Depth Cross-Reference & Launch Readiness Audit

> **Date:** 2026-04-03 | **Auditor:** Claude Opus 4.6 | **Method:** Exhaustive codebase cross-reference against 5 external audit documents + all internal docs/configs/CI
> **Source documents:** LAUNCH_READINESS_MASTER.md, BUILD_ORDER_MASTER.md, ISSUE_TRACEABILITY_MATRIX.md, UX_AUDIT_MASTER.md, ROOT_CAUSES_MASTER.md

## 1. Executive Summary

VaultLister 3.0 has a **massive codebase** (67 backend route files, 26 services, 115 migrations, 22 platform sync modules, 11 middleware, 16 public HTML pages, 22 CI workflows, 55+ scripts, a Chrome extension, a worker service, and a ~72K LOC legacy monolith). The backend infrastructure is genuinely substantial. However, the project's **internal documentation and evidence files systematically overstate readiness**. Multiple "all gates PASS" claims originate from March 5-15, before two major audits found 241 + 416 issues. Legal documents are factually wrong. The CI pipeline gives a false green signal (585 baselined failures, E2E disabled). The external audit documents provided by the user are more accurate than the project's own control-plane files.

**Classification key:** VERIFIED = confirmed by reading actual code/config. HIGH-PROBABILITY = strong evidence, <100% certain. HYPOTHESIS = requires runtime verification.

---

## 2. Highest-Severity Findings (Ordered by Impact)

### CRITICAL — Legal / Compliance

**F-01: Privacy Policy says "self-hosted, local-first" and "SQLite" (4 instances)**
- Classification: VERIFIED
- Files: `public/privacy.html:233,302,311,360`
- Exact text: "VaultLister is a self-hosted, local-first platform. Your data is stored on your own server or device" and "Your data is stored in a SQLite database on your own server"
- Reality: Production is Railway-hosted SaaS with PostgreSQL
- Action: FIX — rewrite data storage section

**F-02: Terms of Service has placeholder jurisdiction**
- Classification: VERIFIED
- File: `public/terms.html:298`
- Exact text: "governed by the laws of the jurisdiction in which VaultLister is operated"
- Action: FIX — specify Province of Alberta, Canada

**F-03: SQLite/FTS5 references across 6 more public HTML pages**
- Classification: VERIFIED
- Files and lines:
  - `public/er-diagram.html:387` — "SQLite 3 in WAL mode with FTS5"
  - `public/schema.html:320` — "SQLite 3 · WAL mode · FTS5 · 38 tables total"
  - `public/schema.html:705-712` — "FTS5 virtual table", "FTS5 (SQLite built-in)"
  - `public/quickstart.html:560` — "Creates the SQLite database at data/vaultlister.db"
  - `public/quickstart.html:675` — "SQLite database and audit logs"
  - `public/changelog.html:415` — "Automated daily SQLite backups"
  - `public/changelog.html:436` — "OAuth tokens encrypted with AES-256-CBC before SQLite storage"
  - `public/changelog.html:491` — "FTS5 full-text search"
  - `public/changelog.html:496` — "SQLite WAL mode — offline-capable"
  - `public/changelog.html:510` — "Built with Bun.js + SQLite"
  - `public/api-changelog.html:375` — "FTS5"
- Action: FIX — update all to PostgreSQL/TSVECTOR

**F-04: Changelog says "AES-256-CBC" — actually GCM**
- Classification: VERIFIED
- File: `public/changelog.html:436` — "AES-256-CBC before SQLite storage"
- Reality: `src/backend/utils/encryption.js:17` — `ALGORITHM_GCM = 'aes-256-gcm'` (CBC is legacy decrypt-only at line 18)
- Action: FIX — correct to AES-256-GCM

**F-05: Demo credentials exposed on public quickstart page**
- Classification: VERIFIED
- File: `public/quickstart.html:592-596` — Shows `demo@vaultlister.com` / `DemoPassword123!` in plain text
- No "sandbox only" or "rotated regularly" disclaimer present
- Action: FIX — add clear sandbox-only disclaimer per Build Order T8.3

**F-06: Copyright year hardcoded 2025**
- Classification: VERIFIED
- File: `public/glossary.html:485` — `&copy; 2025 VaultLister`
- Action: FIX

**F-07: Glossary footer uses extensionless URLs `/terms` and `/privacy`**
- Classification: VERIFIED
- File: `public/glossary.html:485` — `href="/terms"` and `href="/privacy"`
- These extensionless URLs likely route to the SPA login screen, not the legal pages
- Action: FIX — change to `/terms.html` and `/privacy.html`

### CRITICAL — Security

**F-08: Auth lockout commented out**
- Classification: VERIFIED
- File: `src/backend/routes/auth.js:311-316` — `checkLoginAttempts` call is commented out
- Line 32: `// TODO: Re-enable for production release — lockout disabled during development/testing`
- Action: FIX before launch — uncomment, guard with `NODE_ENV === 'production'`

**F-09: OAUTH_MODE defaults to 'mock' everywhere**
- Classification: VERIFIED
- 22 files use `process.env.OAUTH_MODE || 'mock'`
- If OAUTH_MODE is not explicitly set to 'real' in Railway env, ALL platform connections return fake tokens
- Action: VERIFY Railway env has `OAUTH_MODE=real`. Add startup assertion.

**F-10: Fake data still in production frontend**
- Classification: VERIFIED
- Fake login history: `pages-deferred.js:5631-5636` and `pages-settings-account.js:1548-1553`
  - IP `192.168.1.100` (private LAN — obviously fake)
  - IP `45.33.32.156` with `type: 'login_failed'` ("suspicious" entry)
- Fake financial data: `pages-sales-orders.js:1946` — `$18,500` gross sales
- Cash flow projections: `pages-sales-orders.js:1712` and `pages-deferred.js:3839`
- Hardcoded "Connected" platform states: `pages-settings-account.js:1184`, `pages-deferred.js:5267`
- Action: FIX — replace with empty states

**F-11: SKU column has no UNIQUE constraint**
- Classification: VERIFIED
- File: `src/backend/db/pg-schema.sql:112` — `sku TEXT` (no UNIQUE, no index)
- Action: FIX — add migration

**F-12: window.richTextEditor / focusMode / sessionMonitor not exposed**
- Classification: VERIFIED
- No `window.richTextEditor =`, `window.focusMode =`, or `window.sessionMonitor =` found
- `window.handlers` and `window.modals` ARE exposed (init.js:668,667)
- Action: FIX — add window exposures

### CRITICAL — CI / Testing Truthfulness

**F-13: E2E tests permanently disabled in CI**
- Classification: VERIFIED
- File: `.github/workflows/ci.yml:204` — `if: false`
- Also `continue-on-error: true` at line 206

**F-14: .test-baseline KNOWN_FAILURES=585 but comments say 264**
- Classification: VERIFIED
- CI treats 585 failures as "passing"

**F-15: SonarCloud tests have continue-on-error: true**
- Classification: VERIFIED
- File: `.github/workflows/sonarcloud.yml:96`

### CRITICAL — Documentation Honesty

**F-16: PROJECT_ROADMAP.md claims "No required tasks remain" (March 5)**
- Classification: VERIFIED
- Written before DEEP_AUDIT (March 19, 241 findings) and external UX audit (416 issues)

**F-17: FINAL_COMPLETION_AUDIT.md claims 8/8 gates PASS (March 15)**
- Classification: VERIFIED
- Written 4 days before the deep audit found 241 issues

**F-18: PROGRESS_ACCOUNTING.md claims "2054+ pass all 3 browsers" E2E (March 15)**
- Classification: VERIFIED — E2E is now disabled in CI

**F-19: STATE_SNAPSHOT.md is from March 4**
- Classification: VERIFIED

**F-20: RISK_REGISTER.md has only 5 risks (March 5)**
- Classification: VERIFIED — missing legal, fake data, auth lockout, marketplace, carrier API risks

**F-21: RELEASE.md has multiple factual errors**
- Classification: VERIFIED — "AES-256-CBC", "SQLite FTS5", "sessionStorage only"

**F-22: ARCHITECTURE.md has stale deployment references**
- Classification: VERIFIED — Docker+Nginx, "local-first", GHCR

**F-23: DEPLOYMENT.md describes Docker+SSH, not Railway**
- Classification: VERIFIED — `deploy.yml` line 114 says "Railway will auto-deploy"

### SIGNIFICANT — Infrastructure

**F-24: Health endpoint hardcodes version '1.0.0'** — VERIFIED
**F-25: Sentry not ingesting** — HIGH-PROBABILITY
**F-26: No shipping carrier API integration** — VERIFIED
**F-27: eBay still sandbox** — HIGH-PROBABILITY
**F-28: Etsy app rejected** — HIGH-PROBABILITY
**F-29: Google Auth not configured** — HIGH-PROBABILITY
**F-30: Shopify app incomplete** — HIGH-PROBABILITY

### SIGNIFICANT — Navigation / UX

**F-31: 8 pages unreachable from sidebar** — VERIFIED
**F-32: No centralized platform list** — VERIFIED
**F-33: Silent hash aliasing** — VERIFIED

### CONFIRMED FIXED (from DEEP_AUDIT findings)

- **B-01** Mock OAuth in production — FIXED (`server.js:616` NODE_ENV guard)
- **B-02** Missing protectedPrefixes — FIXED (`server.js:698-700`)
- **B-03** /api/status leaks info — FIXED (production returns minimal)
- **DB-05** listings_folders user_id — FIXED (migration 104)
- Encryption upgraded to GCM — CONFIRMED
- Email service (Resend) — CONFIRMED
- Redis graceful fallback — CONFIRMED
- Demo login NODE_ENV guarded — CONFIRMED

---

## 3. Cleanup Matrix

| Path | Problem | Action | Safe? |
|------|---------|--------|-------|
| `public/privacy.html` | "self-hosted", "SQLite" x4 | FIX | Yes |
| `public/terms.html` | No jurisdiction | FIX | Yes |
| `public/er-diagram.html` | "SQLite 3 with FTS5" | FIX | Yes |
| `public/schema.html` | "SQLite 3", "FTS5" x4 | FIX | Yes |
| `public/quickstart.html` | "SQLite", demo creds exposed | FIX | Yes |
| `public/changelog.html` | "SQLite" x5, "AES-256-CBC" | FIX | Yes |
| `public/api-changelog.html` | "FTS5" | FIX | Yes |
| `public/glossary.html` | (c) 2025, extensionless links | FIX | Yes |
| `RELEASE.md` | SQLite, AES-CBC, sessionStorage | UPDATE | Yes |
| `docs/ARCHITECTURE.md` | Docker+Nginx, local-first | UPDATE | Yes |
| `docs/DEPLOYMENT.md` | Docker+SSH as primary | UPDATE | Yes |
| `docs/DEVOPS-AUDIT-SUMMARY.md` | Nginx SSL ref | ARCHIVE | Yes |
| `docs/evidence/FINAL_COMPLETION_AUDIT.md` | "8/8 PASS" March 15 | ARCHIVE | Yes |
| `docs/evidence/GATE_EVALUATION.json` | All PASS March 15 | ARCHIVE | Yes |
| `claude-docs/project-control/PROJECT_ROADMAP.md` | "No tasks remain" March 5 | ARCHIVE | Yes |
| `claude-docs/project-control/STATE_SNAPSHOT.md` | March 4 | ARCHIVE | Yes |
| `claude-docs/project-control/COMPLETION_GATES.md` | All PASS pre-audit | ARCHIVE | Yes |
| `nginx/` (3 files) | Not used in production | ARCHIVE | Yes |
| `.worktrees/postgres-migration/` | Old worktree | DELETE | Yes |
| `.test-baseline` | 585 vs 264 discrepancy | UPDATE | Yes |
| `.github/workflows/ci.yml` | E2E disabled | UPDATE | Yes |
| `src/backend/db/migrations/*.sql` (115 files) | Dead SQLite-era code | ARCHIVE | Yes |

---

## 4. Canonical Source-of-Truth Proposal

### TRUST:
| Domain | File(s) |
|--------|---------|
| Architecture ADRs | `design/architecture.md` |
| Data model | `design/data-model.md` + `src/backend/db/pg-schema.sql` |
| Frontend source map | `docs/FRONTEND_SOURCE_OF_TRUTH.md` |
| Build process | `scripts/build-dev-bundle.js`, `scripts/split-deferred-chunks.js` |
| CI/CD | `.github/workflows/ci.yml`, `deploy.yml` |
| Project memory | `memory/STATUS.md`, `memory/MEMORY.md` |
| Claude config | `CLAUDE.md` (root) |
| External audit | 5 downloaded audit documents (most accurate) |
| This audit | `docs/LAUNCH_AUDIT_2026-04-03.md` |

### DO NOT TRUST:
All files in `docs/evidence/`, `claude-docs/docs/project-control/`, `RELEASE.md`, `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md`, `public/privacy.html`, `public/terms.html`, and all public HTML with "SQLite".

---

## 5. Launch Blocker List

| # | Blocker | Type | Est. Effort |
|---|---------|------|-------------|
| LB-1 | Privacy Policy factually wrong | Legal | 1hr |
| LB-2 | Terms of Service no jurisdiction | Legal | 15min |
| LB-3 | Auth lockout commented out | Security | 30min |
| LB-4 | Fake data in frontend | Legal/Rep | 2hr |
| LB-5 | SQLite refs in 6 public pages | Credibility | 2hr |
| LB-6 | Demo creds without disclaimer | Security | 15min |
| LB-7 | SKU no UNIQUE constraint | Data | 30min |
| LB-8 | OAUTH_MODE defaults to mock | Platform | 30min |
| LB-9 | Sentry not ingesting | Monitoring | 30min |
| LB-10 | No shipping carrier API | Core product | Large |
| LB-11 | eBay still sandbox | Core product | External |
| LB-12 | Google Auth not configured | UX | 15min (hide) |

---

## 6. Recommended Next 10 Actions

1. FIX `public/privacy.html` — remove "self-hosted"/"SQLite"
2. FIX `public/terms.html` — add jurisdiction
3. FIX auth lockout — uncomment `checkLoginAttempts`
4. FIX SQLite refs in 6 public pages
5. FIX fake data — replace with empty states
6. FIX OAUTH_MODE — add startup assertion
7. FIX SKU uniqueness — add migration
8. FIX Sentry — verify DSN in Railway
9. UPDATE RELEASE.md — correct factual errors
10. FIX demo creds disclaimer

---

## 7. Deep-Dive: Database Migrations

- `database.js` applies: (1) `pg-schema.sql` as base, (2) `migrations/pg/*.sql` (3 files)
- 115 legacy `migrations/*.sql` files are DEAD CODE (SQLite syntax, never referenced)
- Migration errors silently swallowed ("already exists")
- Recommendation: archive legacy migrations to `migrations/legacy-sqlite/`

## 8. Deep-Dive: Full Fake Data Inventory (~40+ instances, 5 files)

- `pages-intelligence.js:1183-1801` — fake competitors, market data, category prices
- `pages-deferred.js:4073,5631-5636,13666-14128` — fake financials, login history, market data
- `pages-sales-orders.js:1946-1949` — fake gross sales/fees
- `pages-settings-account.js:1184,1548-1553` — fake "Connected" states, login history
- `pages-core.js:2211` — hardcoded revenue goal default 5000
- INTENTIONAL (not fake): plan pricing $19/$49/$50, $0.00 placeholders, filter labels

## 9. Deep-Dive: CI Pipeline (22 workflows)

Hard gates: unit tests, security scan, dep audit, CodeQL, Docker build, build size
Advisory only: E2E (disabled), visual tests, SonarCloud, Semgrep (`|| true`), QA Guardian
Net signal: CI green = "no NEW unit test regressions beyond 585 baseline"

## 10. Deep-Dive: Backend Routes (~60/40 real/stub)

Definitely real: auth, inventory, listings, sales, offers, automations, analytics, billing, webhooks, shops, oauth, imageBank, settings, community, calendar
Uncertain/stub: competitorTracking, predictions, marketIntel, suppliers, whatnot, affiliate, qrAnalytics, watermark, barcode, gdpr, socialAuth
