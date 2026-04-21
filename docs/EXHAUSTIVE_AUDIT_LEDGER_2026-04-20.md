# Exhaustive Audit Ledger

Date: 2026-04-20
Repository: `Vaultifacts/VaultLister-3.0`
Status: `IN PROGRESS`

## Scope

This ledger tracks the expanded audit scope requested on 2026-04-20:

1. Every source file in the repo, line by line
2. Every frontend page by manual browser walkthrough
3. Every backend route by manual request inspection
4. Every extension flow
5. Every mobile flow
6. Every Cloudflare setting and WAF rule in detail
7. Every Sentry issue and event
8. The live Stripe production account state end to end
9. Every GitHub issue, workflow log, and historical regression
10. Every environment variable and runtime secret mapping
11. Every database table, record class, migration side effect, and queue state

## Coverage Rule

No surface is considered complete until it is marked one of:

- `INSPECTED`
- `BLOCKED`
- `OUT OF SCOPE`

`BLOCKED` means inspection could not be completed because access, credentials, tooling coverage, or runtime reachability was insufficient.

## Repo Inventory

Current workspace inventory from `rg --files --hidden -g '!**/.git/**'`:

- Total files: `1612`
- `src`: `599`
- `docs`: `209`
- `public`: `142`
- `Platform Logos`: `113`
- `e2e`: `94`
- `.github`: `68`
- `logo`: `68`
- `scripts`: `62`
- `.claude`: `35`
- `worker`: `34`
- `qa`: `34`
- `data`: `19`
- `chrome-extension`: `18`
- `mobile`: `16`

`src` breakdown:

- `src/tests`: `321`
- `src/backend`: `197`
- `src/frontend`: `56`
- `src/shared`: `18`
- `src/extension`: `7`

Non-`src` high-value executable and audit surfaces:

- `public/uploads`: `170`
- `e2e/tests`: `85`
- `public/assets`: `75`
- `.github/workflows`: `61`
- `worker/bots`: `29`
- `qa/reports`: `22`
- `docs/commands`: `21`
- `mobile/src`: `14`
- `chrome-extension/content`: `6`
- `chrome-extension/popup`: `3`
- `chrome-extension/options`: `2`
- `chrome-extension/lib`: `2`

## Surface Status

| Surface | Status | Notes |
| --- | --- | --- |
| Root manifests and top-level config | `IN PROGRESS` | `package.json`, `README.md`, `.env.example` read; root runtime/config review partially underway |
| `src/backend` | `PENDING` | Route, middleware, services, DB, workers pending exhaustive pass |
| `src/frontend` | `PENDING` | SPA routes/pages/components pending exhaustive pass |
| `src/shared` | `PENDING` | Shared logic pending |
| `src/tests` | `PENDING` | Unit coverage and gaps pending |
| `public` | `IN PROGRESS` | Static page inventory and public E2E scope mapped; page-by-page walkthrough pending |
| `e2e/tests` | `PENDING` | Spec-by-spec coverage and regression review pending |
| `scripts` | `PENDING` | CLI, deploy, smoke, ops, security, and maintenance scripts pending |
| `.github/workflows` | `PENDING` | Workflow-by-workflow review pending |
| `worker` | `IN PROGRESS` | Worker entrypoint and file inventory mapped; bot-by-bot review pending |
| `chrome-extension` | `IN PROGRESS` | Manifest, file inventory, and background entrypoint read; content/popup/options flow review pending |
| `mobile` | `IN PROGRESS` | Manifest, file inventory, and app entrypoint read; screen-by-screen review pending |
| `docs` | `PENDING` | Review will be selective for system truth, claims, and stale guidance |
| `qa` | `PENDING` | Existing reports and coverage matrices pending reconciliation |
| Railway live deployment | `PARTIAL` | App/worker deployment state already checked in certification pass |
| GitHub Actions and issues | `IN PROGRESS` | Issue and workflow inventories now counted; full issue-by-issue and run-by-run review pending |
| Cloudflare | `PARTIAL` | Zone and DNS verified; deeper settings/WAF endpoints currently blocked by auth boundary |
| Stripe | `PARTIAL` | Sandbox account verified; production account/state not yet verified |
| Sentry | `BLOCKED` | Tooling only supports direct issue lookup; full project enumeration not available from current connector alone |
| Environment/secret mapping | `IN PROGRESS` | `.env.example` read and 241 referenced env vars extracted; runtime mapping pending |
| Database and migrations | `IN PROGRESS` | DB file inventory and worker/queue entrypoints mapped; schema and migration effects pending |

## Inspection Facts Captured So Far

### Backend surface mapping

- Backend route files inventoried: `74`
- Documented API route prefixes from `docs/API_ROUTES.md`: `73`
- Route families include auth, billing, inventory, listings, sales, reports, notifications, monitoring, webhooks, tasks, legal, roadmap, affiliates, integrations, and marketplace-specific flows

### Frontend and public page mapping

- Frontend editable/runtime module surface mapped from `docs/FRONTEND_SOURCE_OF_TRUTH.md`
- Frontend page module groups currently present:
  - `pages-core`
  - `pages-deferred`
  - `pages-admin`
  - `pages-community-help`
  - `pages-intelligence`
  - `pages-inventory-catalog`
  - `pages-sales-orders`
  - `pages-settings-account`
  - `pages-tools-tasks`
- Public HTML pages inventoried: `50`
- Public page families include landing, pricing, platforms, docs/help, compare pages, blog pages, legal pages, status/error pages, and API docs
- Current public E2E regression file reviewed: `e2e/tests/public-pages.e2e.js`

### Extension surface mapping

- Chrome extension files inventoried: `18`
- Content-script flow families identified:
  - product scraping
  - autofill
  - poster/cross-listing
  - sharing
  - sales sync
  - offers
- Background service worker reads and processes sync queue jobs, context menu actions, alarms, badge updates, offline queueing, and message passing

### Mobile surface mapping

- Mobile source files inventoried: `14`
- App entry navigation reviewed:
  - unauthenticated login flow
  - authenticated tab flows: dashboard, inventory, scan, listings, sales
  - stack screens: item detail, camera, settings

### Environment and secret surface mapping

- `.env.example` reviewed
- Distinct referenced environment variables extracted from code/workflows/scripts: `241`
- High-frequency env references include:
  - `PORT`
  - `TEST_BASE_URL`
  - `NODE_ENV`
  - `OAUTH_MODE`
  - `ANTHROPIC_API_KEY`
  - `JWT_SECRET`
  - `REDIS_URL`
  - `DATABASE_URL`
  - `GOOGLE_CLIENT_ID`
  - `XAI_API_KEY`

### Persistence and queue surface mapping

- Live non-system database tables observed: `201`
- Database files inventoried: `34`
- PostgreSQL migration files inventoried: `26`
- Worker and bot files inventoried: `39`
- `src/backend/db/database.js` reviewed at the entrypoint level:
  - postgres.js adapter
  - query metrics
  - pool monitoring
  - SQL placeholder/boolean normalization
- `worker/index.js` reviewed at the entrypoint level:
  - BullMQ worker bootstrap
  - Redis/database requirements
  - stale-job cleanup
  - expired-data cleanup lock
  - automation job dispatch for Poshmark, Mercari, Depop, Grailed, Facebook, and Whatnot
- Live queue-related table structures verified directly:
  - `tasks`
  - `task_queue`
  - `sync_queue`
  - `relisting_queue`
  - `platform_incidents`
  - `platform_uptime_samples`
  - `migrations`
- Live row counts verified directly:
  - `migrations`: `28`
  - `tasks`: `0`
  - `task_queue`: `0`
  - `sync_queue`: `0`
  - `relisting_queue`: `0`
  - `platform_incidents`: `2`
  - `platform_uptime_samples`: `1104`

### GitHub history inventory

- Total GitHub issues counted with `gh issue list --state all --limit 300`: `208`
- Active workflows currently listed: `49`
- Recent workflow run sample reviewed: `500` runs
- Non-success conclusions in that sample: `94`

### Cloudflare coverage and blocker

- Zone `vaultlister.com` verified active
- Apex and `www` proxied CNAMEs to Railway verified
- Attempted deeper settings, rulesets, and WAF inspection failed with Cloudflare API auth error `10000`
- Result: detailed Cloudflare settings/WAF review is currently `BLOCKED` by auth scope, not by omission

## Known Access Constraints

- Sentry: available connector supports issue-by-issue lookup, not full project enumeration
- Stripe: current connected account observed during certification was sandbox/test mode, not proven live production
- Production DB direct schema inspection is now working; deeper table-by-table record-state review is still pending
- A true click-by-click walkthrough of every UI surface requires a stable browser-driving path per surface; this is pending setup/reconciliation with existing Playwright assets

## Initial Findings Carried Forward

These are already verified from the earlier certification pass and remain open until disproven:

- Local `HEAD` and deployed production commit do not match
- Local worktree was not clean during the certification attempt
- `post-deploy-check` failed on ETag validation
- WebSocket production smoke failed with `Invalid or expired token`
- Queue metrics production smoke timed out
- `CI` failed on `Public Pages E2E` because expected count was `9` and observed count was `10`
- Cloudflare zone and apex/`www` DNS mapping to Railway were verified
- Connected Stripe account was sandbox only during the certification pass
- Observability verification remained incomplete due missing Sentry workflow secrets and limited connector coverage

## Findings Added During Exhaustive Audit

### F-EXH-001: `docs/API_ROUTES.md` is materially stale relative to the live server mount table

Severity: `MEDIUM`
Status: `REMEDIATED LOCALLY / REVERIFIED (2026-04-21); GITHUB REVERIFICATION PENDING DEPLOY`

Evidence:

- Documented API prefixes parsed from `docs/API_ROUTES.md`: `72`
- Mounted API prefixes parsed from non-comment route entries in `src/backend/server.js`: `91`
- Prefixes mounted in `server.js` but absent from the doc include:
  - `/api/account`
  - `/api/admin/affiliate-applications`
  - `/api/admin/incidents`
  - `/api/admin/workers/uptime-probe/trigger`
  - `/api/affiliate-apply`
  - `/api/contact`
  - `/api/csp-report`
  - `/api/currency`
  - `/api/docs`
  - `/api/feature-requests`
  - `/api/health/detailed`
  - `/api/health/live`
  - `/api/health/platforms`
  - `/api/health/ready`
  - `/api/incidents`
  - `/api/integrations`
  - `/api/settings`
  - `/api/sync`
  - `/api/workers/health`

Impact:

- Backend documentation understates the reachable API surface
- Request-by-request inspection cannot rely on the current route doc as a complete source of truth

### F-EXH-002: `README.md` architecture and test-count claims are stale

Severity: `LOW`
Status: `VERIFIED`

Evidence:

- README claims `16 migrations`
- Current repo shows `26` SQL migration files, and the code also applies the consolidated `001_pg_schema.sql`, bringing the tracked migration artifacts to `27`
- README claims `67` API route handler files
- Current repo has `74` files in `src/backend/routes`
- README claims `54 spec files, 761 tests`
- Current repo has `85` files under `e2e/tests`
- README claims `58+ test files in src/tests`
- Current repo has `321` files under `src/tests`

Impact:

- Current architecture/test counts in README are not reliable for audit or onboarding use
- Repo-level documentation no longer matches the actual code footprint

### F-EXH-003: `.env.example` no longer covers the full referenced environment surface

Severity: `MEDIUM`
Status: `VERIFIED`

Evidence:

- Distinct variables declared in `.env.example`: `186`
- Distinct `process.env.*` references extracted from code/scripts/workflows: `241`
- Referenced variables missing from `.env.example` include real operational/runtime names such as:
  - `REDIS_PUBLIC_URL`
  - `PUBLIC_BASE_URL`
  - `DATABASE_SSL`
  - `NOTION_INTEGRATION_TOKEN`
  - `DEPOP_COUNTRY_CODE`
  - `DEPOP_OAUTH_URL`
  - `DEPOP_TOKEN_URL`
  - `DEPOP_USER_URL`
- The missing set also contains workflow-only or diagnostic names, which indicates the code/workflow env surface is not centrally curated
- Variables declared in `.env.example` but not referenced by the extracted `process.env.*` set include:
  - `STRIPE_PUBLIC_KEY`
  - `SENTRY_DSN_FRONTEND`
  - `SESSION_SECRET`
  - `OPENAI_API_KEY`
  - `REDIS_PASSWORD`
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`

Impact:

- `.env.example` is no longer a reliable complete setup contract
- Operators can miss required values, and stale example values can imply support for paths that are no longer used directly

### F-EXH-004: Live migration history has drifted from the current repo migration file set

Severity: `HIGH`
Status: `VERIFIED`

Evidence:

- Repo migration artifact count: `27`
  - `001_pg_schema.sql`
  - `26` SQL files in `src/backend/db/migrations/pg`
- Live `migrations` table count: `28`
- Migration names present in the DB but not present in the repo:
  - `005_inventory_sustainability_score_jsonb.sql`
- The current repo instead contains:
  - `012_inventory_sustainability_score_jsonb.sql`
- The live database therefore records both:
  - `005_inventory_sustainability_score_jsonb.sql`
  - `012_inventory_sustainability_score_jsonb.sql`

Impact:

- Migration history was renumbered or renamed after at least one environment had already applied the earlier name
- This weakens reproducibility and increases the risk of environment-specific migration state drift
- Future migration auditing cannot assume migration names are stable across environments

### F-EXH-005: Existing doc-drift tests are too weak and partially stale

Severity: `MEDIUM`
Status: `VERIFIED`

Evidence:

- `src/tests/envq-invariants-doc-drift.test.js` checks route drift by comparing:
  - regex count of router imports in `server.js`
  - markdown route row count in `docs/API_ROUTES.md`
- Reproducing that test logic today yields:
  - `server_imports_router_regex`: `77`
  - `doc_route_rows`: `72`
  - absolute diff: `5`
- The current test threshold is `expect(Math.abs(serverImports - docRoutes)).toBeLessThan(10)`, so it would still pass
- Meanwhile, the actual mounted-prefix drift verified in this audit is `19` undocumented live prefixes
- The same test file also still requires `.env.example` to contain `DB_PATH`, even though the project has moved to PostgreSQL and `.env.example` documents `DATABASE_URL`

Impact:

- Existing tests can report green while route documentation remains materially incomplete
- The env completeness guard is anchored to a legacy variable and does not enforce the current deployment contract accurately

### F-EXH-006: `docs/DATABASE_SCHEMA.md` is missing even though current tests expect it

Severity: `LOW`
Status: `VERIFIED`

Evidence:

- `src/tests/envq-invariants-doc-drift.test.js` contains `expect(existsSync(join(projectRoot, 'docs/DATABASE_SCHEMA.md'))).toBe(true);`
- Direct filesystem check confirms `docs/DATABASE_SCHEMA.md` does not exist in the current repo

Impact:

- At least one documentation invariant currently targets a nonexistent artifact
- The project’s schema-documentation expectations are out of sync with the actual docs set

### F-EXH-007: Green unit-test workflows do not imply a passing unit suite

Severity: `HIGH`
Status: `VERIFIED`

Evidence:

- `.github/workflows/deploy.yml` runs `bun test src/tests/`, but if tests fail it falls back to `bun scripts/test-baseline.mjs check-output /tmp/test-output.txt`
- `.github/workflows/ci.yml` does the same for `bun test --coverage src/tests/`
- `.test-baseline` currently sets:
  - `KNOWN_FAILURES=370`
  - comment: `added headroom for flaky tests`
- The baseline file records hundreds of known failing tests and explicitly permits pre-existing failures in CI
- Therefore, workflow success means:
  - no failure outside the named baseline set
  - total failures do not exceed the allowed baseline
- It does **not** mean the unit suite passed cleanly with zero failures

Impact:

- CI and deploy checks overstate the health of the unit-test surface if read as ordinary green test jobs
- Existing broken tests can persist indefinitely without turning the workflow red as long as they remain within the baseline allowance

### F-EXH-008: License metadata is internally contradictory

Severity: `MEDIUM`
Status: `VERIFIED`

Evidence:

- `package.json` declares `"license": "MIT"`
- `README.md` states:
  - `## License`
  - `Proprietary. All rights reserved.`

