claude -p @"
Read:
- qa/full_testing_taxonomy.md
- qa/domains/security_governance.md
- qa/coverage_matrix.md
- all existing test files
- auth, middleware, route, service, env, docs, and governance-related files
- test framework/config files
- CI config if present

Task:
Audit current coverage only for the Security and Governance domain.

Steps:
1. Identify all existing tests and evidence relevant to this domain.
2. Map verified coverage to these categories only:
   - security / abuse resistance
   - privacy / compliance / auditability
   - offboarding / decommissioning
   - moderation / trust / safety
   - human/manual recovery workflows
   - ecosystem / contractual expectations
   - severity / blast radius / recoverability
3. Update qa/coverage_matrix.md with:
   - Status
   - Automation
   - Risk
   - Evidence
   - Missing Coverage
   - Last Updated
4. Create qa/reports/audits/security_governance_audit.md summarizing:
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