# VaultLister Snapshot Certification Checklist

This checklist is for certifying a **frozen snapshot** of VaultLister, not a moving live system.

A certification claim is only valid for:

- one git commit SHA
- one Railway production deploy state
- one Cloudflare configuration state
- one Stripe/Sentry/GitHub state window

If any of those change during the audit, the certification is void and must be restarted.

## 1. Preconditions

All items below are hard gates:

- [ ] Freeze deploys, config changes, schema changes, Cloudflare edits, Stripe edits, and content edits for the audit window.
- [ ] Record the target git SHA.
- [ ] Record the active Railway production deployment IDs for `vaultlister-app` and `vaultlister-worker`.
- [ ] Record the active Cloudflare zone and last config-change timestamp.
- [ ] Record the active Stripe mode, products, prices, webhook endpoints, and webhook signing secret metadata.
- [ ] Record the active Sentry org/project/release configuration.
- [ ] Confirm read access exists for GitHub Actions, Railway, Cloudflare, Stripe, and Sentry.
- [ ] Define scope for all app surfaces:
  - `public/*.html`
  - `src/frontend/pages/*.js`
  - `src/backend/routes/*.js`
  - `src/backend/workers/*`
  - `worker/*`
  - `chrome-extension/**`
  - `mobile/**`
- [ ] Any surface not being certified is marked `OUT OF SCOPE` explicitly.

## 2. Required Evidence Bundle

Create one evidence bundle for the exact snapshot being certified. Certification fails if any artifact below is missing.

- [ ] `git rev-parse HEAD` output
- [ ] `git status --short` output
- [ ] latest successful `CI` workflow URL
- [ ] latest successful `Deploy` workflow URL
- [ ] latest `Production Smoke` workflow URL
- [ ] latest `Observability Pipeline Health` workflow URL
- [ ] `railway status --json` output for production
- [ ] Cloudflare cache purge result for the target deploy
- [ ] Cloudflare DNS verification result
- [ ] Cloudflare WAF review record for the current month
- [ ] environment manifest showing variable names, presence, and placeholder/non-placeholder status
- [ ] Stripe dashboard export or screenshots for products, prices, customers portal, and webhooks
- [ ] Sentry project/settings export or screenshots for backend and browser monitoring
- [ ] updated [WALKTHROUGH_MASTER_FINDINGS.md](/c:/Users/Matt1/OneDrive/Desktop/vaultlister-3/docs/WALKTHROUGH_MASTER_FINDINGS.md:1) with current status mapping

Do not store raw secret values in the evidence bundle. Store names, scopes, timestamps, and masked or hashed values only.

## 3. Repo And CI Gates

These gates come from `.github/workflows/ci.yml` and `.github/workflows/deploy.yml`. Any warning accepted by CI still counts as a certification failure unless it is explicitly waived in writing.

- [ ] `CI` is green for the target SHA.
- [ ] `Deploy` is green for the target SHA.
- [ ] No open failed runs exist for the target SHA in:
  - `CI`
  - `Deploy`
  - `Production Smoke`
  - `Observability Pipeline Health`
  - `Cloudflare Operations`
- [ ] `CI` passed the following jobs for the target SHA:
  - `Lint`
  - `Unit Tests`
  - `E2E Smoke`
  - `Security Scan`
  - `Dependency Audit`
  - `Docker Build`
  - `Accessibility Audit`
  - `Visual Tests`
  - `Performance Check`
  - `Build`
- [ ] `Deploy` passed the following jobs for the target SHA:
  - `Unit Tests (PostgreSQL)`
  - `E2E Smoke`
  - `Deploy to Railway`
  - `Post-Deploy Verification`

## 4. Deploy Topology And Runtime Configuration Gates

Run and archive the outputs below against the frozen snapshot:

```bash
bun scripts/verify-railway-deploy.mjs --environment production --commit <TARGET_SHA> --json
node scripts/post-deploy-check.mjs https://vaultlister.com --json
bun scripts/launch-ops-check.mjs https://vaultlister.com --task-queue --queue-metrics --all --json
```