Impact:

- Package metadata and repository documentation do not agree on the legal license of the project
- Tooling, downstream consumers, and auditors cannot rely on a single authoritative licensing statement

### F-EXH-009: Runtime version requirements are inconsistent between `package.json` and `README.md`

Severity: `LOW`
Status: `VERIFIED`

Evidence:

- `package.json` engines declare:
  - `bun >=1.0.0`
  - `node >=18.0.0`
- `README.md` prerequisites declare:
  - `Bun 1.3+`
  - `Node.js 20+`

Impact:

- The repo presents conflicting minimum runtime requirements depending on which source a developer follows
- Environment setup and CI/runtime expectations are less predictable than they appear

### F-EXH-010: 23 mounted API prefixes have no direct string reference in `src/tests` or `e2e/tests`

Severity: `MEDIUM`
Status: `VERIFIED`

Evidence:

- Mounted API prefixes parsed from `src/backend/server.js`: `91`
- Prefixes with no direct literal reference found across `src/tests/**` and `e2e/tests/**`: `23`
- Examples include:
  - `/api/account`
  - `/api/admin/affiliate-applications`
  - `/api/admin/incidents`
  - `/api/admin/workers/uptime-probe/trigger`
  - `/api/affiliate-apply`
  - `/api/chatbot`
  - `/api/checklists`
  - `/api/help`
  - `/api/inventory-import`
  - `/api/market-intel`
  - `/api/receipts`
  - `/api/sku-rules`
  - `/api/suppliers`
  - `/api/sync`
  - `/api/tasks`
  - `/api/webhooks`

Impact:

- A meaningful slice of the mounted API surface lacks direct endpoint-level references in the current test trees
- This does not prove zero coverage, but it does indicate weaker explicit request-coverage than the mounted surface suggests

### F-EXH-011: Public-pages E2E expectations are stale relative to current source content

Severity: `MEDIUM`
Status: `VERIFIED`

Evidence:

- `e2e/tests/public-pages.e2e.js` expects:
  - `9` marketplace tiles on `landing.html`
  - `2` coming-soon marketplace tiles on `landing.html`
  - `9` platform cards on `platforms.html`
- Current source markup contains:
  - `7` live marketplace tiles on `landing.html`
  - `7` coming-soon marketplace tiles on `landing.html`
  - `14` total marketplace tiles on `landing.html`
  - `10` platform-card `<article>` elements on `platforms.html`
- This matches the observed CI failure pattern on `Public Pages E2E`

Impact:

- The failing public-pages CI job is currently explained by stale test expectations, not just ambiguous runtime flakiness
- Marketing/public-page changes are outpacing the corresponding regression oracles

### F-EXH-012: Public incident-subscription confirmation is broken in production

Severity: `HIGH`
Status: `VERIFIED`

Evidence:

- Live production request:
  - `GET https://vaultlister.com/api/incidents/confirm?token=bogus` returns `500 Internal Server Error`
- Companion endpoint behavior is different:
  - `GET https://vaultlister.com/api/incidents/unsubscribe?token=bogus` returns the expected `404 Invalid or already-used token`
- The current route implementation in `src/backend/routes/incidentSubscriptions.js` expects invalid confirm tokens to return `404`:
  - `if (!sub) return { status: 404, data: { error: 'Invalid or expired token' } };`
- Reproducing the current router locally against the live database throws:
  - `PostgresError: operator does not exist: boolean = integer`
- The live database schema confirms `incident_subscriptions.confirmed` is a PostgreSQL `boolean` column
- The shared SQL adapter in `src/backend/db/database.js` rewrites SQL boolean literals via `normalizeSqlBooleans()`, converting:
  - `confirmed = FALSE`
  - into
  - `confirmed = 0`
- That rewrite is incompatible with a real PostgreSQL boolean column and explains why the confirm lookup throws before the route can return its intended `404`

Impact:

- The double-opt-in confirmation link on the public status subscription flow is broken
- New incident subscribers can submit the form but cannot successfully confirm their subscription
- This is a live production defect on a public user-facing path, not just a documentation or test gap

### F-EXH-013: 11 live API prefixes are simultaneously undocumented and absent from direct endpoint-level test references

Severity: `MEDIUM`
Status: `VERIFIED`

Evidence:

- Brace-aware parsing of `const apiRoutes = { ... }` in `src/backend/server.js` yields:
  - `91` mounted `/api/*` prefixes
- `docs/API_ROUTES.md` currently documents:
  - `72` prefixes
- Direct string search across `src/tests/**` and `e2e/tests/**` shows:
  - `23` mounted prefixes with no direct literal endpoint reference
- The intersection of those two sets is `11` live prefixes:
  - `/api/admin/incidents`
  - `/api/incidents`
  - `/api/account`
  - `/api/sync`
  - `/api/affiliate-apply`
  - `/api/feature-requests`
  - `/api/docs`
  - `/api/health/platforms`
  - `/api/admin/workers/uptime-probe/trigger`
  - `/api/admin/affiliate-applications`
  - `/api/csp-report`
- Safe live reads confirm that multiple members of this set are active in production right now:
  - `GET /api/docs` → `200`
  - `GET /api/health/platforms` → `200`
  - `GET /api/feature-requests?sort=votes` → `200`
  - `GET /api/account/data-export/status` → `401`
  - `GET /api/sync/audit-log` → `401`
  - `GET /api/admin/incidents` → `401`

Impact:

- There is a verified cluster of mounted production routes that sit outside both the published route doc and direct endpoint-level regression references
- This increases the chance of silent breakage on public, authenticated, and admin surfaces
- The risk is not theoretical: at least one member of this blind set (`/api/incidents`) is already broken in production

### F-EXH-014: Public pages depend on blind API routes that are not covered by the current public-pages E2E suite

Severity: `MEDIUM`
Status: `VERIFIED`

Evidence:

- `public/affiliate.html` submits the public affiliate application form to:
  - `/api/affiliate-apply`
- `public/request-feature.html` depends on:
  - `GET /api/feature-requests`
  - `POST /api/feature-requests/:id/vote`
  - `POST /api/feature-requests`
- `public/status.html` depends on:
  - `GET /api/health/platforms`
  - `POST /api/incidents/subscribe`
- The current `e2e/tests/public-pages.e2e.js` covers:
  - landing
  - pricing
  - contact
  - changelog
  - platforms
  - compare pages
- Direct search over `e2e/tests` and `src/tests` finds no page-level references to:
  - `request-feature.html`
  - `affiliate.html`
  - `status.html`

Impact:

- Important public product flows currently depend on API routes that are already outside the route doc and outside direct endpoint-level test references
- The current public-pages suite would not catch regressions in the affiliate application flow, feature-request board flow, or status subscription/platform-health flow
- This helps explain how the broken `/api/incidents/confirm` path remained undiscovered

### F-EXH-015: Public feature-request board is broken for anonymous POST actions

Severity: `HIGH`
Status: `VERIFIED`

Evidence:

- `public/request-feature.html` performs public POST actions with no CSRF token handling:
  - vote action:
    - `fetch('/api/feature-requests/' + encodeURIComponent(id) + '/vote', { method: 'POST', headers: { 'Content-Type': 'application/json' } })`
  - submit action:
    - `fetch('/api/feature-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, ... })`
- The page source does not fetch `/api/csrf-token`, does not read the `X-CSRF-Token` response header, and does not attach any CSRF token to those POSTs
- Live production behavior confirms anonymous POSTs are blocked:
  - `POST /api/feature-requests` with empty JSON returns `403 CSRF token missing`
  - `POST /api/feature-requests/nonexistent/vote` with empty JSON returns `403 CSRF token missing`
- Read-only access still works:
  - `GET /api/feature-requests?sort=votes` returns `200`
- That same public GET response already emits a usable anonymous CSRF token header:
  - `GET /api/feature-requests?sort=votes` returns `X-CSRF-Token: <token>`
- Replaying the same anonymous POSTs with that header changes the behavior from CSRF rejection to normal route handling:
  - `POST /api/feature-requests` with `X-CSRF-Token` and empty JSON returns `400 Name is required`
  - `POST /api/feature-requests/nonexistent/vote` with `X-CSRF-Token` returns `404 Feature request not found`
- `src/backend/middleware/csrf.js` exempts these public POST endpoints:
  - `/api/contact`
  - `/api/incidents/subscribe`
  - `/api/affiliate-apply`
- The same CSRF skip list does **not** exempt:
  - `/api/feature-requests`
- Anonymous clients also cannot recover by fetching the documented CSRF helper anonymously:
  - live `GET /api/csrf-token` returns `401 Authentication required`

Impact:

- The public feature-request board can load requests but anonymous users cannot vote or submit new requests successfully
- This is a live production defect on a public marketing/support surface
- The page’s shipped frontend contract and the backend CSRF contract are currently incompatible
- The underlying backend path is not fundamentally blocked for anonymous users; the shipped frontend is failing to read and forward the token material already available on its own same-origin GET response

### F-EXH-016: Public API change log documents a nonexistent CSRF endpoint

Severity: `MEDIUM`
Status: `VERIFIED`

Evidence:

- `public/api-changelog.html` states:
  - `All mutating routes require a valid X-CSRF-Token header (token issued via GET /api/auth/csrf).`
- Live production behavior:
  - `GET /api/auth/csrf` returns `404 Route not found`
- Current server route map exposes:
  - `/api/csrf-token`
- Current test suite also targets:
  - `/api/csrf-token`
- Live production behavior for the actual helper route is:
  - `GET /api/csrf-token` returns `401 Authentication required`

Impact:

- Public-facing API guidance points integrators to an endpoint that does not exist
- The documented CSRF acquisition path does not match the real server surface
- This compounds the confusion around public mutating endpoints such as the feature-request board

### F-EXH-017: `public-pages.e2e.js` exercises only 6 of 51 public HTML routes

Severity: `MEDIUM`
Status: `VERIFIED`

Evidence:

- Current repo public HTML inventory:
  - `51` `.html` files under `public/**`
- `e2e/tests/public-pages.e2e.js` navigates only these unique public routes:
  - `/`
  - `/pricing.html`
  - `/contact.html`
  - `/changelog.html`
  - `/platforms.html`
  - `/compare/vendoo.html`
- That means the suite directly visits only `6` public routes while omitting the rest of the public surface, including:
  - `affiliate.html`
  - `request-feature.html`
  - `status.html`
  - `faq.html`
  - `help.html`
  - other compare pages
  - blog/help/documentation-style pages

Impact:

- The current public browser regression suite covers only a small fraction of the actual public surface
- Public pages with interactive API dependencies can break without being exercised by the named public-pages suite
- The suite name overstates the breadth of public-surface coverage

### F-EXH-018: Public OpenAPI spec is materially stale relative to the live mounted API surface

Severity: `MEDIUM`
Status: `VERIFIED`

Evidence:

- Normalizing `public/api-docs/openapi.yaml` to top-level `/api/*` prefixes yields:
  - `65` OpenAPI prefixes
- The live mounted route map in `src/backend/server.js` yields:
  - `91` mounted prefixes
- Mounted live prefixes missing from the public OpenAPI spec include `28` top-level surfaces such as:
  - `/api/account`
  - `/api/admin/affiliate-applications`
  - `/api/admin/incidents`
  - `/api/admin/workers/uptime-probe/trigger`
  - `/api/affiliate`
  - `/api/affiliate-apply`
  - `/api/audit`
  - `/api/contact`
  - `/api/csp-report`
  - `/api/csrf-token`
  - `/api/currency`
  - `/api/docs`
  - `/api/feature-requests`
  - `/api/health/platforms`
  - `/api/incidents`
  - `/api/integrations`
  - `/api/settings`
  - `/api/sync`
  - `/api/workers/health`
- The public OpenAPI spec still advertises prefixes that are no longer mounted:
  - `/api/notion`
  - `/api/shipping-labels`
- Live production checks confirm those stale advertised surfaces do not exist:
  - `GET /api/notion/sync/status` → `404`
  - `GET /api/shipping-labels` → `404`
