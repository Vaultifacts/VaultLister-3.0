claude -p @"
Read:
- qa/full_testing_taxonomy.md
- qa/domains/security_governance.md
- qa/coverage_matrix.md
- qa/reports/audits/security_governance_audit.md

Task:
Generate missing automated tests for the Security and Governance domain only.

Scope:
- security / abuse resistance
- privacy / compliance / auditability
- offboarding / decommissioning
- moderation / trust / safety where testable
- human/manual recovery workflows where testable
- ecosystem / contractual expectations where testable
- severity / blast radius / recoverability modeling support where appropriate

Requirements:
1. Use the repository’s current test frameworks, conventions, and file structure.
2. Prefer extending existing test files before introducing new patterns.
3. Add permission, abuse, deletion/offboarding, auditability, and privileged-action cases.
4. Add fixtures/helpers only when necessary.
5. Run the relevant tests after generating them.
6. Fix straightforward failures caused by the new tests if possible.
7. Update qa/coverage_matrix.md based on actual results.
8. Write qa/reports/generation/security_governance_generation.md containing:
   - files changed
   - tests added
   - commands run
   - test results
   - defects discovered
   - unresolved gaps
   - confidence level

Rules:
- Stay inside the Security and Governance domain.
- Do not claim full coverage if important gaps remain.
- Distinguish automated coverage from manual-required coverage.
- Keep changes targeted and minimal.
"@ --allowedTools "Read,Edit,Bash"