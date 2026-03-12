# Final Master Report Prompt Template

Use this after all domain audits and generation passes are complete.

---

Read:
- qa/full_testing_taxonomy.md
- qa/coverage_matrix.md
- all files in qa/reports/audits/
- all files in qa/reports/generation/
- any existing final reports if present

Task:
Create qa/reports/final/final_master_report.md.

For each domain and category:
1. Summarize verified coverage.
2. Identify the evidence supporting that coverage.
3. Identify remaining gaps.
4. Distinguish:
   - Covered
   - Partial
   - Manual Required
   - Uncovered
5. Distinguish:
   - Automated
   - Partial Automation
   - Manual Only
6. Identify the highest-risk remaining gaps.
7. Identify the top 10 most important remaining risks across the entire application.
8. Separate:
   - gaps Claude helped automate
   - gaps requiring humans
   - gaps requiring external tools or environments
9. State the confidence level of the overall QA result.

Rules:
- Do not claim exhaustive coverage where evidence is missing.
- Do not smooth over contradictions between audit reports and generated-test results.
- If a domain remains weakly tested, say so clearly.
- Prioritize accuracy over optimism.
- Make risk explicit.

Suggested report structure:
- Executive summary
- Domain-by-domain status
- Highest-risk uncovered areas
- Manual-only validation areas
- Tooling/environment gaps
- Recommended next actions
- Confidence assessment