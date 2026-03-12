claude -p @"
Read:
- qa/full_testing_taxonomy.md
- qa/domains/data_systems.md
- qa/coverage_matrix.md
- all existing test files
- database, migration, and service files
- test framework/config files
- CI config if present

Task:
Audit current coverage only for the Data Systems domain.

Steps:
1. Identify all existing tests and evidence relevant to this domain.
2. Map verified coverage to these categories only:
   - test data realism / quality
   - database / persistence correctness
   - data integrity / migration / reconciliation
   - search / filtering / sorting / reporting
   - files / imports / exports
   - financial / numerical correctness
3. Update qa/coverage_matrix.md with:
   - Status
   - Automation
   - Risk
   - Evidence
   - Missing Coverage
   - Last Updated
4. Create qa/reports/audits/data_systems_audit.md summarizing:
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