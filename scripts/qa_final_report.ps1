claude -p @"
Read:
- qa/full_testing_taxonomy.md
- qa/coverage_matrix.md
- all files in qa/reports/

Task:
Create qa/reports/final/final_master_report.md.

For each domain and category:
- summarize verified coverage
- identify remaining high-risk gaps
- distinguish automated vs manual-required work
- identify the top 10 most important remaining risks

Do not claim exhaustive coverage where evidence is missing.
"@ --allowedTools "Read,Edit,Bash"