All three commands must exit `0`.

### Required runtime expectations

- [ ] `vaultlister-app` matches:
  - config file `/railway.json`
  - dockerfile `Dockerfile`
  - healthcheck path `/api/health/ready`
  - restart policy `ON_FAILURE`
- [ ] `vaultlister-worker` matches:
  - config file `/worker/railway.json`
  - dockerfile `worker/Dockerfile`
  - restart policy `ON_FAILURE`
- [ ] App and worker latest deployments both point at the target SHA.
- [ ] Cloudflare cache purge succeeded for the target deploy.
- [ ] Cloudflare DNS verification passed.
- [ ] No unresolved Cloudflare issue exists that affects DNS, cache, or WAF for the target snapshot.

### Required environment expectations

Certification fails if any required value is missing, placeholder, or contradictory.

- [ ] `NODE_ENV=production`
- [ ] `APP_URL` is the production URL
- [ ] `BASE_URL` is the production URL where required
- [ ] `DATABASE_URL` present
- [ ] `REDIS_URL` present
- [ ] `JWT_SECRET` present and non-placeholder
- [ ] `SESSION_SECRET` present and non-placeholder
- [ ] `OAUTH_ENCRYPTION_KEY` present and non-placeholder
- [ ] `OAUTH_MODE=real`
- [ ] `CORS_ORIGINS` matches production origins
- [ ] `RP_ID` and `ORIGIN` match production domain if passkeys/MFA are in scope
- [ ] `SENTRY_DSN` present if Sentry is in scope
- [ ] `SENTRY_RELEASE` matches the target snapshot if release tracking is in scope
- [ ] `STRIPE_PUBLIC_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` present if billing is in scope
- [ ] `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS` are real price IDs, not placeholders
- [ ] All launch-platform credentials are present for any platform claimed as live

## 5. Health, Queue, Worker, And Edge Gates

These are hard runtime gates based on actual repo health endpoints and smoke scripts.

- [ ] `GET /api/health` returns HTTP `200` with status `healthy`
- [ ] `GET /api/health/live` returns HTTP `200` with status `ok`
- [ ] `GET /api/health/ready` returns HTTP `200` with status `ok`
- [ ] `/api/health/ready` reports `database=ok`
- [ ] `/api/health/ready` reports `redis=ok`
- [ ] `GET /api/workers/health` returns HTTP `200`, `version=v1`, `overall=ok`
- [ ] Worker health includes all required keys:
  - `taskWorker`
  - `gdprWorker`
  - `priceCheckWorker`
  - `emailPollingWorker`
  - `tokenRefreshScheduler`
- [ ] `scripts/post-deploy-check.mjs` passes all checks:
  - liveness
  - readiness
  - `/api/v1/` alias
  - ETag presence
  - 304 behavior
  - cache-control safety
  - health endpoint rate-limit bypass
- [ ] `scripts/launch-ops-check.mjs` passes all checks:
  - app readiness
  - worker heartbeat health
  - safe task queue smoke
  - queue backlog thresholds
  - WebSocket Redis pub/sub smoke
- [ ] Task queue thresholds are within configured limits.
- [ ] BullMQ waiting and failed counts are within configured limits.

## 6. Billing Certification Gates

Billing cannot be certified from env presence alone. It requires live functional proof.

- [ ] `src/backend/services/stripeService.js` is configured with real Stripe keys and non-placeholder price IDs.
- [ ] `POST /api/webhooks/stripe` is reachable and uses a valid webhook signature.
- [ ] Stripe webhook events are delivered successfully for the target environment.
- [ ] At least one checkout session can be created successfully for each plan exposed to users.
- [ ] Customer portal session creation succeeds for an active subscriber.
- [ ] Subscription readback succeeds for an active subscriber.
- [ ] A webhook-driven subscription status change updates the app correctly.
- [ ] Evidence includes:
  - checkout session ID
  - webhook event ID
  - resulting user subscription state before/after

