# Domain: Environment and Quality

## Included Categories
- Localization, Internationalization, and Regional Behavior
- Time, Scheduling, Expiry, and Temporal Logic
- Performance, Capacity, Scalability, and Resource Efficiency
- Compatibility, Platform, Device, and Environment Coverage
- AI, ML, Ranking, Recommendation, and Automated Decisioning Assurance
- Documentation, Help, Runbooks, and Knowledge Accuracy
- Exploratory, Fuzz, Property-Based, Chaos, and Unknown-Unknown Discovery
- Oracles, Invariants, Reference Truth, and Correctness Proof Strategy

## Audit Goals
- Verify behavior across locale/time/device/performance conditions
- Verify correctness proofs and invariants exist where needed
- Verify docs and runbooks match reality
- Identify areas requiring exploratory/fuzz/chaos work

## Required Evidence
- localization tests
- timezone/date tests
- performance/load scripts
- compatibility/device/browser checks
- invariant/property-based tests
- docs/runbook review evidence

## Common Missing Cases
- DST and timezone bugs
- locale formatting mismatches
- unsupported browsers/devices silently breaking
- performance only tested on happy paths
- missing invariants for critical totals/state transitions
- stale or wrong documentation
- no exploratory or fuzz coverage for risky parsers/inputs

## Output Requirements
For each category:
- current verified coverage
- evidence
- missing tests
- automatable vs manual
- risk level