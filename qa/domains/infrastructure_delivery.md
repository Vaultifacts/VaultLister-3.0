# Domain: Infrastructure and Delivery

## Included Categories
- Requirements, Scope, and Acceptance Integrity
- Setup, Provisioning, Bootstrap, and First-Run Behavior
- Deployment, Release, Versioning, and Configuration Assurance
- Build, Packaging, Supply Chain, and Artifact Integrity
- CI/CD Pipeline, Test Harness, and Delivery Process Assurance
- Admin, Operator, Support, and Internal Tooling Assurance
- Infrastructure, Runtime, and Platform Failure Behavior
- Backup, Restore, Disaster Recovery, and Business Continuity
- Coverage Model Assurance

## Audit Goals
- Verify the system can be built, configured, deployed, recovered, and operated safely
- Verify CI/CD and release workflows
- Verify infra/runtime failure behavior
- Verify backup/restore and DR readiness
- Verify QA coverage itself is not misleading

## Required Evidence
- CI configs
- deployment scripts/config
- feature flag/config evidence
- backup/restore docs or tests
- infra health checks
- internal/admin tooling evidence
- coverage reports and gap analysis

## Common Missing Cases
- environment drift
- missing env vars/secrets not handled clearly
- rollback untested
- stale workers after deploy
- build artifact mismatch from tested code
- backup exists but restore not validated
- infra failure modes not rehearsed
- coverage matrix overstating confidence

## Output Requirements
For each category:
- current verified coverage
- evidence
- missing tests or procedures
- automatable vs manual
- risk level