# Domain: Architecture and Reliability

## Included Categories
- API, Protocol, Contract, and Interface Assurance
- Integration, Dependency, and External Service Assurance
- Reliability, Resilience, Failure Modes, and Recovery
- Distributed Systems, Async Processing, and Messaging Semantics
- Caching, CDN, Edge, and Proxy Behavior
- Observability, Monitoring, Logging, Tracing, and Alerting

## Audit Goals
- Verify service boundaries and contracts
- Verify retry/idempotency/timeout behavior
- Verify dependency failure handling
- Verify queue/job correctness
- Verify cache correctness and stale data handling
- Verify failures are visible in logs/metrics/alerts

## Required Evidence
- API integration/contract tests
- retry/idempotency tests
- queue/job tests
- dependency mocks/failure simulations
- cache tests
- observability checks or instrumentation tests

## Common Missing Cases
- duplicate processing after retry
- timeout then eventual duplicate success
- third-party success with local persistence failure
- local success with third-party failure
- stale cache after update
- out-of-order events
- dead-letter behavior
- silent failure with no log/alert
- health checks that pass during partial outage

## Output Requirements
For each category:
- current verified coverage
- evidence
- missing tests
- automatable vs manual
- risk level