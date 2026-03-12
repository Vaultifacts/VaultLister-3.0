claude -p @"
Read:
- qa/full_testing_taxonomy.md
- qa/domains/core_product.md
- qa/coverage_matrix.md
- qa/reports/audits/core_product_audit.md

Task:
Generate missing automated tests for the Core Product domain only.

Scope:
- business logic
- UI / interaction behavior
- input / validation / parsing
- state consistency
- authentication / session lifecycle
- authorization / isolation
- accessibility checks if the project already has a suitable testing setup

Requirements:
1. Use the repository’s current test frameworks, conventions, and file structure.
2. Prefer extending existing test files before introducing new patterns.
3. Add edge cases, failure cases, boundary cases, and permission cases.
4. Add fixtures/helpers only when necessary.
5. Run the relevant tests after generating them.
6. Fix straightforward failures caused by the new tests if possible.
7. Update qa/coverage_matrix.md based on actual results.
8. Write qa/reports/generation/core_product_generation.md containing:
   - files changed
   - tests added
   - commands run
   - test results
   - defects discovered
   - unresolved gaps
   - confidence level

Rules:
- Stay inside the Core Product domain.
- Do not claim full coverage if important gaps remain.
- Distinguish automated coverage from manual-required coverage.
- Keep changes targeted and minimal.
"@ --allowedTools "Read,Edit,Bash"