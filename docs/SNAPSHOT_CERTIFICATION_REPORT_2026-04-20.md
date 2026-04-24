# Snapshot Certification Report

Date: 2026-04-20
Repository: `Vaultifacts/VaultLister-3.0`
Verdict: `NOT CERTIFIED`
Certification basis: [docs/SNAPSHOT_CERTIFICATION_CHECKLIST.md](/C:/Users/Matt1/OneDrive/Desktop/vaultlister-3/docs/SNAPSHOT_CERTIFICATION_CHECKLIST.md:1)

## Snapshot Identity

- Local repo `HEAD`: `80ba5aa9d6ef11eaa5ab6b986ce40c7c25fa4b45`
- Production Railway app commit: `8830499530b7af37913738e124b43021cb3ff088`
- Production Railway worker commit: `8830499530b7af37913738e124b43021cb3ff088`
- GitHub compare result: local `HEAD` is `behind_by: 1` relative to deployed production commit
- Local worktree was not frozen or clean during the audit

Local modified and untracked items observed during the audit:

- `M .claude/scheduled_tasks.lock`
- `M .claude/settings.local.json`
- `M docs/WALKTHROUGH_MASTER_FINDINGS.md`
- `?? .playwright-mcp/`
- `?? Platform Logos/`
- `?? Realistic_Vault_Animation_Generated.mp4`
- `?? data/.soak-snapshots.jsonl`
- `?? docs/SNAPSHOT_CERTIFICATION_CHECKLIST.md`
- `?? status-bars-check.png`
- `?? status-bars-full.png`

Interpretation:

- `M` means a tracked file had local modifications
- `??` means the path was untracked by Git
- This list was captured from `git status --short` to show the worktree was not clean
- This list does not imply the audit created those files
- Audit-created files in this session were `docs/SNAPSHOT_CERTIFICATION_CHECKLIST.md` and this report

This alone prevents a defensible claim that one frozen snapshot was fully audited.

## Executive Result

The current project state cannot be certified because the audit found blockers in all of the following categories:

1. Snapshot integrity
2. HTTP/runtime correctness
3. Production smoke coverage
4. Required CI health
5. Billing verification
6. Observability verification

Several systems are healthy enough to support continued operation, but that is not the same as certification.

## Evidence Summary

| Area | Result | Evidence |
| --- | --- | --- |
| Snapshot freeze | FAIL | Local worktree dirty; production commit does not match local `HEAD` |
| Railway deploy match | FAIL | `verify-railway-deploy` rejected local `HEAD`; deployed app and worker are on `8830499530...` |
| Railway topology | PASS | App and worker services present, expected Dockerfiles and health paths configured |
| Live health endpoints | PASS | `/api/health/live` and `/api/health/ready` passed |
| HTTP cache validator correctness | FAIL | `post-deploy-check` reported `ETag not quoted: W/\"01a21ff400c719b6e40b6111ff4ebd91\"` |
| Versioning alias | PASS | `/api/v1/` alias passed |
| Task queue smoke | PASS | Safe queue smoke completed with one attempt |
| Worker heartbeat health | PASS | `taskWorker`, `gdprWorker`, `priceCheckWorker`, `emailPollingWorker`, `tokenRefreshScheduler`, `uptimeProbeWorker` reported healthy |
| WebSocket authenticated smoke | FAIL | `launch-ops-check --websocket` returned `auth failed: Invalid or expired token` |
| Queue metrics smoke | FAIL | `launch-ops-check --queue-metrics` timed out repeatedly |
| GitHub required workflows | FAIL | `CI` failed on both deployed and local snapshot |
| Public pages E2E | FAIL | `Landing Page` and `Platforms Page` expected 9 cards/tiles, received 10 |
| Cloudflare zone and DNS | PASS | `vaultlister.com` zone active and proxied to Railway |
| Stripe account verification | FAIL | Connected Stripe account is sandbox only: `livemode: false` |
| Stripe runtime secret verification | FAIL | Local `.env` lacked Stripe secret, webhook secret, and price envs during audit |
| Sentry project verification | FAIL | No direct issue URL was available for the Sentry connector; GitHub observability workflow also reported Sentry checks skipped due to missing secrets |
| Observability workflow health | FAIL | Open issue reported Prometheus metrics 401000 and SonarCloud quality gate errors |