- Meanwhile the current mounted counterpart for shipping labels is:
  - `GET /api/shipping-labels-mgmt` → `401`

Impact:

- Public API consumers are shown an incomplete and partially obsolete contract
- Removed integrations remain documented while real live prefixes are omitted
- This raises the risk of integration work being built against routes that do not exist in production

### F-EXH-019: Public API changelog documents nonexistent platform-integration endpoints

Severity: `MEDIUM`
Status: `VERIFIED`

Evidence:

- `public/api-changelog.html` documents:
  - `GET /api/platforms`
  - `DELETE /api/platforms/:platform`
- Live production behavior:
  - `GET /api/platforms` → `404 Not found`
- The mounted route map does not expose `/api/platforms`
- The current codebase instead exposes related platform/account surfaces through routes such as:
  - `/api/shops`
  - `/api/oauth`
  - `/api/integrations`

Impact:

- Public-facing API change documentation points integrators to endpoints that are not available
- Readers of the changelog cannot trust it as an accurate representation of the current integration surface

### F-EXH-020: `status.html` assumes ETag-based polling savings that the live endpoint does not honor

Severity: `LOW`
Status: `VERIFIED`

Evidence:

- `public/status.html` states:
  - `cache: 'default' lets the browser honor our ETag and receive 304 Not Modified`
  - then polls `GET /api/health/platforms`
- Live production headers for `GET /api/health/platforms` currently include:
  - `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate`
  - `Pragma: no-cache`
  - `ETag: W/"e6b19a06e5a9107fc36920dac76f88d5"`
- Replaying a conditional request with that same ETag still returns:
  - `GET /api/health/platforms` with `If-None-Match: W/"e6b19a06e5a9107fc36920dac76f88d5"` → `200 OK`
- The backend implementation for `/api/health/platforms` only returns `{ status: 200, data: ... }` from an in-process cache and does not implement a `304 Not Modified` branch

Impact:

- The public status page comments and polling assumptions do not match live cache behavior
- Polling clients do not get the advertised bandwidth savings from conditional requests
- This aligns with the earlier certification failure on HTTP cache validation rather than being an isolated test flake

### F-EXH-021: `rate-limits.html` understates the unauthenticated public API surface

Severity: `LOW`
Status: `VERIFIED`

Evidence:

- `public/rate-limits.html` states:
  - `Only public endpoints (health check, status, OAuth callbacks) are accessible without authentication.`
  - `All other endpoints return 401 Unauthorized.`
- Live unauthenticated production behavior disproves that statement:
  - `POST /api/contact` with empty JSON returns `400 Name is required`
  - `POST /api/affiliate-apply` with empty JSON returns `400 Name is required`
  - `POST /api/incidents/subscribe` with empty JSON returns `400 Valid email required`
  - `GET /api/feature-requests?sort=votes` returns `200`
  - `GET /api/docs` returns `200`
  - `GET /api/health/platforms` returns `200`
- `src/backend/middleware/csrf.js` also explicitly exempts several of those unauthenticated public POST surfaces from CSRF enforcement:
  - `/api/contact`
  - `/api/incidents/subscribe`
  - `/api/affiliate-apply`

Impact:

- Public operational docs misdescribe the actual anonymous attack surface and integration surface
- Readers are told to expect `401` on endpoints that are intentionally reachable without a JWT
- This makes the public docs less trustworthy for integrators, security review, and QA

### F-EXH-022: GitHub `CI` is repeatedly failing on stale public-pages E2E count assertions

Severity: `MEDIUM`
Status: `VERIFIED`

Evidence:

- The three most recent failed `CI` workflow runs on `master` all fail the same job:
  - run `24686106241` (`2026-04-20T19:29:41Z`) → `E2E Smoke` failed
  - run `24687112768` (`2026-04-20T19:52:45Z`) → `E2E Smoke` failed
  - run `24689890227` (`2026-04-20T20:54:33Z`) → `E2E Smoke` failed
- The failed Playwright assertions are stable across those runs:
  - `e2e/tests/public-pages.e2e.js:36` expects `9` landing marketplace tiles, but the job logs show `unexpected value "14"`
  - `e2e/tests/public-pages.e2e.js:183` expects `9` platform cards, but the job logs show `unexpected value "10"`
- Direct live-browser verification against production matches the failing CI observations:
  - `https://vaultlister.com` currently renders `14` `.vinyl-wrapper, .vinyl-wrapper-soon` tiles
  - that same landing page currently renders `7` `.vinyl-wrapper-soon` tiles
  - `https://vaultlister.com/platforms.html` currently renders `10` `.platform-card` elements
- The checked-in test file still hard-codes the stale expectations:
  - landing page assertion expects `9`
  - platforms page assertion expects `9`

Impact:

- Required GitHub `CI` is red for a repeatable reason, not an intermittent flake
- Public-pages smoke coverage is stale in a way that blocks merges while still missing other public interactive surfaces
- The repo’s current public-site assertions no longer represent the shipped marketing site

Remediation / reverification (2026-04-21):

- Updated `e2e/tests/public-pages.e2e.js` to match the currently shipped Chromium-visible counts:
  - landing marketplace tiles: `14`
  - landing coming-soon tiles: `7`
  - platform cards: `10`
- Local Chromium verification still matches those counts.
- `bun run test:e2e:public` now passes cleanly:
  - `28 passed`
- The earlier failing GitHub run `24689890227` remains part of the deployed SHA history until a new green `CI` run is produced from a snapshot containing this fix.

### F-EXH-023: Observability automation is misaligned with the real metrics endpoint contract

Severity: `MEDIUM`
Status: `VERIFIED`

Evidence:

- Open GitHub issue `#398` (`[Observability] 3 pipeline issue(s) — 2026-04-20`) tells responders:
  - `Check /api/monitoring/metrics on the live app — verify it returns Prometheus text format`
- The actual route implementation in `src/backend/routes/monitoring.js` does **not** match that guidance:
  - `GET /api/monitoring/metrics` returns JSON stats and is admin-only
  - `GET /api/monitoring/metrics/prometheus` is the Prometheus text endpoint and is also admin-only
- Live unauthenticated production behavior confirms both routes are gated:
  - `GET /api/monitoring/metrics` → `401 Authentication required`
  - `GET /api/monitoring/metrics/prometheus` → `401 Authentication required`
- The issue body also reports:
  - `Prometheus metrics | FAIL | HTTP 401000`

Impact:

- The observability automation issue points responders at the wrong endpoint shape and obscures the auth requirement
- Alert consumers cannot tell from the issue whether the failure is expected auth gating, bad workflow credentials, or a broken metrics endpoint
- This reduces trust in the observability-health signal and slows triage

### F-EXH-024: Infrastructure audit reports false-positive “orphaned” frontend chunks

Severity: `LOW`
Status: `VERIFIED`

Evidence:

- Open GitHub issue `#406` (`[Infra Audit] Issues detected — 2026-04-20`) reports:
  - `2 orphaned chunk(s): chunk-admin.js chunk-deferred.js`
- The workflow logic in `.github/workflows/infra-audit.yml` only marks a chunk as referenced if its basename appears in:
  - `src/frontend/index.html`
  - `public/`
- That heuristic ignores the actual runtime chunk-loading path:
  - `scripts/build-frontend.js` writes both `admin` and `deferred` into `dist/manifest.json`
  - `src/frontend/core/router.js` maps admin routes to the `admin` chunk and `ar-preview` to the `deferred` chunk
  - `src/frontend/init.js` eagerly loads the `deferred` chunk after first render
  - `src/frontend/core/router.js` `loadChunk()` dynamically injects `/chunk-{name}.js?v=...`
- The flagged chunk URLs are live and served in production:
  - `GET /chunk-admin.js?v=8c0df4c1` → `200`
  - `GET /chunk-deferred.js?v=8c0df4c1` → `200`

Impact:

- The infra-audit automation is producing at least one verified false positive
- That makes the generated GitHub issue noisy and less useful as an infrastructure signal
- Engineers can waste time chasing intentionally generated runtime chunks as if they were dead build artifacts

### F-EXH-025: Automation-coverage issue is reporting demonstrably covered scripts as “uncovered”

Severity: `LOW`
Status: `VERIFIED`

Evidence:

- Open GitHub issue `#407` (`[Automation Coverage] 25 gap(s) detected — 2026-04-20`) lists these scripts as uncovered:
  - `scripts/pg-backup.js`
  - `scripts/launch-ops-check.mjs`
  - `scripts/queue-ops.mjs`
  - `scripts/post-deploy-check.mjs`
  - `scripts/verify-railway-deploy.mjs`
  - `scripts/benchmark.js`
- Those scripts are already referenced in repo truth sources that the workflow claims to index:
  - `package.json` references:
    - `scripts/pg-backup.js`
    - `scripts/launch-ops-check.mjs`
    - `scripts/queue-ops.mjs`
    - `scripts/verify-railway-deploy.mjs`
  - `.github/workflows/backup.yml` invokes `scripts/pg-backup.js`
  - `.github/workflows/deploy.yml` invokes:
    - `scripts/post-deploy-check.mjs`
    - `scripts/verify-railway-deploy.mjs`
  - `.github/workflows/production-smoke.yml` invokes `scripts/launch-ops-check.mjs`
  - `.github/workflows/infra-audit.yml` invokes `scripts/benchmark.js`
- The automation-coverage workflow source explicitly says it concatenates:
  - workflow YAML
  - `package.json`
  - railway configs
  - Dockerfiles
  - all `scripts/*`
  - then greps that blob for each script basename

Impact:

- The weekly automation-coverage issue is generating verified false positives
- That makes the issue less reliable as a prioritization signal and can hide real uncovered items in noise
- The repo currently has multiple GitHub automation streams producing misleading findings, not just one isolated workflow

### F-EXH-026: External service health workflow false-positively reports the currency API as down

Severity: `LOW`
Status: `VERIFIED`

Evidence:

- Open GitHub issue `#405` (`[Service Health] 1 service(s) need attention — 2026-04-20`) reports `Currency API | fail | HTTP 301`
- `.github/workflows/service-health-checks.yml` checks `https://api.frankfurter.app/latest` with `curl` but does not follow redirects
- Direct live checks now return:
  - `HEAD https://api.frankfurter.app/latest` -> `301` with `Location: https://api.frankfurter.dev/v1/latest`
  - Node `fetch('https://api.frankfurter.app/latest?base=USD&symbols=EUR,GBP,AUD,JPY,CAD')` follows the redirect and returns `200`
- The app's own currency integration in `src/backend/services/currencyService.js` uses `fetch`, so it follows the vendor redirect and still receives current rates

Impact:

- The weekly service-health workflow is generating a verified false-positive failure for the currency API
- Engineers are being told the dependency is down when the real condition is a vendor URL redirect that the app already tolerates
- This reduces trust in the service-health issue stream and obscures genuine third-party outages

### F-EXH-027: Internal service health workflow is misaligned with live health contracts and auth boundaries

Severity: `MEDIUM`
Status: `VERIFIED`

Evidence:

- Open GitHub issue `#394` (`[Internal Health] 6 service(s) need attention — 2026-04-16`) was created by `.github/workflows/internal-service-health.yml`
- The workflow checks `https://vaultlister-app-production.up.railway.app/api/health` for:
  - `.schedulers.tokenRefresh`
  - `.schedulers.sync`
  - `.rateLimiter.backend`
- The live `/api/health` contract only returns basic process/database status and does not expose those fields
- The app already exposes worker heartbeat data on `/api/workers/health`, and the live response reports:
  - `overall: ok`
  - `tokenRefreshScheduler.status: ok`
  - other worker heartbeats as `ok`
- The same workflow probes admin-gated monitoring routes without credentials:
  - `GET /api/monitoring/metrics` -> `401`
  - `GET /api/monitoring/queue-health` -> `401`
- The workflow still turns those auth failures into warning text that reads like runtime-service degradation

Impact:

- The internal-health issue stream mixes real unknowns with verified contract/auth mismatches
- At least the token-refresh scheduler warning is a false positive because the live worker heartbeat endpoint already reports it healthy
- Responders cannot distinguish missing observability coverage from an actually failing internal service

### F-EXH-028: Redis health workflow is reading the wrong endpoint shape and opening false infrastructure issues

Severity: `MEDIUM`
Status: `VERIFIED`

Evidence:

- Open GitHub issue `#402` (`[Redis] Health check failed — Redis may be down or misconfigured`) says the weekly Redis health check reported status `unknown`
- `.github/workflows/redis-health.yml` reads `https://vaultlister-app-production.up.railway.app/api/health` and extracts `.redis // .services.redis // "unknown"`
- The live `/api/health` response does not contain any Redis field; it only returns:
  - `status`
  - `timestamp`
  - `version`
  - `uptime`
  - `database.status`
- The live readiness endpoint already exposes Redis health correctly:
  - `GET /api/health/ready` -> `200`
  - response includes `checks.redis: "ok"`
- The workflow therefore converts an absent field on the wrong endpoint into an infrastructure incident

Impact:

- The repo is generating false Redis incident issues even when the live readiness contract reports Redis healthy
- This creates unnecessary infrastructure noise and makes future real Redis regressions harder to triage
- The automation is currently checking the wrong contract, not proving an actual Redis outage

### F-EXH-029: Stripe billing flow allows duplicate active subscriptions while tracking only one per user

Severity: `HIGH`
Status: `VERIFIED`

Evidence:

- The connected Stripe account is `Vaultifacts sandbox`, and `balance.livemode` is `false`
- In that connected Stripe environment, customer `cus_UA7qk9ktJNJiYu` currently has `5` active VaultLister subscriptions:
  - `2` active subscriptions on `price_1TBmBGBO26AWLnmlWII2cXi5` (`VaultLister Pro`)
  - `3` active subscriptions on `price_1TBmAzBO26AWLnmlWjSpXDQ6` (`VaultLister Starter`)
