claude -p @"
Read:
- qa/full_testing_taxonomy.md
- qa/domains/environment_quality.md
- qa/coverage_matrix.md
- all existing test files
- frontend, public, extension, mobile, docs, and performance-related files
- test framework/config files
- CI config if present

Task:
Audit current coverage only for the Environment and Quality domain.

Steps:
1. Identify all existing tests and evidence relevant to this domain.
2. Map verified coverage to these categories only:
   - localization / regional behavior
   - time / scheduling / expiry
   - performance / capacity
   - compatibility / environment coverage
   - AI/ML/ranking assurance
   - documentation / runbooks
   - exploratory / fuzz / chaos discovery
   - oracles / invariants / reference truth
3. Update qa/coverage_matrix.md with:
   - Status
   - Automation
   - Risk
   - Evidence
   - Missing Coverage
   - Last Updated
4. Create qa/reports/audits/environment_quality_audit.md summarizing:
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