## Detailed Findings

### 1. Snapshot integrity failed

- `git rev-parse HEAD` returned `80ba5aa9d6ef11eaa5ab6b986ce40c7c25fa4b45`
- `railway status --json` showed both production services deployed at `8830499530b7af37913738e124b43021cb3ff088`
- GitHub compare confirmed local `HEAD` is one commit behind production
- The worktree was dirty, so there was no single immutable local snapshot to certify

Blocking reason:

- Certification requires one exact repo snapshot, one exact deploy snapshot, and no drift during the audit window

### 2. Live post-deploy HTTP verification failed

Command executed:

```bash
node scripts/post-deploy-check.mjs https://vaultlister.com --json
```

Observed result:

- 6 checks passed
- 1 check failed
- Failing check: `ETag header present on GET responses`
- Error: `ETag not quoted: W/"01a21ff400c719b6e40b6111ff4ebd91"`

Impact:

- The app is close on conditional request behavior, but the validator format is not accepted by the project verification script, so the HTTP contract is not certified

### 3. Launch operations checks were mixed, not clean

Readiness and worker health:

- `database: ok`
- `redis: ok`
- worker health `overall: ok`

Safe task queue smoke:

- one temporary task executed successfully with `attempts: 1`

Blocking failures:

- `bun scripts/launch-ops-check.mjs https://vaultlister.com --websocket --json` failed with `auth failed: Invalid or expired token`
- `bun scripts/launch-ops-check.mjs https://vaultlister.com --queue-metrics --json` timed out repeatedly

Impact:

- The production runtime is not cleanly verifiable end to end from the existing smoke harness

### 4. Required CI is red

Observed GitHub Actions state:

- Deployed commit `8830499530...`
  - `Deploy`: success
  - `Production Smoke`: success
  - `Cloudflare Operations`: success
  - `CI`: failure
- Local snapshot `80ba5aa9...`
  - `Deploy`: success
  - `Production Smoke`: success
  - `Cloudflare Operations`: success
  - `CI`: failure

Failing CI job:

- Workflow: `CI`
- Job: `E2E Smoke`
- Step: `Public Pages E2E`

Concrete failure from workflow logs:

- `Landing Page` expected 9 marketplace tiles, received 10
- `Platforms Page` expected 9 platform cards, received 10

Impact:

- Certification cannot pass while a required CI workflow is red and the failure is tied to user-visible production content

### 5. Cloudflare is directly verified, but that does not remove the app blockers

Direct Cloudflare API evidence:

- Zone `vaultlister.com` exists and is `active`
- Zone type: `full`
- Plan: `Free Website`
- Apex `vaultlister.com` is a proxied `CNAME` to `j0mhkovj.up.railway.app`
- `www.vaultlister.com` is a proxied `CNAME` to `j0mhkovj.up.railway.app`

Meaning:

- DNS and reverse proxy configuration are present and consistent with Railway deployment
- This is a pass for domain routing, not a full pass for edge behavior or WAF completeness

### 6. Billing is not production-certified

Direct Stripe connector evidence:

- Account display name: `Vaultifacts sandbox`
- `livemode: false`
- Products exist for `VaultLister Starter`, `VaultLister Pro`, and `VaultLister Business`
- Recurring CAD prices exist for all three plans
- Subscriptions exist in the connected account

Blocking reason:

- The connected Stripe account available during this audit is test mode only
- The local `.env` inspected during the audit did not expose the Stripe secrets and price envs needed to verify runtime billing configuration against a live production account

Impact:

- Billing structure exists, but production billing cannot be certified from sandbox-only evidence

### 7. Observability is not certified

Direct limitation:

- The available Sentry connector only accepts a specific Sentry issue URL or ID
- No concrete Sentry issue reference was present in the repo materials used during this audit

