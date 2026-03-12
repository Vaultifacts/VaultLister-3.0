claude -p @"
Read:
- qa/full_testing_taxonomy.md
- qa/domains/architecture_reliability.md
- qa/coverage_matrix.md
- qa/reports/audits/architecture_reliability_audit.md

Task:
Generate missing automated tests for the Architecture and Reliability domain only.

Scope:
- API / protocol / contracts
- integrations / dependencies
- reliability / failure modes / recovery
- async / messaging / distributed behavior
- caching / CDN / proxy behavior
- observability / alerting checks where testable

Requirements:
1. Use the repository’s current test frameworks, conventions, and file structure.
2. Prefer extending existing test files before introducing new patterns.
3. Add edge cases for retries, timeouts, duplicate processing, stale cache, failed dependencies, and out-of-order events.
4. Add fixtures/helpers/mocks only when necessary.
5. Run the relevant tests after generating them.
6. Fix straightforward failures caused by the new tests if possible.
7. Update qa/coverage_matrix.md based on actual results.
8. Write qa/reports/generation/architecture_reliability_generation.md containing:
   - files changed
   - tests added
   - commands run
   - test results
   - defects discovered
   - unresolved gaps
   - confidence level

Rules:
- Stay inside the Architecture and Reliability domain.
- Do not claim full coverage if important gaps remain.
- Distinguish automated coverage from manual-required coverage.
- Keep changes targeted and minimal.
"@ --allowedTools "Read,Edit,Bash"