- `POST /api/billing/checkout` in `src/backend/routes/billing.js` validates `planId` and placeholder price IDs, then always creates a new Stripe Checkout session; it does not check for an existing active Stripe subscription first
- `POST /api/billing/cancel` only cancels the single `stripe_subscription_id` stored on the user row
- `customer.subscription.updated` in `src/backend/routes/webhooks.js` also only persists one `stripe_subscription_id` and one `subscription_tier` per user
- Earlier active subscriptions on the same Stripe customer are therefore left active in Stripe while the app only tracks the most recently written one

Impact:

- A single VaultLister user can accumulate multiple concurrent paid subscriptions on the same Stripe customer
- The app can only surface and cancel one tracked subscription, leaving older active subscriptions billable but effectively invisible in the product state
- This is already verified in the connected Stripe sandbox and would carry the same risk in production if live keys use the same flow

### F-EXH-030: Multiple open automated GitHub issues are stale after later successful runs

Severity: `LOW`
Status: `VERIFIED`

Evidence:

- Issue `#386` (`[Marketplace] Integration health issue — 2026-04-15`) is still open, but `gh run list --workflow marketplace-health.yml --limit 10` shows later scheduled runs on `2026-04-16`, `2026-04-17`, `2026-04-18`, `2026-04-19`, and `2026-04-20` all completed `success`
- Issue `#387` (`[Bot Health] Session expiry detected — 2026-04-15`) is still open, but `gh run list --workflow bot-session-health.yml --limit 10` shows later scheduled runs on `2026-04-16` through `2026-04-20` all completed `success`
- Issue `#389` (`[Deploy Failure] 2fc4e3c — Run #744`) is still open, but `gh run list --workflow deploy.yml --limit 10` shows repeated successful deploy runs on `2026-04-20`
- Issue `#388` (`[CI Failure] master - Run #1065`) is still open even though it points at an older failure shape (`Docker Build` and `Dependency Audit`), while current `master` CI failures are different stale public-pages assertions
- `.github/workflows/auto-create-issue-on-ci-failure.yml` explicitly says: `Please close this issue manually once the CI is fixed`

Impact:

- The open GitHub issue backlog no longer cleanly represents current failures
- Engineers can spend time on superseded failures while missing the real current blockers
- The automation layer is preserving historical failure context as live issue noise instead of self-healing when later runs succeed

### F-EXH-031: `er-diagram.html` throws a live client-side exception from a missing semicolon before an IIFE

Severity: `LOW`
Status: `VERIFIED`

Evidence:

- A headless production sweep across all `28` public HTML pages found one real page exception after filtering analytics beacon noise:
  - `GET /er-diagram.html` -> `200`
  - page error: `document.querySelectorAll(...).forEach(...) is not a function`
- In `public/er-diagram.html`, the inline footer script contains:
  - `document.querySelectorAll('.copyright-year').forEach(function(el){el.textContent=new Date().getFullYear()})`
  - immediately followed by `(function() { ... })();`
- Because there is no semicolon between those two statements, automatic semicolon insertion does not terminate the `forEach(...)` call before the next `(` token
- The browser therefore interprets the IIFE as a call on the result of `forEach(...)`, which is not callable

Impact:

- `er-diagram.html` is shipping a real JavaScript exception in production
- The footer/year and currency-selector initialization block on that page can fail or behave unpredictably
- This is currently the only verified public-page exception from the full HTML route sweep, so it is a concrete isolated page defect rather than generic analytics noise

### F-EXH-032: Chrome extension auth flow is broken by a backend response-shape mismatch

Severity: `HIGH`
Status: `VERIFIED`

Evidence:

- The backend serializes API router payloads directly from `result.data` in `src/backend/server.js`:
  - `return new Response(JSON.stringify(result.data), ...)` at line `1401`
  - `const responseBody = JSON.stringify(result.data)` at line `1783`
- The auth router returns top-level auth objects, not nested `data.data` payloads:
  - register returns `data: { user, token, refreshToken }` at `src/backend/routes/auth.js:351`
  - refresh returns `data: { token: newToken, refreshToken: newRefreshToken }` at `src/backend/routes/auth.js:702`
- The extension client parses those responses as though auth fields were nested under `data.data`:
  - `chrome-extension/lib/api.js:70-71` checks `if (data.data && data.data.token)` and saves `data.data.token`
  - `chrome-extension/lib/api.js:76` throws `No token in refresh response` when that nested shape is absent
  - `chrome-extension/lib/api.js:150` login persists `data.data.token` and `data.data.refreshToken`
- The popup’s login submission path depends on that broken client method:
  - `chrome-extension/popup/popup.js:177-185` calls `await api.login(email, password)`

Impact:

- A successful extension login response from the current backend will still fail client-side because `data.data` is `undefined`
- Token refresh is also broken for the same reason, so the extension cannot reliably maintain authenticated sessions
- This is a concrete extension runtime defect, not a documentation gap

### F-EXH-033: Mobile app references multiple route names that are not registered anywhere in the app navigator

Severity: `MEDIUM`
Status: `VERIFIED`

Evidence:

- `mobile/src/screens/SettingsScreen.js` navigates to route names that do not exist in the registered app stack:
  - `Profile` at line `84`
  - `EditProfile` at line `105`
  - `ConnectedShops` at line `112`
  - `Subscription` at line `119`
  - `ChangePassword` at line `162`
  - `TwoFactorAuth` at line `177`
  - `HelpCenter` at line `190`
  - `ContactSupport` at line `196`
  - `Legal` at line `202`
- Additional mobile screens reference more unregistered route names:
  - `mobile/src/screens/ListingsScreen.js` navigates to `ListingDetail` and `CreateListing`
  - `mobile/src/screens/ItemDetailScreen.js` navigates to `Crosslist` and `EditItem`
  - `mobile/src/screens/SalesScreen.js` navigates to `SaleDetail`
- `mobile/src/App.js` only registers these route names:
  - tabs: `Dashboard`, `Inventory`, `Scan`, `Listings`, `Sales` at lines `62-75`
  - stack: `Login`, `Main`, `ItemDetail`, `Camera`, `Settings` at lines `115-129`
- There is no separate `mobile/src/navigation/` tree in the current repo snapshot, and `mobile/src/App.js` is the only active navigator definition present

Impact:

- The mobile app contains multiple dead-end taps across settings, listings, sales, and item-detail flows
- Profile editing, connected shops, subscription management, password changes, 2FA, help, support, legal, listing creation/detail, sale detail, crosslisting, and item editing are not reachable from the current mobile app shell
- This is a shipped mobile runtime defect in the repo state, not just stale design intent

### F-EXH-034: Mobile project setup artifacts are stale and point to a nonexistent API host and missing native project files

Severity: `MEDIUM`
Status: `VERIFIED`

Evidence:

- `mobile/README.md` documents a project structure with `components/`, `navigation/`, `hooks/`, `utils/`, `assets/`, `ios/`, `android/`, and `app.json` at lines `18-28`
- The actual `mobile/` tree in the repo currently contains only:
  - `src/`
  - `package.json`
  - `README.md`
- `mobile/package.json` still includes native build scripts that require missing directories:
  - `ios`: `react-native run-ios`
  - `android`: `react-native run-android`
  - `build:android`: `cd android && ./gradlew assembleRelease`
- `mobile/README.md:65-66` tells operators to configure:
  - `API_URL=https://api.vaultlister.com`
  - `WS_URL=wss://api.vaultlister.com/ws`
- `nslookup api.vaultlister.com` currently returns:
  - `*** No internal type for both IPv4 and IPv6 Addresses (A+AAAA) records available for api.vaultlister.com`
- The live hosted API surface is instead reachable on the main domain:
  - `GET https://vaultlister.com/api/health/ready` -> `200`

Impact:

- The current mobile README is not a reproducible setup guide for this repo snapshot
- New engineers following the documented mobile env values will target a host that does not currently resolve
- Native mobile build and deployment instructions describe project files that are not present, so the mobile surface is materially incomplete relative to its own documentation and scripts

### F-EXH-035: Mobile settings profile binds to a nonexistent `user.name` field instead of the backend’s `full_name`

Severity: `LOW`
Status: `VERIFIED`

Evidence:

- `mobile/src/screens/SettingsScreen.js` renders the profile avatar and name from `user?.name` at lines `87` and `91`
- The current auth/backend user payloads use `full_name`, not `name`:
  - register/login user rows in `src/backend/routes/auth.js` select `full_name`
  - authenticated profile routes also return `full_name` in the user object
- There is no normalization layer in `mobile/src/store/authStore.js`; it stores `response.data.user` as-is from the auth API

Impact:

- A successfully authenticated mobile user can still see a fallback `U` avatar and `User` label in settings even when their real profile name exists on the backend
- This is a concrete frontend/backend field-contract mismatch, not just placeholder copy

### F-EXH-036: Mobile dashboard analytics screen points at a nonexistent endpoint and expects the wrong response shape

Severity: `MEDIUM`
Status: `VERIFIED`

Evidence:

- `mobile/src/services/api.js:103` defines `analyticsApi.getOverview()` as `GET /api/analytics/overview`
- `src/backend/routes/analytics.js:45` only exposes the dashboard overview on `/dashboard` and `/stats`
- `src/backend/routes/analytics.js:142` returns dashboard data as `{ stats }`
- `mobile/src/screens/DashboardScreen.js:28-29` calls `analyticsApi.getOverview()` and stores `response.data` directly
- The same screen expects flat top-level fields such as `revenue`, `activeListings`, `pendingOrders`, `inventory`, and `views` at lines `52-57`, `124`, `140`, `148`, and `156`
- The backend dashboard payload is grouped under `stats.inventory`, `stats.listings`, `stats.sales`, `stats.offers`, and `stats.automations`, not those flat keys

Impact:

- The mobile dashboard is wired to an endpoint that does not exist in the current backend route table
- Even if the request path were corrected, the screen still expects a flatter contract than the backend returns
- Dashboard metrics will fail to load correctly in the current mobile client

### F-EXH-037: Mobile barcode scanner treats successful lookups as misses and navigates with an undefined item ID after creation

Severity: `MEDIUM`
Status: `VERIFIED`

Evidence:

- `mobile/src/screens/ScannerScreen.js:62`, `66`, and `75` expect barcode lookup responses shaped like:
  - `response.data.found`
  - `response.data.product.name`
  - `response.data.product`
- `src/backend/routes/barcode.js` returns successful lookups as top-level product fields such as `barcode`, `title`, `brand`, `category`, `description`, and `image_url`; it does not return `found: true` plus a nested `product` object
- The scanner’s inventory-create payload is also not aligned with the backend create contract:
  - `mobile/src/screens/ScannerScreen.js:126` sends `purchase_price`
  - `src/shared/utils/sanitize.js:218` only whitelists `costPrice` and `listPrice`
  - `src/backend/routes/inventory.js:351` explicitly requires `listPrice`
- On create, `mobile/src/screens/ScannerScreen.js:132` navigates to `ItemDetail` using `response.data.id`
- `src/backend/routes/inventory.js:431` returns inventory creation as `{ item }`, not a top-level `id`

Impact:

- A successful barcode lookup will still fall through the scanner’s “Product Not Found” path because `response.data.found` is absent
- Even if lookup succeeded, the scanner’s create payload omits the required `listPrice` field and uses `purchase_price`, which the current inventory validator ignores
- When the scanner creates an inventory item, it then navigates using an undefined item ID because the backend wraps the created item under `item`
- The current mobile barcode flow is contract-broken on both lookup and create-success handling

### F-EXH-038: Mobile item-detail screen binds the entire inventory response object instead of the nested item payload

Severity: `MEDIUM`
Status: `VERIFIED`

Evidence:

- `mobile/src/screens/ItemDetailScreen.js:36` does `setItem(response.data)` after `inventoryApi.getById(itemId)`
- `mobile/src/screens/ItemDetailScreen.js:23` only reads `itemId` from `route.params`
- The scanner routes manual-entry flows to this screen with `{ newItem: true, barcode }` at `mobile/src/screens/ScannerScreen.js:141-142` and `{ newItem: true }` at `mobile/src/screens/ScannerScreen.js:228`
- `src/backend/routes/inventory.js:286` returns inventory detail responses as `{ item, listings }`
- The screen then renders the state as though it were the item itself:
  - `item.title`
  - `item.images`
  - `item.brand`
  - `item.list_price`
  - `item.listings`
- Because the backend shape is `{ item, listings }`, those direct property reads land on the wrapper object rather than the actual inventory row

Impact:

- The mobile item-detail screen is bound to the wrong object shape and will render missing or incorrect values from the current backend response
- Associated listing data is also misread because the client expects it nested under the same `item` object instead of as a sibling top-level field
- The scanner’s manual-entry path also lands on a screen that does not support `newItem` mode and immediately tries to load inventory by `itemId`
- This is a concrete mobile runtime contract defect, not a hypothetical cleanup issue

### F-EXH-039: Mobile shell exposes multiple tappable controls with no handler wired at all

Severity: `LOW`
Status: `VERIFIED`

Evidence:

- `mobile/src/screens/LoginScreen.js` renders several tappable auth-entry controls without any `onPress` behavior:
  - `Forgot Password?` at line `85`
  - Google social button at line `108`
  - Apple social button at line `111`
  - `Sign Up` at line `119`
- `mobile/src/screens/DashboardScreen.js` renders two quick-action buttons with no `onPress`:
  - `List` at line `102`
  - `Sync` at line `109`
- These are all `TouchableOpacity` elements presented as actionable UI, but unlike adjacent controls they are not connected to navigation, API calls, or placeholder handlers

Impact:

- The mobile app currently presents several dead controls that appear functional but do nothing
- This creates false affordances in core entry and dashboard surfaces, even before the deeper route/contract issues are fixed
- These are smaller than the route and API mismatches, but they are still verified shipped UX defects

### F-EXH-040: Root repo still contains tracked zero-byte placeholder files added by unrelated auto-commits

Severity: `LOW`
Status: `VERIFIED`

Evidence:

- `git ls-files -s -- 51 54 600MB .walkthrough-active` shows all four paths are tracked in Git:
  - `51`
  - `54`
  - `600MB`
  - `.walkthrough-active`
