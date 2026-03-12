claude -p @"
Read:
- qa/full_testing_taxonomy.md
- qa/domains/core_product.md
- qa/coverage_matrix.md
- all existing test files
- test framework/config files
- CI config if present

Task:
Audit current coverage only for the Core Product domain.

Steps:
1. Identify all existing tests and evidence relevant to this domain.
2. Map verified coverage to these categories only:
   - business logic
   - UI / interaction behavior
   - accessibility
   - input / validation / parsing
   - state consistency
   - authentication / session lifecycle
   - authorization / isolation
3. Update qa/coverage_matrix.md with:
   - Status
   - Automation
   - Risk
   - Evidence
   - Missing Coverage
   - Last Updated
4. Create qa/reports/audits/core_product_audit.md summarizing:
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