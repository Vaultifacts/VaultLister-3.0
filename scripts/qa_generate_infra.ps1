claude -p @"
Read:
- qa/full_testing_taxonomy.md
- qa/domains/infrastructure_delivery.md
- qa/coverage_matrix.md
- qa/reports/audits/infrastructure_delivery_audit.md

Task:
Generate missing automated checks, tests, or validation scripts for the Infrastructure and Delivery domain only.

Scope:
- requirements / scope / acceptance integrity where checkable
- setup / bootstrap / provisioning
- deployment / release / config
- build / packaging / supply chain
- CI/CD / test harness
- admin / operator / internal tooling
- infrastructure / runtime failures where testable or scriptable
- backup / restore / DR validation support
- coverage model assurance

Requirements:
1. Use the repository’s current frameworks, conventions, and file structure.
2. Prefer extending existing scripts/checks before introducing new patterns.
3. Add config validation, deployment safety, setup/bootstrap, and coverage-integrity checks where practical.
4. Add helper scripts/checks only when necessary.
5. Run relevant checks after generating them.
6. Fix straightforward failures caused by the new checks if possible.
7. Update qa/coverage_matrix.md based on actual results.
8. Write qa/reports/generation/infrastructure_delivery_generation.md containing:
   - files changed
   - checks/tests added
   - commands run
   - results
   - defects discovered
   - unresolved gaps
   - confidence level

Rules:
- Stay inside the Infrastructure and Delivery domain.
- Do not claim full coverage if important gaps remain.
- Distinguish automated coverage from manual-required coverage.
- Keep changes targeted and minimal.
"@ --allowedTools "Read,Edit,Bash"