- `Get-Item -LiteralPath '51','54','600MB','.walkthrough-active'` confirms all four are zero-byte root-level files
- `git show --stat --summary 13ecdbd1 -- 51 54 600MB` shows commit `13ecdbd1` (`[AUTO] docs: CR-2 VERIFIED — OAUTH_MODE=real confirmed in Railway production variables`) created the zero-byte `51`, `54`, and `600MB` files
- `git show --stat --summary d8f5c43c -- .walkthrough-active` shows commit `d8f5c43c` (`[AUTO] feat: walkthrough fixes — modal bug, logos, profile fields, sales dropdown, billing usage`) re-created `.walkthrough-active`
- `git show --stat --summary 346782f5 -- .walkthrough-active` shows an earlier cleanup commit had already deleted `.walkthrough-active` as stale root-level baggage

Impact:

- The repo root is still carrying tracked placeholder debris that was reintroduced by unrelated automation/doc commits
- This increases root-surface noise during audits, snapshot verification, and contributor onboarding
- These files do not prove a production outage, but they are a verified repo-hygiene regression in the top-level surface

### F-EXH-041: Local Cloudflare review is blocked because the configured API token is invalid

Severity: `MEDIUM`
Status: `VERIFIED`

Evidence:

- `.env` contains `CLOUDFLARE_API_TOKEN`
- A direct authenticated zone lookup using that token against `GET /client/v4/zones?name=vaultlister.com` returned:
  - HTTP `403`
  - Cloudflare error code `9109`
  - message: `Invalid access token`
- This is stronger than the earlier connector-only auth failure because it uses the repo-local credential path directly

Impact:

- The requested Cloudflare settings and WAF review cannot be completed from the current local credential path
- Any local operational workflow depending on this `.env` token is stale or broken
- This is a verified audit blocker for the Cloudflare surface, not a guess about the live zone configuration

### F-EXH-042: Sentry issue and event enumeration is blocked because the workspace has DSN metadata but no API auth token

Severity: `MEDIUM`
Status: `VERIFIED`

Evidence:

- `.env` contains:
  - `SENTRY_DSN`
  - `SENTRY_CLIENT_SECRET`
  - `SENTRY_ORG`
  - `SENTRY_PROJECT`
- The same `.env` does **not** contain `SENTRY_AUTH_TOKEN`
- `.github/workflows/observability-health.yml` explicitly skips the Sentry health check when `SENTRY_AUTH_TOKEN` or `SENTRY_ORG` is missing:
  - it emits `status=skipped`
  - detail: `Sentry credentials not configured (set SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT)`
- The available Sentry connector in this environment exposes `get_sentry_issue(issue_id_or_url)`, which requires a specific issue ID or URL and does not provide project-wide issue/event listing

Impact:

- Full live Sentry issue/event enumeration cannot be completed from the current workspace/tooling state
- The repo can initialize Sentry ingestion, but the audit cannot verify current issue backlog or live event stream without additional auth scope
- This is a verified access gap, not an assumption that Sentry itself is down

### F-EXH-043: Stripe live-production-state review is blocked because every available access path is test-only or missing

Severity: `MEDIUM`
Status: `VERIFIED`

Evidence:

- `mcp__codex_apps__stripe._get_stripe_account_info()` returned:
  - account `acct_1SwXbOBO26AWLnml`
  - display name `Vaultifacts sandbox`
- `mcp__codex_apps__stripe._retrieve_balance()` returned `livemode: false`
- The local `.env` contains no Stripe credential or price/config keys:
  - `STRIPE_SECRET_KEY`: missing
  - `STRIPE_PUBLISHABLE_KEY`: missing
  - `STRIPE_WEBHOOK_SECRET`: missing
  - `STRIPE_PORTAL_CONFIGURATION_ID`: missing
  - `STRIPE_PRO_PRICE_ID`: missing
  - `STRIPE_BUSINESS_PRICE_ID`: missing

Impact:

- The available Stripe connector can inspect only a sandbox account, not the live production account the user asked to audit end to end
- The workspace itself also lacks a local Stripe credential path for direct live API verification
- This leaves the live billing state as a verified audit blocker rather than an unresolved assumption

### F-EXH-044: `security.html` fresh browser loads self-report CSP failures on the SPA fallback path

Severity: `MEDIUM`
Status: `VERIFIED`

Evidence:

- There is no local static file at `public/security.html`
- `src/backend/server.js` serves unknown dotted non-API routes through the SPA fallback and injects CSP nonces into `src/frontend/index.html`
- A fresh Playwright load of `https://vaultlister.com/security.html` consistently produced:
  - final URL `https://vaultlister.com/security.html#login`
  - console CSP error: `Loading the script 'https://vaultlister.com/core-bundle.js?v=57e0a110' violates ... script-src ...`
  - failed request: `GET https://vaultlister.com/core-bundle.js?v=57e0a110 :: csp`
- The same Playwright session saw a live CSP header containing two nonces:
  - the app nonce injected by the server
  - a second Cloudflare-style nonce (`nonce-c6f3b982-...`) added to the header
- The rendered DOM on that same page also contains a Cloudflare Zaraz script ahead of the app bundle:
  - `https://vaultlister.com/cdn-cgi/zaraz/s.js?...`
  - that script appears without a nonce in the DOM captured by Playwright
- Browser-generated CSP reports from this page hit `/api/csp-report` with `502` during the Playwright pass, while a direct well-formed JSON POST from Node returned the expected `204`

Impact:

- The security/login entry surface is currently generating real CSP self-violations in a clean browser session
- CSP report telemetry from actual browser violations is not reliable on this path, even though the endpoint works for a hand-crafted JSON payload
- The verified problem is on the live route/header/injection combination, not just in static source files

### F-EXH-045: Account-security activity UI is not wired to the implemented `/api/security/activity` or `/api/security/events` routes

Severity: `MEDIUM`
Status: `VERIFIED`

Evidence:

- `src/backend/routes/security.js` implements:
  - `GET /api/security/events`
  - `GET /api/security/activity`
- The settings UI explicitly claims it shows backend-style audit data:
  - `src/frontend/pages/pages-settings-account.js` labels the section `Account Activity`
  - the same file says `Recent login activity and security events for your account.`
- That same UI renders exclusively from `store.state.accountActivityLog || []`
- Repo-wide frontend search for `accountActivityLog` only finds:
  - the page renderer reading it
  - `revokeSession()` deleting an item from it after `DELETE /auth/sessions/:id`
  - `revokeAllSessions()` collapsing it to the current session after `POST /auth/sessions/revoke-all`
- No frontend search hit shows a fetch to `/security/activity` or `/security/events` for the account settings surface

Impact:

- The user-facing account-security screen is not actually wired to the implemented backend activity endpoints
- Recent login activity and security events can therefore be empty, stale, or purely client-mutated even when the backend has real audit data
- This is a verified frontend/backend disconnect on a security-sensitive settings surface

## Next Audit Steps

1. Continue root/top-level review from the remaining config and workflow artifacts after the placeholder-file regression
2. Continue backend route-by-route inspection on the unreviewed mounted prefixes
3. Expand manual/click-path walkthroughs beyond the current public pass into additional app and extension surfaces
4. Reconcile the Cloudflare, Sentry, and Stripe sections against the verified access blockers above and any alternate credential paths that appear later
5. Keep reconciling every existing QA, walkthrough, and workflow artifact against live behavior

[00:49:58] ### F-EXH-046: Railway production billing is configured with Stripe test-mode keys instead of live-mode keys

[00:49:58] Severity: `CRITICAL`
[00:49:58] Status: `VERIFIED`

[00:49:58] Evidence:

[00:49:58] - `railway status` shows the linked target is:
[00:49:58]   - project `vaultlister`
[00:49:58]   - environment `production`
[00:49:58]   - service `vaultlister-app`
[00:49:58] - `railway variable list --json` for that production app includes:
[00:49:58]   - `STRIPE_SECRET_KEY`
[00:49:58]   - `STRIPE_PUBLIC_KEY`
[00:49:58]   - `STRIPE_WEBHOOK_SECRET`
[00:49:58]   - `STRIPE_PRICE_STARTER`
[00:49:58]   - `STRIPE_PRICE_PRO`
[00:49:58]   - `STRIPE_PRICE_BUSINESS`
[00:49:58] - The production app values are explicitly test-mode:
[00:49:58]   - `STRIPE_SECRET_KEY` begins with `sk_test_`
[00:49:58]   - `STRIPE_PUBLIC_KEY` begins with `pk_test_`
[00:49:58] - The worker service did not expose a second live Stripe credential path during `railway variable list --json -s vaultlister-worker`
[00:49:58] - Earlier Stripe connector inspection also returned sandbox/test-mode account state (`livemode: false`)

[00:49:58] Impact:

[00:49:58] - The deployed production app is not wired to a live Stripe account
[00:49:58] - Live-production billing-state review cannot complete as requested because the verified production configuration itself points at test-mode Stripe
[00:49:58] - Any production checkout, subscription, or webhook behavior observed from this app is occurring against Stripe test infrastructure, not a live billing system

[00:49:58] ### F-EXH-047: Cloudflare operations automation can pass green without authenticated zone or WAF review

[00:49:58] Severity: `HIGH`
[00:49:58] Status: `VERIFIED`

[00:49:58] Evidence:

[00:49:58] - `gh run view 24690112402 --log` for the `Cloudflare Operations` workflow shows:
[00:49:58]   - `CLOUDFLARE_API_TOKEN or CLOUDFLARE_ZONE_ID not set - skipping cache purge`
[00:49:58]   - the workflow still completed successfully
[00:49:58] - `.github/workflows/cloudflare-ops.yml` performs only:
[00:49:58]   - optional cache purge
[00:49:58]   - DNS resolution checks
[00:49:58]   - an issue-reminder step about WAF review
[00:49:58] - The workflow does not enumerate or validate:
[00:49:58]   - zone settings
[00:49:58]   - WAF/custom rules
[00:49:58]   - managed rulesets
[00:49:58]   - firewall events
[00:49:58]   - bot-management settings
[00:49:58] - Direct authenticated API attempts with the locally available `CLOUDFLARE_API_TOKEN` still failed with Cloudflare auth errors (`403` / `9109 Invalid access token`)

[00:49:58] Impact:

[00:49:58] - The repo’s existing Cloudflare automation can report success without any real authenticated Cloudflare review
[00:49:58] - Full Cloudflare settings/WAF review remains a verified blocker until a working token or alternate authenticated path exists
[00:49:58] - Green workflow history should not be treated as evidence that the zone, WAF, or ruleset state was actually audited

[00:49:58] ### F-EXH-048: Billing routes can mutate paid subscription tiers directly without going through Stripe

[00:49:58] Severity: `CRITICAL`
[00:49:58] Status: `VERIFIED`

[00:49:58] Evidence:

[00:49:58] - `src/backend/routes/billing.js` implements:
[00:49:58]   - `POST /api/billing/change-plan`
[00:49:58]   - `POST /api/billing/select-plan`
[00:49:58] - Both routes accept `planId` values in `free`, `starter`, `pro`, `business`
[00:49:58] - Both routes update `users.subscription_tier` directly in the database without creating a Stripe checkout session, modifying a Stripe subscription, or waiting for webhook confirmation
[00:49:58] - `src/tests/billing.test.js` and `src/tests/billing-expanded.test.js` explicitly normalize authenticated success-paths for those direct mutations
[00:49:58] - Frontend code still uses the direct mutation path:
[00:49:58]   - `src/frontend/init.js` posts to `/billing/change-plan`
[00:49:58]   - `src/frontend/pages/pages-settings-account.js` calls the same handler for visible tier-change controls
[00:49:58] - No live exploit was executed against production because changing a real user tier would mutate account state

[00:49:58] Impact:

[00:49:58] - An authenticated app user can change their stored subscription tier, including paid tiers, without a verified Stripe billing event
[00:49:58] - App billing state can therefore diverge from Stripe state even before considering the separate duplicate-subscription finding already recorded
[00:49:58] - This is a verified backend/business-logic defect on a revenue-critical surface

[00:49:58] ### F-EXH-049: Fresh Chrome extension installs default to a localhost API instead of the production app

[00:49:58] Severity: `HIGH`
[00:49:58] Status: `VERIFIED`

[00:49:58] Evidence:

[00:49:58] - `chrome-extension/lib/api.js` resolves the fallback API base URL to `http://localhost:3000/api`
[00:49:58] - The same file also constructs its default client with a localhost base URL
[00:49:58] - `chrome-extension/options/options.js` treats a missing saved environment as the local environment and visually selects that option
[00:49:58] - `chrome-extension/popup/popup.js` uses the same resolved base URL for login, signup, and open-app actions
[00:49:58] - No production-first bootstrap logic exists in the extension sources reviewed this pass

[00:49:58] Impact:

[00:49:58] - A fresh install or reset extension session points at a nonexistent local server for ordinary users
[00:49:58] - Login, signup, and API-backed extension features will fail until the user manually changes environments
[00:49:58] - This is a shipped default-configuration defect, not just a development convenience hidden behind docs

[00:49:58] ### F-EXH-050: The extension’s “Add to VaultLister” context-menu flow uses an unsupported sync action type

[00:49:58] Severity: `HIGH`
[00:49:58] Status: `VERIFIED`

[00:49:58] Evidence:

[00:49:58] - `chrome-extension/background/service-worker.js` registers the `add-to-vaultlister` context menu for images
[00:49:58] - That handler submits `api.addToSyncQueue({ action_type: 'add_image', ... })`
[00:49:58] - `src/backend/routes/extension.js` limits accepted sync action types to:
[00:49:58]   - `add_inventory`
[00:49:58]   - `update_price`
[00:49:58]   - `cross_list`
[00:49:58]   - `delete_listing`
[00:49:58]   - `sync_sale`
[00:49:58] - `add_image` is not in the allowed backend contract

[00:49:58] Impact:

[00:49:58] - The shipped extension context-menu path cannot succeed against the current backend contract
[00:49:58] - Users can trigger a visible integration action that has no accepted server-side route shape
[00:49:58] - This is a verified extension/backend contract break

[00:49:58] ### F-EXH-051: Public first-visit geolocation logic is failing across 25 live pages due to `ipapi.co` CORS blocking

