# Audit Domain Prompt Template

Use this prompt to perform a read-first audit of one QA domain without changing application code.

---

Read:
- qa/full_testing_taxonomy.md
- qa/domains/[DOMAIN_FILE].md
- qa/coverage_matrix.md
- all existing test files relevant to this domain
- relevant source/config/docs files for this domain
- test framework/config files
- CI config if present

Task:
Audit current coverage only for the [DOMAIN_NAME] domain.

Steps:
1. Identify all existing tests, checks, scripts, docs, and other evidence relevant to this domain.
2. Map verified coverage to the categories listed in qa/domains/[DOMAIN_FILE].md only.
3. Update qa/coverage_matrix.md with:
   - Status
   - Automation
   - Risk
   - Evidence
   - Missing Coverage
   - Last Updated
4. Create qa/reports/audits/[DOMAIN_SLUG]_audit.md summarizing:
   - verified strengths
   - verified gaps
   - highest-risk missing coverage
   - what is automatable vs manual
   - confidence level

Rules:
- Do not modify application code.
- Do not generate new tests yet.
- Do not claim coverage you did not verify.
- If evidence is weak, mark it Partial or Uncovered.
- Stay inside this domain unless a cross-domain dependency is necessary to explain a gap.
- Prefer concrete evidence over broad claims.
- If a category appears to have no evidence, say so explicitly.

Output expectations:
- Coverage claims must be evidence-based.
- Missing coverage must be specific, not generic.
- Distinguish:
  - automated coverage
  - partial automation
  - manual-only coverage
  - uncovered areas