Supporting GitHub evidence:

- Open issue `#398` reported:
  - `Prometheus metrics FAIL: HTTP 401000`
  - `Connection Pool WARN`
  - `SonarCloud quality gate FAIL`
  - `Sentry` checks skipped because required secrets were not configured in the workflow

Impact:

- Observability coverage exists in code and workflow form, but it is not fully verifiable from the available authenticated surfaces

### 8. Open automation and infra issues remain

Open GitHub issues relevant to certification:

- `#407` `[Automation Coverage] 25 gap(s) detected`
- `#406` `[Infra Audit] Issues detected`
- `#405` `[Service Health] 1 service(s) need attention`
- `#402` `[Redis] Health check failed`
- `#398` `[Observability] 3 pipeline issue(s)`

Notable contents:

- automation coverage gaps include `scripts/launch-ops-check.mjs`, `scripts/post-deploy-check.mjs`, and `scripts/verify-railway-deploy.mjs`
- infra audit warned on orphaned dist chunks and benchmark regression
- service health issue reported external currency API redirect behavior

Impact:

- The project still has known open operational and coverage gaps that directly overlap the certification checklist

## Commands Executed

Commands executed during the audit:

```bash
git rev-parse HEAD
git status --short
git remote get-url origin
railway --version
railway status --json
bun scripts/verify-railway-deploy.mjs --environment production --commit 80ba5aa9d6ef11eaa5ab6b986ce40c7c25fa4b45 --json
node scripts/post-deploy-check.mjs https://vaultlister.com --json
bun scripts/launch-ops-check.mjs https://vaultlister.com --json
bun scripts/launch-ops-check.mjs https://vaultlister.com --websocket --json
bun scripts/launch-ops-check.mjs https://vaultlister.com --task-queue --json
bun scripts/launch-ops-check.mjs https://vaultlister.com --queue-metrics --json
gh auth status
gh run list --repo Vaultifacts/VaultLister-3.0 --limit 80 --json databaseId,workflowName,displayTitle,headSha,conclusion,status,url,createdAt
gh issue list --repo Vaultifacts/VaultLister-3.0 --limit 50 --state open --json number,title,url,labels,updatedAt
```

Direct connector calls executed during the audit:

- GitHub compare between deployed and local commits
- GitHub workflow job inspection for failing CI runs
- Cloudflare zone lookup for `vaultlister.com`
- Cloudflare DNS lookup for apex and `www`
- Stripe account, balance, product, price, and subscription inspection

Risk note:

- The only mutating production-adjacent check was the safe task queue smoke, which creates a temporary task and removes it after execution

## Certification Blockers

The current state remains `NOT CERTIFIED` until all of the following are true:

1. Audit one clean, frozen snapshot where local `HEAD`, deployed app commit, and deployed worker commit match exactly
2. `scripts/post-deploy-check.mjs` passes with no HTTP contract failures
3. `scripts/launch-ops-check.mjs` passes all required production smoke branches, including WebSocket auth and queue metrics
4. Required GitHub workflows are green, especially `CI`
5. Public page E2E expectations are reconciled with the current marketplace count
6. Billing is verified against the intended live Stripe account, not only sandbox
7. Sentry and observability checks are executable with authenticated access and produce clean results
8. Open in-scope GitHub issues are resolved, waived, or explicitly marked out of scope for the certification window

## Recommended Next Sequence

1. Fix the public-pages E2E expectation mismatch or revert the extra card so `CI` turns green
2. Fix the ETag verification failure in the live app or in the verification script if the validator parsing is incorrect
3. Repair the WebSocket smoke auth path and investigate the queue metrics timeout
4. Decide which commit is the certification target, then align local, GitHub, Railway app, and Railway worker to that exact SHA
5. Re-run the certification checklist with live Stripe and observability credentials in scope

## Final Statement

This audit provides a high-confidence negative result:

- the project is running
- several deployment and infrastructure surfaces are healthy
- the current state is not certifiable under the project checklist

Any statement stronger than `NOT CERTIFIED` would overstate the evidence collected on 2026-04-20.