If billing is exposed publicly and any one of the above is missing, certification fails.

## 7. Observability Certification Gates

Observability is a hard gate, not a nice-to-have.

- [ ] `Observability Pipeline Health` workflow completes with no `warn` and no `fail`.
- [ ] Sentry backend initialization is active for the target environment.
- [ ] If browser monitoring is claimed, `SENTRY_DSN_FRONTEND` is configured and a browser event is captured successfully.
- [ ] `SENTRY_RELEASE` matches the certified snapshot.
- [ ] Sampling settings are explicitly recorded:
  - `SENTRY_TRACES_SAMPLE_RATE`
  - `SENTRY_PROFILES_SAMPLE_RATE`
- [ ] Prometheus or metrics scrape path is explicitly reconciled and proven working in production.
- [ ] BetterStack log drain is proven healthy if it is in scope.
- [ ] SonarCloud quality gate passes if it is in scope for certification.

Any ambiguity between the intended production metrics endpoint and the actual deployed endpoint is a certification failure until resolved.

## 8. Product Surface Certification Gates

Every surface must have a coverage row in the certification matrix with:

- scope status: `IN SCOPE`, `OUT OF SCOPE`, or `DISABLED`
- test type: `automated`, `manual`, or both
- evidence link
- last verified commit SHA
- last verified production timestamp

### Mandatory rules

- [ ] Every public page in `public/` is either tested or explicitly out of scope.
- [ ] Every SPA page in `src/frontend/pages/` is either tested or explicitly out of scope.
- [ ] Every backend route file in `src/backend/routes/` is either tested or explicitly out of scope.
- [ ] Worker flows in `src/backend/workers/` and `worker/` are verified if enabled.
- [ ] Chrome extension flows are verified if the extension is part of the certified product.
- [ ] Mobile flows are verified if mobile is part of the certified product.
- [ ] Every advertised launch feature has a passing proof, not just a code path.
- [ ] Every open finding in the master findings ledger is mapped to one of:
  - `VERIFIED FIXED`
  - `ACCEPTED RISK`
  - `OUT OF SCOPE`
  - `DISABLED`
- [ ] No in-scope finding remains unclassified.
- [ ] No in-scope `CRITICAL` or `HIGH` finding remains open.
- [ ] No in-scope `MEDIUM` or `LOW` finding remains open without written waiver.

## 9. Final Certification Record

Certification is complete only when the following record exists:

- [ ] target SHA
- [ ] certification timestamp window
- [ ] deploy IDs
- [ ] workflow run URLs
- [ ] evidence bundle location
- [ ] explicit scope list
- [ ] explicit exclusions
- [ ] explicit waivers
- [ ] final result: `CERTIFIED` or `NOT CERTIFIED`

Recommended final statement format:

> VaultLister snapshot certification applies only to commit `<SHA>` deployed as Railway app `<DEPLOY_ID>` and worker `<DEPLOY_ID>`, with Cloudflare, Stripe, and Sentry states captured in the evidence bundle dated `<TIMESTAMP>`.

## 10. Automatic Certification Failure Conditions

Certification fails immediately if any of the following occurs:

- a deploy occurs during the audit
- a production env var changes during the audit
- a Cloudflare rule, DNS record, or cache state changes during the audit
- a Stripe product, price, webhook, or mode changes during the audit
- a Sentry project/release config changes during the audit
- any required artifact is missing
- any certification command exits non-zero
- any workflow required above is red
- any in-scope finding lacks classification
- any live claim is supported only by source inspection and not runtime proof

## 11. What This Checklist Certifies

If every gate above passes, you can make this claim:

> We have high-confidence certification of the frozen VaultLister snapshot defined in the certification record.

You still cannot truthfully claim:

> We have permanent 100% confidence in the live system regardless of future change.
