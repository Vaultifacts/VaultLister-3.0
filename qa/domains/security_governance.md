# Domain: Security and Governance

## Included Categories
- Security, Abuse Resistance, and Adversarial Behavior
- Privacy, Compliance, Auditability, and Governance
- Lifecycle, Offboarding, Decommissioning, and End-of-Life
- Content Moderation, Trust, Safety, and Policy Enforcement
- Human Support, Manual Operations, and Recovery Workflows
- Ecosystem, Contractual, and External Expectation Compliance
- Severity, Risk, Blast Radius, and Recoverability Modeling

## Audit Goals
- Verify the app resists common exploit and abuse paths
- Verify privacy/compliance workflows
- Verify account/org deletion and offboarding behavior
- Verify internal/manual workflows are safe and auditable
- Verify risk is classified by severity and blast radius

## Required Evidence
- security-focused tests/scans where present
- permission and audit-log checks
- retention/deletion tests
- moderation or trust/safety workflow tests
- support/admin workflow tests
- documented manual procedures

## Common Missing Cases
- hidden UI but callable backend actions
- account deletion leaving data behind
- retention/deletion conflicts
- audit logs missing for privileged actions
- abuse/rate-limit gaps
- unsafe support impersonation
- takedown not propagating to search/cache
- contractual/API deprecation behaviors not tested

## Output Requirements
For each category:
- current verified coverage
- evidence
- missing tests
- automatable vs manual
- risk level