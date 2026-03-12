claude -p @"
Read:
- qa/full_testing_taxonomy.md
- qa/domains/data_systems.md
- qa/coverage_matrix.md
- qa/reports/audits/data_systems_audit.md

Task:
Generate missing automated tests for the Data Systems domain only.

Scope:
- test data realism / quality
- database / persistence correctness
- data integrity / migration / reconciliation
- search / filtering / sorting / reporting
- files / imports / exports
- financial / numerical correctness

Requirements:
1. Use the repository’s current test frameworks, conventions, and file structure.
2. Prefer extending existing test files before introducing new patterns.
3. Add edge cases, corruption cases, historical-data cases, boundary cases, and reconciliation cases.
4. Add fixtures/helpers only when necessary.
5. Run the relevant tests after generating them.
6. Fix straightforward failures caused by the new tests if possible.
7. Update qa/coverage_matrix.md based on actual results.
8. Write qa/reports/generation/data_systems_generation.md containing:
   - files changed
   - tests added
   - commands run
   - test results
   - defects discovered
   - unresolved gaps
   - confidence level

Rules:
- Stay inside the Data Systems domain.
- Do not claim full coverage if important gaps remain.
- Distinguish automated coverage from manual-required coverage.
- Keep changes targeted and minimal.
"@ --allowedTools "Read,Edit,Bash"