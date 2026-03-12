# Domain: Data Systems

## Included Categories
- Data Realism, Data Quality, and Test Data Coverage
- Database, Storage, Persistence, and Retrieval Correctness
- Data Integrity, Corruption, Migration, and Reconciliation
- Search, Filtering, Sorting, Reporting, and Discovery
- File, Media, Document, Import, and Export Flows
- Financial, Numerical, and Precision-Sensitive Correctness

## Audit Goals
- Verify data is stored, transformed, migrated, and retrieved correctly
- Verify reporting/search/export results are correct
- Verify file/document flows are safe and accurate
- Verify numeric and precision-sensitive logic

## Required Evidence
- migration tests
- DB integration tests
- reconciliation checks
- search/filter/report tests
- import/export tests
- file upload tests
- calculation tests

## Common Missing Cases
- corrupted or partial records
- duplicate logical entities
- stale search indexes
- export totals mismatching source data
- malformed imports
- decimal rounding drift
- historical records breaking new logic
- backup/restore data mismatch not covered elsewhere

## Output Requirements
For each category:
- current verified coverage
- evidence
- missing tests
- automatable vs manual
- risk level