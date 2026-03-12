claude -p @"
Read:
- qa/full_testing_taxonomy.md
- qa/domains/environment_quality.md
- qa/coverage_matrix.md
- qa/reports/audits/environment_quality_audit.md

Task:
Generate missing automated tests or supporting scripts for the Environment and Quality domain only.

Scope:
- localization / regional behavior
- time / scheduling / expiry
- performance / capacity where testable with existing setup
- compatibility / environment coverage where testable
- AI/ML/ranking assurance where applicable and testable
- documentation / runbooks validation where scriptable
- exploratory / fuzz / chaos candidates
- oracles / invariants / reference truth

Requirements:
1. Use the repository’s current test frameworks, conventions, and file structure.
2. Prefer extending existing test files before introducing new patterns.
3. Add timezone, locale, invariant, and compatibility cases where practical.
4. Add helper scripts/checks only when necessary.
5. Run the relevant tests after generating them.
6. Fix straightforward failures caused by the new tests if possible.
7. Update qa/coverage_matrix.md based on actual results.
8. Write qa/reports/generation/environment_quality_generation.md containing:
   - files changed
   - tests added
   - commands run
   - test results
   - defects discovered
   - unresolved gaps
   - confidence level

Rules:
- Stay inside the Environment and Quality domain.
- Do not claim full coverage if important gaps remain.
- Distinguish automated coverage from manual-required coverage.
- Keep changes targeted and minimal.
"@ --allowedTools "Read,Edit,Bash"