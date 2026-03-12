claude -p @"
Read:
- qa/full_testing_taxonomy.md
- qa/domains/infrastructure_delivery.md
- qa/coverage_matrix.md
- all existing test files
- Docker, compose, scripts, docs, setup, CI, admin/tooling, and infra-related files
- test framework/config files
- CI config if present

Task:
Audit current coverage only for the Infrastructure and Delivery domain.

Steps:
1. Identify all existing tests and evidence relevant to this domain.
2. Map verified coverage to these categories only:
   - requirements / scope / acceptance integrity
   - setup / bootstrap / provisioning
   - deployment / release / config
   - build / packaging / supply chain
   - CI/CD / test harness
   - admin / operator / internal tooling
   - infrastructure / runtime failures
   - backup / restore / DR
   - coverage model assurance
3. Update qa/coverage_matrix.md with:
   - Status
   - Automation
   - Risk
   - Evidence
   - Missing Coverage
   - Last Updated
4. Create qa/reports/audits/infrastructure_delivery_audit.md summarizing:
   - verified strengths
   - verified gaps
   - highest-risk missing coverage
   - what is automatable vs manual

Rules:
- Do not modify application code.
- Do not generate new tests yet.
- Do not claim coverage you did not verify.
- If evidence is weak, mark it Partial or Uncovered.
"@ --allowedTools "Read,Edit,Bash"