[00:49:58] Severity: `MEDIUM`
[00:49:58] Status: `VERIFIED`

[00:49:58] Evidence:

[00:49:58] - A Playwright sweep was run across every HTML file in `public/` against `https://vaultlister.com/...`
[00:49:58] - That sweep recorded the same runtime failure on 25 public pages:
[00:49:58]   - request failure: `GET https://ipapi.co/json/ :: net::ERR_FAILED`
[00:49:58]   - console error: `Access to fetch at 'https://ipapi.co/json/' from origin 'https://vaultlister.com' has been blocked by CORS policy`
[00:49:58] - Affected pages include:
[00:49:58]   - `affiliate.html`
[00:49:58]   - `api-docs.html`
[00:49:58]   - `contact.html`
[00:49:58]   - `pricing.html`
[00:49:58]   - `request-feature.html`
[00:49:58]   - `status.html`
[00:49:58]   - `terms.html`
[00:49:58] - The failing path is broad rather than page-specific: 25 of 51 public HTML routes hit the same browser-side geolocation request failure during the sweep

[00:49:58] Impact:

[00:49:58] - Public first-visit locale/currency/geolocation logic is currently broken on a wide portion of the live marketing/help surface
[00:49:58] - The pages generally still render, so the defect can hide behind swallowed fetch errors unless browser logs are inspected
[00:49:58] - This is a real cross-page runtime defect, not a one-off console warning

[00:57:11] ### F-EXH-052: The legal privacy export route is schema-stale and can fail against the repo’s current database contract

[00:57:11] Severity: `HIGH`
[00:57:11] Status: `VERIFIED`

[00:57:11] Evidence:

[00:57:11] - `src/backend/routes/legal.js` implements `GET /api/legal/privacy/data-export`
[00:57:11] - That handler currently queries schema names that do not match the repo’s current schema definitions:
[00:57:11]   - `SELECT id, email, name, created_at FROM users ...` even though `src/backend/db/schema.sql` and `src/backend/db/pg-schema.sql` define `full_name`, not `name`
[00:57:11]   - `SELECT * FROM automations ...` even though the schema defines `automation_rules`
[00:57:11]   - `SELECT * FROM feedback ...` even though the schema defines `feedback_submissions`
[00:57:11]   - `SELECT * FROM transactions ...` even though the schema defines `financial_transactions`
[00:57:11] - The same file’s `ALLOWED_AUDIT_TABLES` and `getDataAudit()` logic already use the newer table names (`automation_rules`, `feedback_submissions`, `financial_transactions`), confirming internal inconsistency inside the same router
[00:57:11] - The route’s current test coverage is permissive enough to miss that breakage:
[00:57:11]   - `src/tests/legal-expanded.test.js` explicitly accepts `500`
[00:57:11]   - `src/tests/legal-gaps-expanded.test.js` explicitly accepts `500`

[00:57:11] Impact:

[00:57:11] - The implemented privacy export route is out of sync with the repo’s current schema contract
[00:57:11] - On environments that actually match the current schema, authenticated privacy exports can fail at runtime instead of returning user data
[00:57:11] - Existing test coverage is weak enough to normalize that failure instead of reliably catching it

[00:57:11] ### F-EXH-053: The SPA announcement banner is shipped in the app shell but not wired to the live announcement API

[00:57:11] Severity: `MEDIUM`
[00:57:11] Status: `VERIFIED`

[00:57:11] Evidence:

[00:57:11] - `src/backend/routes/settings.js` implements the public `GET /api/settings/announcement` route
[00:57:11] - `src/backend/server.js` explicitly treats `GET /api/settings/announcement` as a public announcement path
[00:57:11] - `src/frontend/index.html` ships a visible `#announcement-banner` shell with text and close controls
[00:57:11] - Repo-wide frontend search found no fetch path that loads `/api/settings/announcement`
[00:57:11] - A fresh Playwright visit to `https://vaultlister.com/` recorded zero requests to `/api/settings/announcement`

[00:57:11] Impact:

[00:57:11] - The app shell includes an announcement feature that is not actually hydrated from the live announcement API
[00:57:11] - Admin-managed announcement content can exist server-side without ever being displayed by the SPA
[00:57:11] - This is a verified frontend/backend wiring gap, not just unused markup

[01:06:42] ### F-EXH-054: The account legal/privacy settings UI is incompatible with the current legal route contracts

[01:06:42] Severity: `HIGH`
[01:06:42] Status: `VERIFIED`

[01:06:42] Evidence:

[01:06:42] - Cookie consent load mismatch:
[01:06:42]   - `src/frontend/handlers/handlers-settings-account.js` reads `settings.analytics_enabled` and `settings.marketing_enabled`
[01:06:42]   - `src/backend/routes/legal.js` returns `analytics`, `marketing`, and `functional`
[01:06:42] - Cookie consent save mismatch:
[01:06:42]   - the frontend sends `{ analytics_enabled, marketing_enabled }`
[01:06:42]   - the backend requires boolean `analytics`, `marketing`, and `functional`, otherwise it returns `400 Invalid consent values`
[01:06:42] - Data audit mismatch:
[01:06:42]   - the frontend renders `(audit.categories || []).map(...)`
[01:06:42]   - the backend returns `{ userId, auditDate, dataCounts: { ... } }`
[01:06:42] - Terms-of-service acceptance status mismatch:
[01:06:42]   - the frontend checks `status.accepted`
[01:06:42]   - the backend returns `hasAccepted`, `currentTosId`, `currentTosVersion`, `acceptedAt`
[01:06:42] - Terms-of-service accept mismatch:
[01:06:42]   - the frontend posts `{}` to `/api/legal/tos/accept`
[01:06:42]   - the backend requires `tosVersionId` and returns `400` when it is missing
[01:06:42] - Terms-of-service history mismatch:
[01:06:42]   - the frontend iterates `(history.versions || [])`
[01:06:42]   - the backend returns the history as a top-level array

[01:06:42] Impact:

[01:06:42] - The legal/privacy controls in account settings are not aligned with the backend routes they call
[01:06:42] - Cookie preferences can display the wrong state and fail to save
[01:06:42] - Data-audit and terms-of-service modals can render empty or fail on normal success responses
[01:06:42] - This is a verified multi-endpoint frontend/backend contract drift on a compliance-sensitive settings surface

[01:53:56] ### F-EXH-055: `/api/inventory/categories` is shadowed by the generic inventory item route and returns a false item-404

[01:53:56] Severity: `HIGH`
[01:53:56] Status: `VERIFIED`

[01:53:56] Evidence:

[01:53:56] - Live authenticated request repro:
[01:53:56]   - `GET https://vaultlister.com/api/inventory/categories` returned `404`
[01:53:56]   - Response body: `{"error":{"message":"Item not found","code":"NOT_FOUND"}}`
[01:53:56] - The frontend calls this route directly from category-management handlers:
[01:53:56]   - `src/frontend/handlers/handlers-settings-account.js` uses `api.get('/inventory/categories')`
[01:53:56]   - the same handler file also posts, updates, and deletes under `/inventory/categories/...`
[01:53:56] - The backend does implement category routes later in the inventory router:
[01:53:56]   - `src/backend/routes/inventory.js` has explicit category handlers for:
[01:53:56]     - `GET /api/inventory/categories`
[01:53:56]     - `POST /api/inventory/categories`
[01:53:56]     - `PUT /api/inventory/categories/:id`
[01:53:56]     - `DELETE /api/inventory/categories/:id`
[01:53:56] - But earlier in the same router, the generic single-item matcher runs first:
[01:53:56]   - `if (method === 'GET' && path.match(/^\/[\w-]+$/) && path !== '/stats' && path !== '/deleted')`
[01:53:56]   - `/categories` matches that expression, so it is treated as an inventory ID before the category block is reached

[01:53:56] Impact:

[01:53:56] - The shipped category-management surface cannot load its base category list route on production
[01:53:56] - Users get a misleading `Item not found` response for a valid category-management endpoint
[01:53:56] - This is a verified route-ordering defect, not a missing frontend call

[01:53:56] ### F-EXH-056: `/api/analytics/sales` is broken in production by an invalid SQL identifier (`salesPeriodOffset`)

[01:53:56] Severity: `HIGH`
[01:53:56] Status: `VERIFIED`

[01:53:56] Evidence:

[01:53:56] - Authenticated live route and click-path repros:
[01:53:56]   - `GET https://vaultlister.com/api/analytics/sales?period=30d&groupBy=day` returned `500`
[01:53:56]   - Clicking the authenticated `Analytics` sidebar route also triggered the same `500` during page load
[01:53:56]   - Clicking the authenticated `Reports` sidebar route triggered the same failing analytics request as a background dependency
[01:53:56] - Production Railway logs captured the exact DB error after repro:
[01:53:56]   - `column "salesperiodoffset" does not exist`
[01:53:56]   - the service then logged `[Analytics] Analytics sales error`
[01:53:56] - The source matches that live error exactly:
[01:53:56]   - `src/backend/routes/analytics.js` computes `const salesPeriodOffset = ...`
[01:53:56]   - but the SQL string uses `WHERE s.user_id = ? AND (salesPeriodOffset IS NULL OR s.created_at >= NOW() + ?::interval)`
[01:53:56]   - `salesPeriodOffset` is written as a bare SQL identifier instead of a JavaScript-side branch or valid SQL parameter expression

[01:53:56] Impact:

[01:53:56] - The main analytics sales dataset is broken on the live app
[01:53:56] - Authenticated app surfaces that depend on that dataset produce repeatable `500` errors during normal navigation
[01:53:56] - This is a verified production SQL bug with exact runtime log proof

[01:53:56] ### F-EXH-057: `/api/relisting/stale` is broken in production because it queries `last_refreshed_at`, but the schema uses `last_refresh_at`

[01:53:56] Severity: `HIGH`
[01:53:56] Status: `VERIFIED`

[01:53:56] Evidence:

[01:53:56] - Authenticated live route and click-path repros:
[01:53:56]   - `GET https://vaultlister.com/api/relisting/stale?days=30` returned `500`
[01:53:56]   - Navigating to `#smart-relisting` in the authenticated SPA triggered the same `500`
[01:53:56] - Production Railway logs captured the exact DB error after repro:
[01:53:56]   - `column l.last_refreshed_at does not exist`
[01:53:56]   - the service then logged `[Relisting] Error fetching stale listings`
[01:53:56] - The source query uses the missing column name:
[01:53:56]   - `src/backend/routes/relisting.js` calculates staleness with `COALESCE(l.last_refreshed_at, l.created_at)`
[01:53:56] - The repo schema defines a different column on `listings`:
[01:53:56]   - `src/backend/db/pg-schema.sql` defines `last_refresh_at TIMESTAMPTZ`
[01:53:56]   - there is no `last_refreshed_at` column in the shipped Postgres schema file

[01:53:56] Impact:

[01:53:56] - The smart relisting stale-listing view is broken on production
[01:53:56] - Users can navigate to the relisting page and hit a server-side `500` on normal page load
[01:53:56] - This is a verified route/schema drift bug, not a transient data issue

[01:53:56] ### F-EXH-058: The Whatnot event list is contract-broken because the frontend calls `/api/whatnot/events`, but the router only lists events at the mounted root

[01:53:56] Severity: `HIGH`
[01:53:56] Status: `VERIFIED`

[01:53:56] Evidence:

[01:53:56] - Authenticated live route and click-path repros:
[01:53:56]   - `GET https://vaultlister.com/api/whatnot/events` returned `404 {"error":"Route not found"}`
[01:53:56]   - Navigating to `#whatnot-live` in the authenticated SPA triggered the same `404`
[01:53:56] - The frontend explicitly requests `/whatnot/events`:
[01:53:56]   - `src/frontend/handlers/handlers-core.js` loads Whatnot data with `api.get('/whatnot/events')`
[01:53:56]   - `src/frontend/handlers/handlers-tools-tasks.js` also uses `/whatnot/events` and `/whatnot/events/:id...`
[01:53:56] - The backend router is mounted at `/api/whatnot`:
[01:53:56]   - `src/backend/server.js` registers `'/api/whatnot': whatnotRouter`
[01:53:56]   - the server strips the prefix before dispatch, so the router receives `/events` for that request
[01:53:56] - But the router’s list/create handlers are written for the mounted root, not `/events`:
[01:53:56]   - `src/backend/routes/whatnot.js` lists events only when `path === '' || path === '/'`
[01:53:56]   - the file comments still describe this as `GET /api/whatnot/events`, which no longer matches the mounted contract

[01:53:56] Impact:

[01:53:56] - The authenticated Whatnot page cannot load its event list from the shipped backend contract
[01:53:56] - Additional Whatnot CRUD handlers in the frontend are built around the same broken base path
[01:53:56] - This is a verified frontend/backend path-contract mismatch on a live app surface

[01:53:56] ### F-EXH-059: `/api/whatnot/stats` is broken in production because `whatnot_events.start_time` is `TEXT`, but the query compares it to `NOW()`

[01:53:56] Severity: `HIGH`
[01:53:56] Status: `VERIFIED`

[01:53:56] Evidence:

[01:53:56] - Authenticated live route and click-path repros:
[01:53:56]   - `GET https://vaultlister.com/api/whatnot/stats` returned `500 {"error":"Failed to fetch statistics"}`
[01:53:56]   - Navigating to `#whatnot-live` in the authenticated SPA triggered the same `500`
[01:53:56] - Production Railway logs captured the exact DB error after repro:
[01:53:56]   - `operator does not exist: text > timestamp with time zone`
[01:53:56]   - the service then logged `[Whatnot] Whatnot stats error`
[01:53:56] - The failing source query is in the stats route:
[01:53:56]   - `src/backend/routes/whatnot.js` computes `upcoming` with `start_time > NOW()`
[01:53:56] - The shipped Postgres schema defines `start_time` as text:
[01:53:56]   - `src/backend/db/pg-schema.sql` declares `whatnot_events.start_time TEXT NOT NULL`

[01:53:56] Impact:

[01:53:56] - The live Whatnot stats API cannot compute upcoming events against the current schema contract
[01:53:56] - The authenticated Whatnot page fails even if the route path issue is fixed separately
[01:53:56] - This is a verified schema/query type mismatch with exact production log proof

