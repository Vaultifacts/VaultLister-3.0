# Strictly-Executable Playbook v3.1 (Master Backlog)

This is the canonical long-form backlog for production-readiness work.
Items in this file are intentionally human-owned and can exceed current automation coverage.

## Phase 1: Control Plane Alignment

- [x] Reconcile PROJECT_ROADMAP.md against implemented features and remove stale claims.
- [x] Reconcile PROGRESS_ACCOUNTING.md against real repository state and test outcomes.
- [x] Define command-level evidence requirements in COMPLETION_GATES.md for each gate.
- [x] Define command-level evidence requirements in QUALITY_GATES.md for each quality gate.

## Phase 2: Test Failure Analysis and Stabilization

- [x] Generate Playwright JSON failure inventory and commit evidence snapshots.
- [x] Classify failures into mechanical, real product bugs, flaky, and environment-dependent buckets.
- [x] Resolve deterministic failures spec-by-spec across Chromium, Firefox, and WebKit.
- [x] Stabilize flaky selectors and timing with deterministic waits.
- [x] Validate cross-browser stability with repeat runs and evidence capture.

## Phase 3: Environment and Reproducibility

- [x] Audit environment variable usage in source and align with .env.example.
- [x] Validate git hygiene and .gitignore coverage for generated artifacts.
- [x] Run clean-clone setup using documentation only and capture full runbook evidence.
- [x] Verify health endpoint, SPA load, registration/login, and minimal inventory flow in clean clone.

## Phase 4: Operations Hardening

- [x] Validate monitoring contract and health response fields against project requirements.
- [x] Validate request logging includes request id, route, status, and latency fields.
- [x] Execute backup and restore drill and validate dataset integrity after restore.
- [x] Validate deployment artifacts (Dockerfile, docker-compose, CI workflow gating behavior).
- [x] Record local performance baseline (startup, health latency, key route latency).

## Phase 5: Documentation Closure and Final Audit

- [x] Ensure README.md exists and reflects actual startup, test, and troubleshooting commands.
- [x] Ensure API routes documentation is synchronized with backend routes.
- [x] Ensure database schema documentation is synchronized with migrations.
- [x] Re-run completion gate commands and update final gate status evidence.
- [x] Produce final completion summary with remaining optional improvements.
