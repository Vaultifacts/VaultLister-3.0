# Generate Domain Tests Prompt Template

Use this prompt after the audit is complete for one domain.

---

Read:
- qa/full_testing_taxonomy.md
- qa/domains/[DOMAIN_FILE].md
- qa/coverage_matrix.md
- qa/reports/audits/[DOMAIN_SLUG]_audit.md
- existing tests and helpers relevant to this domain

Task:
Generate missing automated tests, checks, or validation scripts for the [DOMAIN_NAME] domain only.

Scope:
Use only the categories listed in qa/domains/[DOMAIN_FILE].md.

Requirements:
1. Use the repository’s current frameworks, conventions, and file structure.
2. Prefer extending existing test files before introducing new patterns.
3. Add missing edge cases, failure cases, boundary cases, and negative cases relevant to this domain.
4. Add helpers, fixtures, mocks, or scripts only when necessary.
5. Run the relevant tests or checks after generating them.
6. Fix straightforward failures caused by the new tests/checks if possible.
7. Update qa/coverage_matrix.md based on actual results.
8. Create qa/reports/generation/[DOMAIN_SLUG]_generation.md containing:
   - files changed
   - tests/checks/scripts added
   - commands run
   - results
   - defects discovered
   - unresolved gaps
   - confidence level

Rules:
- Stay inside this domain.
- Do not claim full coverage if important gaps remain.
- Distinguish automated coverage from manual-required coverage.
- Keep changes targeted and minimal.
- Do not rewrite broad unrelated areas of the codebase.
- If the repo lacks the right harness for part of this domain, say so explicitly and classify it as manual-required or tooling-required.
- Do not invent infrastructure, data, or workflows that are not supported by the repo.

Quality bar:
- New tests must reflect real risks from the audit.
- Avoid duplicate or shallow tests.
- Prefer high-value scenarios over quantity.
- When possible, test failure behavior, not just happy paths.