[01:53:56] ### F-EXH-060: The authenticated SPA still registers `#tools` and `#sourcing` routes even though `window.pages.tools` and `window.pages.sourcing` do not exist

[01:53:56] Severity: `HIGH`
[01:53:56] Status: `VERIFIED`

[01:53:56] Evidence:

[01:53:56] - Authenticated route walkthrough repros:
[01:53:56]   - navigating to `#tools` produced live console error:
[01:53:56]     - `[Router] Error rendering page: tools TypeError: window.pages.tools is not a function`
[01:53:56]   - navigating to `#sourcing` produced live console error:
[01:53:56]     - `[Router] Error rendering page: sourcing TypeError: window.pages.sourcing is not a function`
[01:53:56] - The route registrations are still present:
[01:53:56]   - `src/frontend/init.js` registers:
[01:53:56]     - `router.register('sourcing', () => renderApp(window.pages.sourcing()));`
[01:53:56]     - `router.register('tools', () => renderApp(window.pages.tools()));`
[01:53:56] - Repo-wide page search shows no page factories for those names:
[01:53:56]   - no `pages.tools()` implementation was found in the frontend page modules reviewed
[01:53:56]   - no `pages.sourcing()` implementation was found either
[01:53:56] - The analytics surface already renders sourcing through a different page:
[01:53:56]   - `src/frontend/pages/pages-core.js` maps the analytics `sourcing` tab to `pages.suppliers()`
[01:53:56] - By contrast, nearby alias-style routes such as `report-builder`, `predictions`, `market-intel`, `platform-health`, and `recently-deleted` are intentionally consolidated in `src/frontend/core/router.js`, so the `tools` and `sourcing` failures are not just another expected alias redirect

[01:53:56] Impact:

[01:53:56] - The SPA exposes registered routes that cannot render at all on the live bundle
[01:53:56] - These failures are easy to miss because adjacent consolidated routes are intentionally rewritten and still work
[01:53:56] - This is a verified frontend route/page-registry regression, not just an empty-state page

[01:56:59] ### F-EXH-061: The extension popup’s “Track Price” click path shows success without ever creating a price-tracking record

[01:56:59] Severity: `HIGH`
[01:56:59] Status: `VERIFIED`

[01:56:59] Evidence:

[01:56:59] - `chrome-extension/popup/popup.js` labels the flow as “Scrape first, then add to price tracking”
[01:56:59] - But the actual click handler only:
[01:56:59]   - queries the active tab
[01:56:59]   - sends `scrapeProduct` to the content script
[01:56:59]   - shows `Price tracking enabled!`
[01:56:59]   - calls `loadStats()`
[01:56:59] - That handler never calls `api.addPriceTracking(...)`
[01:56:59] - The API client does have a dedicated price-tracking create method:
[01:56:59]   - `chrome-extension/lib/api.js` implements `addPriceTracking(data)` against `POST /api/extension/price-tracking`
[01:56:59] - The backend also implements the matching route:
[01:56:59]   - `src/backend/routes/extension.js` handles `POST /api/extension/price-tracking`

[01:56:59] Impact:

[01:56:59] - The popup can tell users that price tracking was enabled even though no tracking record was ever created
[01:56:59] - This is a shipped extension click-path defect with a false-success message, not just a missing enhancement

[01:56:59] ### F-EXH-062: The extension popup’s tracked-count stat is contract-broken and will stay at zero against the current backend response shape

[01:56:59] Severity: `MEDIUM`
[01:56:59] Status: `VERIFIED`

[01:56:59] Evidence:

[01:56:59] - The popup stats loader reads:
[01:56:59]   - `trackedResult = await api.getPriceTracking({ limit: 1 }).catch(() => ({ count: 0 }))`
[01:56:59]   - `state.trackedCount = trackedResult.count || 0`
[01:56:59] - Live authenticated API repro against production showed:
[01:56:59]   - `GET /api/extension/price-tracking?limit=1` returned `200`
[01:56:59]   - response keys: `["tracking"]`
[01:56:59] - The backend route confirms that shape:
[01:56:59]   - `src/backend/routes/extension.js` returns `{ tracking: items }` for `GET /api/extension/price-tracking`
[01:56:59] - By contrast, the popup does correctly read `scrapedResult.count` because `GET /api/extension/scraped` actually returns `count`

[01:56:59] Impact:

[01:56:59] - The popup’s tracked-item stat is incompatible with the current backend contract
[01:56:59] - Even when price-tracking records exist, the popup stat logic will resolve to `0`
[01:56:59] - This is a verified extension/backend response-shape mismatch on a visible popup metric

[02:05:44] ### F-EXH-063: The account page’s `Manage Subscription` CTA routes to generic settings `profile` instead of any billing destination

[02:05:44] Severity: `MEDIUM`
[02:05:44] Status: `VERIFIED`

[02:05:44] Evidence:

[02:05:44] - The authenticated account page renders a visible subscription card with a primary `Manage Subscription` button
[02:05:44] - In source, that button is wired as:
[02:05:44]   - `onclick="router.navigate('settings')"`
[02:05:44] - Live authenticated click-path repro:
[02:05:44]   - clicking `Manage Subscription` from `#account` navigated to `#settings`
[02:05:44]   - resulting app state showed `currentPage: "settings"` and `settingsTab: "profile"`
[02:05:44] - The same page family already has a dedicated billing/settings destination elsewhere in the app:
[02:05:44]   - sidebar nav includes `Plans & Billing`
[02:05:44]   - settings tabs include `Plans & Billing`
[02:05:44]   - the button does not target either of those billing surfaces

[02:05:44] Impact:

[02:05:44] - A subscription-management CTA on the account page lands users on the wrong section
[02:05:44] - Users expecting billing or subscription controls are dropped into generic profile settings instead
[02:05:44] - This is a verified user-facing navigation/wiring defect on an authenticated billing surface

[02:14:10] ### F-EXH-064: The authenticated `#terms-of-service` and `#privacy-policy` routes are unreachable because the router rewrites them to `#help-support` before their page implementations can render

[02:14:10] Severity: `MEDIUM`
[02:14:10] Status: `VERIFIED`

[02:14:10] Evidence:

[02:14:10] - The SPA still explicitly registers dedicated authenticated routes for both pages:
[02:14:10]   - `src/frontend/init.js` registers `terms-of-service` at line `354`
[02:14:10]   - `src/frontend/init.js` registers `privacy-policy` at line `355`
[02:14:10] - The frontend still ships real page implementations for those pages:
[02:14:10]   - `window.pages.termsOfService()` exists in `src/frontend/pages/pages-community-help.js`
[02:14:10]   - `window.pages.privacyPolicy()` exists in `src/frontend/pages/pages-community-help.js`
[02:14:10] - But the router alias layer intercepts both routes first:
[02:14:10]   - `src/frontend/core/router.js:293` rewrites `terms-of-service` to `{ target: 'help-support', tab: 'terms' }`
[02:14:10]   - `src/frontend/core/router.js:294` rewrites `privacy-policy` to `{ target: 'help-support', tab: 'privacy' }`
[02:14:10] - The target page does not consume a `terms` or `privacy` mode:
[02:14:10]   - `src/frontend/pages/pages-community-help.js:2625` renders `helpSupport()`
[02:14:10]   - the `helpSupport()` renderer is a generic help/search/cards page and does not branch on a legal/help tab state
[02:14:10] - Live authenticated route repro:
[02:14:10]   - navigating to `https://vaultlister.com/#terms-of-service` ended at `#help-support`
[02:14:10]   - navigating to `https://vaultlister.com/#privacy-policy` also ended at `#help-support`
[02:14:10]   - resulting `store.state.currentPage` was `help-support` in both cases

[02:14:10] Impact:

[02:14:10] - Two authenticated routes with dedicated page implementations are effectively dead
[02:14:10] - Users deep-linking to in-app legal pages are silently redirected to generic help content instead
[02:14:10] - This is a verified router-alias regression, not an intentional missing-page condition

[02:14:10] ### F-EXH-065: The authenticated notifications page is disconnected from the live notifications API and only renders `store.state.notifications`

[02:14:10] Severity: `MEDIUM`
[02:14:10] Status: `VERIFIED`

[02:14:10] Evidence:

[02:14:10] - The notifications page renders entirely from local state:
[02:14:10]   - `src/frontend/pages/pages-settings-account.js:2734` defines `notifications()`
[02:14:10]   - `src/frontend/pages/pages-settings-account.js:2739` starts with `let filteredNotifications = [...store.state.notifications];`
[02:14:10]   - the counters and filters at lines `2780`, `2784`, `2788`, and `2792` also read `store.state.notifications`
[02:14:10] - Repo-wide frontend search found no `api.get('/notifications')`, `fetch('/api/notifications')`, or equivalent notifications fetch path
[02:14:10] - The backend does implement real authenticated notifications endpoints:
[02:14:10]   - `src/backend/routes/notifications.js:18` handles `GET /api/notifications`
[02:14:10]   - `src/backend/routes/notifications.js:37` handles `GET /api/notifications/unread`
[02:14:10]   - `src/backend/routes/notifications.js:53` handles `GET /api/notifications/count`
[02:14:10] - Live authenticated browser repro on `#notifications`:
[02:14:10]   - no `/api/notifications` requests were made during page load
[02:14:10]   - resulting app state still showed `currentPage: "notifications"`
[02:14:10]   - the page rendered `All (0)` / empty-state content from client state only
[02:14:10] - Direct authenticated API repro separately showed the notifications API is mounted and reachable at `GET /api/notifications`

[02:14:10] Impact:

[02:14:10] - The shipped notifications page is not wired to the backend notifications system that already exists
[02:14:10] - Real server-side notifications will not appear unless something else mutates `store.state.notifications`
[02:14:10] - This is a verified frontend/backend integration gap on an authenticated user-facing page

[02:21:30] ### F-EXH-066: The authenticated `Refer a Friend` page generates a signup URL that does not follow the app’s real registration entrypoint and drops the referral flow

[02:21:30] Severity: `MEDIUM`
[02:21:30] Status: `VERIFIED`

[02:21:30] Evidence:

[02:21:30] - The authenticated refer-friend page builds its share link as:
[02:21:30]   - `src/frontend/pages/pages-community-help.js:745` → ``https://vaultlister.com/signup?ref=${referralCode}``
[02:21:30]   - the deferred duplicate at `src/frontend/pages/pages-deferred.js:8088` uses the same URL
[02:21:30] - But the repo’s public-facing signup CTAs consistently use the app bootstrap route instead:
[02:21:30]   - `public/affiliate.html:268` → `/?app=1#register`
[02:21:30]   - `public/landing.html:807` and `public/pricing.html:258` also point to `/?app=1#register`
[02:21:30] - The SPA’s actual registration route is hash-based:
[02:21:30]   - `src/frontend/init.js:172` registers `register`
[02:21:30] - Live browser repro:
[02:21:30]   - opening `https://vaultlister.com/signup?ref=VAULTTEST` ended at `https://vaultlister.com/signup?ref=VAULTTEST#login`
[02:21:30]   - the page rendered the sign-in form, not the registration flow
[02:21:30]   - opening `https://vaultlister.com/#register?ref=VAULTTEST` did not produce the app registration surface either

[02:21:30] Impact:

[02:21:30] - The in-app refer-friend share link does not match the repo’s canonical signup entrypoint
[02:21:30] - Referred users can be dropped onto login instead of a registration flow
[02:21:30] - This is a verified onboarding/referral-link defect on a shipped authenticated share surface

[02:21:30] ### F-EXH-067: The live notifications API returns serialized Promise placeholders (`{}`) because the router does not `await` its async notification service calls

[02:21:30] Severity: `HIGH`
[02:21:30] Status: `VERIFIED`

[02:21:30] Evidence:

[02:21:30] - The notification service functions are async:
[02:21:30]   - `src/backend/services/notificationService.js:49` defines `getUnreadNotifications(...)`
[02:21:30]   - `src/backend/services/notificationService.js:75` defines `getNotifications(...)`
[02:21:30]   - `src/backend/services/notificationService.js:193` defines `getUnreadCount(...)`
[02:21:30] - But the router calls them without `await`:
[02:21:30]   - `src/backend/routes/notifications.js:24` → `const result = getNotifications(user.id, { page, limit });`
[02:21:30]   - `src/backend/routes/notifications.js:41` → `const notifications = getUnreadNotifications(user.id, limit);`
[02:21:30]   - `src/backend/routes/notifications.js:56` → `const count = getUnreadCount(user.id);`
[02:21:30] - Live authenticated API repros against production returned Promise-serialized empty objects instead of the documented payloads:
[02:21:30]   - `GET /api/notifications` → `200 {}`
[02:21:30]   - `GET /api/notifications/unread` → `200 {"notifications":{}}`
[02:21:30]   - `GET /api/notifications/count` → `200 {"unreadCount":{}}`
[02:21:30] - This matches the exact failure mode expected when unresolved Promises are JSON-serialized

[02:21:30] Impact:

[02:21:30] - The live notifications API is contract-broken even before the notifications page wiring gap is addressed
[02:21:30] - Any frontend, extension, or integration consuming these endpoints receives invalid object-shaped placeholders instead of arrays/counts
[02:21:30] - This is a verified production backend bug with exact source-level root cause

[02:23:20] ### F-EXH-068: The live push-notifications page exposes an `Enable Push Notifications` CTA even though production push setup is not configured and the required VAPID key request returns `503`

[02:23:20] Severity: `MEDIUM`
[02:23:20] Status: `VERIFIED`

[02:23:20] Evidence:

[02:23:20] - The authenticated push page renders an active enable button:
[02:23:20]   - `src/frontend/pages/pages-settings-account.js:3227` → `onclick="handlers.subscribePush()"`
[02:23:20] - The subscribe flow depends on fetching the VAPID public key first:
[02:23:20]   - `src/frontend/handlers/handlers-settings-account.js:1030` calls `api.getVapidPublicKey()`
[02:23:20]   - `src/frontend/core/api.js:358` maps that to `GET /push-subscriptions/vapid-public-key`
[02:23:20] - The backend route exists but returns a configuration error when VAPID is missing:
[02:23:20]   - `src/backend/routes/pushSubscriptions.js:49` handles `/vapid-public-key`
[02:23:20] - Live production repro:
[02:23:20]   - `GET /api/push-subscriptions/vapid-public-key` returned `503 {"error":"Push notifications not configured",...}`
[02:23:20]   - authenticated browser walkthrough of `#push-notifications` showed the `Enable Push Notifications` button
[02:23:20]   - clicking it produced `503` responses during the live flow

[02:23:20] Impact:

[02:23:20] - Production presents a push-enablement flow that cannot succeed with the current runtime configuration
[02:23:20] - Users are offered a working setup path for a feature that is backend-disabled
[02:23:20] - This is a verified production configuration/product-surface mismatch

[02:38:30] ### F-EXH-069: The authenticated `Connections` page is mostly a hardcoded shell and does not load live marketplace connection state on navigation

[02:38:30] Severity: `MEDIUM`
[02:38:30] Status: `REMEDIATED LOCALLY / REVERIFIED IN LOCAL BROWSER (2026-04-21); LIVE REVERIFICATION PENDING DEPLOY`

[02:38:30] Evidence:

[02:38:30] - The route registration is render-only:
[02:38:30]   - `src/frontend/init.js:353` registers `connections` as `renderApp(window.pages.connections())`
[02:38:30] - The router’s data-loading paths do not include `connections`:
[02:38:30]   - `src/frontend/core/router.js` loads data for routes like `shops`, `webhooks`, and `push-notifications`, but not `connections`
[02:38:30] - The `Connections` page hardcodes every marketplace card as `Not connected` instead of reading `store.state.shops`:
[02:38:30]   - `src/frontend/pages/pages-settings-account.js:2892`, `2899`, `2906`, `2913`, `2920`, `2927`, and `2934` all render literal `Not connected`
[02:38:30] - By contrast, the app already has a live shops loader and API:
[02:38:30]   - `src/frontend/handlers/handlers-core.js:1024` calls `api.get('/shops')`
[02:38:30]   - live `GET /api/shops` returned `200 {"shops":[]}`
[02:38:30] - Live authenticated browser repro on `#connections` made no `/api/shops` or `/api/email/accounts` requests during page load

[02:38:30] Impact:

[02:38:30] - The shipped connections hub does not reflect live marketplace connection state
[02:38:30] - Even if marketplace connections exist, this page is wired to display a static disconnected shell
[02:38:30] - This is a verified authenticated UI/backend-state disconnect
[15:47:30] - Local remediation/reverification on 2026-04-21:
[15:47:30]   - `src/frontend/init.js` now loads `shops`, `email/accounts`, and `email/providers` before re-rendering `#connections`
[15:47:30]   - `src/frontend/core/router.js` now includes a `connections` data-loading branch
[15:47:30]   - `src/frontend/handlers/handlers-core.js` now exposes `loadEmailProviders()`
[15:47:30]   - `src/frontend/pages/pages-settings-account.js` and `src/frontend/pages/pages-deferred.js` now render marketplace cards from `store.state.shops` instead of hardcoded `Not connected`
[15:47:30]   - Authenticated local Playwright reverification on `http://localhost:3100/?app=1#connections` observed live `GET /api/shops`, `GET /api/email/accounts`, and `GET /api/email/providers` requests, all `200`
[15:47:30]   - The local test user currently has no connected shops, so the cards still display `Not connected`, but they are now reflecting fetched state rather than a static shell
[15:47:30]   - Production/live reverification is still pending because this fix has not been deployed

[02:38:30] ### F-EXH-070: The authenticated `Connections` page exposes an active Outlook connect button even though production Outlook OAuth is not configured

[02:38:30] Severity: `MEDIUM`
[02:38:30] Status: `REMEDIATED LOCALLY / REVERIFIED IN LOCAL BROWSER (2026-04-21); LIVE REVERIFICATION PENDING DEPLOY`

[02:38:30] Evidence:

[02:38:30] - The page renders a live CTA:
[02:38:30]   - `src/frontend/pages/pages-settings-account.js:2969` → `window.open('/api/email/authorize/outlook', '_blank', ...)`
[02:38:30] - Live authenticated API repro showed the endpoint is not usable in production:
[02:38:30]   - `GET /api/email/authorize/outlook` returned `400 {"error":"Outlook OAuth not configured. Set OUTLOOK_CLIENT_ID in environment."}`
[02:38:30] - Live authenticated browser walkthrough of `#connections` still showed the `Connect` button as active and primary-styled

[02:38:30] Impact:

[02:38:30] - Production presents a connect flow that is guaranteed to fail with the current environment
[02:38:30] - Users are offered an apparently ready Outlook integration even though the backend explicitly reports it is not configured
[02:38:30] - This is a verified product-surface/runtime-configuration mismatch
[15:47:30] - Local remediation/reverification on 2026-04-21:
[15:47:30]   - `src/frontend/pages/pages-settings-account.js` and `src/frontend/pages/pages-deferred.js` now read provider configuration from `store.state.emailProviders`
[15:47:30]   - `src/frontend/handlers/handlers-settings-account.js` and `src/frontend/handlers/handlers-deferred.js` now expose `connectOutlook()` and stop relying on `window.open('/api/email/authorize/outlook', ...)` as a blind CTA
[15:47:30]   - The connections page now disables the Outlook button and labels it `Unavailable` when `/api/email/providers` reports `configured: false`
[15:47:30]   - Authenticated local browser reverification against `http://localhost:3100/?app=1#connections` showed:
[15:47:30]     - `GET /api/email/providers` → `200`
[15:47:30]     - in-browser `store.state.emailProviders` contains `outlook.configured = false`
[15:47:30]     - rendered Outlook button: `text = "Unavailable"`, `disabled = true`, `className = "btn btn-sm btn-outline"`
[15:47:30]   - Authenticated live API repro on `https://vaultlister.com/api/email/providers` still reports `gmail.configured = false` and `outlook.configured = false`, so live reverification after deploy should show the same disabled state
[15:47:30]   - Production/live UI reverification is still pending because this fix has not been deployed

[14:58:40] ### F-EXH-071: Inventory sorting still references a nonexistent `inventory.marketplace` column, and Sentry is capturing the resulting live SQL failures as unresolved issue `VAULTLISTER-1`

[14:58:40] Severity: `HIGH`
[14:58:40] Status: `REMEDIATED / REVERIFIED (2026-04-21)`

[14:58:40] Evidence:

[14:58:40] - The authenticated inventory catalog still exposes a visible `Marketplace` sort header:
[14:58:40]   - `src/frontend/pages/pages-inventory-catalog.js:279` wires `onclick="handlers.toggleSort('marketplace')"`
[14:58:40] - The sort handler still translates that into `sort=marketplace_asc|desc` requests:
[14:58:40]   - `src/frontend/handlers/handlers-inventory-catalog.js:2313` maps `field === 'marketplace' ? \`marketplace_${direction}\``
[14:58:40] - The backend still tries to sort the `inventory` table by a `marketplace` column that does not exist in the PostgreSQL schema:
[14:58:40]   - `src/backend/routes/inventory.js:151` → `ORDER BY LOWER(marketplace) ASC`
[14:58:40]   - `src/backend/routes/inventory.js:154` → `ORDER BY LOWER(marketplace) DESC`
[14:58:40]   - `src/backend/db/pg-schema.sql:109` through `151` define the `inventory` table, and no `marketplace` column exists there
[14:58:40] - Direct Sentry enumeration against the configured project returned a matching unresolved live issue:
[14:58:40]   - short id: `VAULTLISTER-1`
[14:58:40]   - title: `PostgresError: column "marketplace" does not exist`
[14:58:40]   - count: `27`
[14:58:40]   - culprit: `ErrorResponse(postgres.src:connection)`
[14:58:40]   - permalink: `https://vaultifacts.sentry.io/issues/7405167403/`

[14:58:40] Impact:

[14:58:40] - The authenticated inventory UI still advertises a sort mode that the backend schema cannot satisfy
[14:58:40] - Users triggering marketplace sorting on inventory can hit live SQL failures
[14:58:40] - This is now corroborated both by exact source mismatch and by unresolved Sentry production telemetry

[15:30:00] Remediation and reverification (2026-04-21):

[15:30:00] - Backend SQL sort branches for `marketplace_asc` / `marketplace_desc` were removed from `src/backend/routes/inventory.js`
[15:30:00] - The visible Marketplace table header is no longer wired as a clickable sort control in:
[15:30:00]   - `src/frontend/pages/pages-inventory-catalog.js`
[15:30:00]   - `src/frontend/pages/pages-deferred.js`
[15:30:00] - Stale UI paths now short-circuit locally with an informational toast instead of emitting the broken backend sort request in:
[15:30:00]   - `src/frontend/handlers/handlers-inventory-catalog.js`
[15:30:00]   - `src/frontend/handlers/handlers-deferred.js`
[15:30:00] - Regression coverage was added in `src/tests/inventory.test.js` for `GET /inventory?sort=marketplace_asc`
[15:30:00] - Reverification:
[15:30:00]   - direct authenticated test-server repro on `http://localhost:3100/api/inventory?sort=marketplace_asc` returned `200`
[15:30:00]   - the new regression test passed when run against `TEST_BASE_URL=http://localhost:3100`
[15:30:00] - Residual note:
[15:30:00]   - unresolved Sentry issue `VAULTLISTER-1` still exists historically and should be watched after deploy, but the broken local code path has now been removed

[14:58:40] ### F-EXH-072: The shared Sentry project is polluted by development and test-suite exceptions, materially degrading production triage quality

[14:58:40] Severity: `MEDIUM`
[14:58:40] Status: `ROOT CAUSE REMEDIATED / REVERIFIED (2026-04-21); HISTORICAL NOISE CLEANUP PENDING`

[14:58:40] Evidence:

[14:58:40] - Backend Sentry initialization is unconditional whenever `SENTRY_DSN` is present, and it tags events with `process.env.NODE_ENV || 'development'`:
[14:58:40]   - `src/backend/instrument.js:10` initializes Sentry when `SENTRY_DSN` exists
[14:58:40]   - `src/backend/instrument.js:13` sets `environment: process.env.NODE_ENV || 'development'`
[14:58:40] - Frontend Sentry initialization also actively emits `development` for localhost:
[14:58:40]   - `src/frontend/init.js:12` sets `environment: window.location.hostname === 'localhost' ? 'development' : 'production'`
[14:58:40] - Direct Sentry issue enumeration showed the unresolved queue is dominated by test-suite generated errors rather than product-runtime errors:
[14:58:40]   - `VAULTLISTER-2` → `Error: Test error 4` with count `1187`, culprit `<anonymous>(arch-observability-monitoring.test)`
[14:58:40]   - `VAULTLISTER-3` / `VAULTLISTER-4` / `VAULTLISTER-5` are also unresolved and tied to `arch-observability-monitoring.test`
[14:58:40]   - `VAULTLISTER-6` / `7` / `8` / `9` / `A` / `B` / `C` / `D` are unresolved and tied to `<anonymous>(service-errorHandler-unit.test)`
[14:58:40] - The test files themselves intentionally emit synthetic monitoring errors:
[14:58:40]   - `src/tests/arch-observability-monitoring.test.js:117` through `124` call `mon.trackError(new Error(\`Test error ${i}\`), ...)`
[14:58:40]   - `src/tests/arch-observability-monitoring.test.js:154` through `160` call `mon.trackError(new Error('DB test error'), ...)`
[14:58:40]   - `src/tests/service-monitoring-unit.test.js` documents monitoring-test contamination concerns and still exercises monitoring error paths in the same file family
[14:58:40] - Direct recent-event enumeration also showed mixed runtime origins in the same Sentry project:
[14:58:40]   - development-tagged Windows events from `DESKTOP-UCUI31D`
[14:58:40]   - production-tagged Debian/Railway events with release `8830499530b7af37913738e124b43021cb3ff088`

[14:58:40] Impact:

[14:58:40] - Production observability is materially noisier than it should be because the unresolved issue queue is dominated by synthetic dev/test failures
[14:58:40] - Real production defects are easier to miss, under-prioritize, or misclassify
[14:58:40] - This is a verified observability hygiene gap, not just a cosmetic dashboard annoyance

[15:30:00] Remediation and reverification (2026-04-21):

[15:30:00] - Backend Sentry initialization is now gated to `production` / `staging` by default, with explicit non-prod opt-in via `SENTRY_ALLOW_NON_PROD=true`:
[15:30:00]   - `src/backend/instrument.js`
[15:30:00] - Backend monitoring now refuses to forward exceptions to Sentry outside `production` / `staging` unless that same override is set:
[15:30:00]   - `src/backend/services/monitoring.js`
[15:30:00] - `.env.example` now documents the non-production override as opt-in only
[15:30:00] - Direct runtime verification after the change:
[15:30:00]   - importing `src/backend/instrument.js` with `NODE_ENV=test` and a dummy `SENTRY_DSN` produced `test_has_client=false`
[15:30:00]   - importing `src/backend/instrument.js` with `NODE_ENV=development` and a dummy `SENTRY_DSN` produced `development_has_client=false`
[15:30:00]   - importing `src/backend/instrument.js` with `NODE_ENV=production` and a dummy `SENTRY_DSN` produced `production_has_client=true`
[15:30:00] - Direct Sentry reverification after intentionally triggering two unique local monitoring errors:
[15:30:00]   - query `LOCAL_GATING_CHECK_DEV_2026_04_21` returned `0` issues
[15:30:00]   - query `LOCAL_GATING_CHECK_TEST_2026_04_21` returned `0` issues
[15:30:00]   - this confirms new local/test noise is no longer entering the shared Sentry project through the backend path
[15:30:00] - Residual note:
[15:30:00]   - the shared Sentry project still contains historical unresolved dev/test issues (`service-errorHandler-unit.test`, `arch-observability-monitoring.test`)
[15:30:00]   - those old issues still require manual cleanup / resolution in Sentry before the backlog itself is fully clean
