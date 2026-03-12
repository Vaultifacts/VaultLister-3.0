# Full Testing Taxonomy

This file is the master QA assurance model for this application.

## Rules
- Coverage must be based on verified evidence, not assumptions.
- Each category must be marked as:
  - Covered
  - Partially Covered
  - Manual Required
  - Uncovered
- Automated coverage and manual coverage must be tracked separately.
- Claude must not claim coverage it did not verify.
- All reports must identify remaining high-risk gaps.

---

## 1. Requirements, Scope, and Acceptance Integrity
- requirements completeness
- acceptance criteria clarity
- requirement consistency
- change traceability
- scope boundaries
- assumptions and exclusions

## 2. Domain Correctness and Business Rule Integrity
- business rules
- calculations
- thresholds
- workflow transitions
- exception handling
- rollback/cancel rules
- domain invariants

## 3. Data Realism, Data Quality, and Test Data Coverage
- clean vs dirty data
- sparse vs dense data
- skewed distributions
- contradictory data
- duplicated entities
- legacy/historical records
- malformed real-world data

## 4. User Experience, Interface, and Interaction Behavior
- rendering
- layout
- forms
- navigation
- loading states
- empty states
- error states
- success states
- multi-step flows
- multi-tab behavior
- responsive behavior

## 5. Accessibility and Inclusive Use
- keyboard access
- focus behavior
- screen reader support
- semantic structure
- contrast
- zoom/reflow
- motion sensitivity
- accessible errors

## 6. Input, Validation, Parsing, and Content Handling
- boundary inputs
- invalid inputs
- client/server validation consistency
- Unicode/emoji/RTL
- pasted content
- file input validation
- parser robustness
- sanitization

## 7. Client State, Server State, and Cross-Layer Consistency
- client/server divergence
- stale state
- optimistic updates
- refresh restoration
- lost updates
- read-after-write consistency
- eventual consistency
- cross-tab consistency

## 8. Authentication, Identity, Session, and Account Lifecycle
- signup
- login/logout
- session persistence
- session expiry
- password reset
- MFA
- SSO
- account recovery
- account deletion/deactivation

## 9. Authorization, Permissions, Ownership, and Isolation
- role enforcement
- backend enforcement
- object ownership
- tenant isolation
- horizontal access control
- vertical access control
- permission caching
- permission changes over time

## 10. API, Protocol, Contract, and Interface Assurance
- request/response correctness
- schemas
- error contracts
- pagination/filtering/sorting
- idempotency
- timeout semantics
- retries
- backward compatibility
- webhooks
- websocket behavior if applicable

## 11. Integration, Dependency, and External Service Assurance
- external service success/failure handling
- slow/down dependencies
- malformed responses
- retries
- reconciliation
- contract drift

## 12. Database, Storage, Persistence, and Retrieval Correctness
- CRUD correctness
- constraints
- transactions
- query correctness
- indexing
- storage linkage
- soft/hard delete correctness

## 13. Data Integrity, Corruption, Migration, and Reconciliation
- migration correctness
- backfills
- corrupted records
- partial writes
- duplicate logical entities
- reconciliation tooling
- historical compatibility

## 14. Search, Filtering, Sorting, Reporting, and Discovery
- search correctness
- filter correctness
- sorting correctness
- facets/counts
- pagination stability
- report/export accuracy
- authorization-aware discovery

## 15. File, Media, Document, Import, and Export Flows
- uploads/downloads
- type/size enforcement
- corrupt file handling
- preview behavior
- import parsing
- export correctness
- encoding
- generated documents/PDFs

## 16. Notifications, Communications, and User Messaging
- email/SMS/push/in-app behavior
- correct recipient
- correct timing
- no duplicate sends
- template correctness
- preferences/unsubscribe
- failure/bounce handling

## 17. Localization, Internationalization, and Regional Behavior
- translations
- text expansion
- RTL
- localized formatting
- regional business rules
- locale-aware validation
- localized notifications/reports

## 18. Time, Scheduling, Expiry, and Temporal Logic
- time zones
- DST
- leap years
- expiry handling
- schedules/reminders
- month-end/year-end boundaries
- clock skew assumptions

## 19. Financial, Numerical, and Precision-Sensitive Correctness
- rounding rules
- decimal precision
- tax/fees
- credits/refunds/reversals
- aggregate totals
- overflow/underflow
- reconciliation accuracy

## 20. Performance, Capacity, Scalability, and Resource Efficiency
- page performance
- API latency
- throughput
- concurrency
- burst traffic
- soak/endurance
- resource utilization
- cold starts
- large datasets

## 21. Reliability, Resilience, Failure Modes, and Recovery
- timeouts
- partial failures
- retries
- duplicate processing
- restart recovery
- degraded modes
- no false success
- no silent data loss
- resumability

## 22. Distributed Systems, Async Processing, and Messaging Semantics
- queues/workers
- retries
- dead-letter handling
- duplicate delivery
- out-of-order delivery
- replay safety
- event versioning
- backlog/consumer lag

## 23. Caching, CDN, Edge, and Proxy Behavior
- cache invalidation
- TTL correctness
- stale data
- per-user/tenant separation
- cache collisions
- cache poisoning
- CDN caching
- asset cache busting
- header preservation

## 24. Security, Abuse Resistance, and Adversarial Behavior
- injection classes
- XSS
- CSRF
- SSRF
- auth/session security
- file upload abuse
- brute force protection
- rate limiting
- scraping/spam/fake account abuse
- resource exhaustion

## 25. Privacy, Compliance, Auditability, and Governance
- consent
- retention
- deletion/anonymization
- export/access rights
- audit logs
- regulated data handling
- legal notices
- regional compliance rules

## 26. Compatibility, Platform, Device, and Environment Coverage
- browser coverage
- OS/device coverage
- screen sizes
- permission-denied scenarios
- incognito/private mode
- network conditions
- VPN/proxy/firewall
- privacy blockers

## 27. Setup, Provisioning, Bootstrap, and First-Run Behavior
- fresh install
- tenant provisioning
- first admin/user creation
- initial configuration
- seed data
- startup from zero state
- startup with missing dependencies

## 28. Deployment, Release, Versioning, and Configuration Assurance
- environment config
- secret injection
- feature flags
- rolling deploys
- rollback
- mixed-version behavior
- stale workers
- config drift
- migration sequencing

## 29. Build, Packaging, Supply Chain, and Artifact Integrity
- build reproducibility
- dependency integrity
- lockfiles
- bundling/minification correctness
- source maps
- container image correctness
- debug code exclusion

## 30. CI/CD Pipeline, Test Harness, and Delivery Process Assurance
- pipeline correctness
- skipped test detection
- flaky test handling
- artifact promotion correctness
- migration gating
- approval gates
- post-deploy validation
- rollback automation

## 31. Admin, Operator, Support, and Internal Tooling Assurance
- admin panels
- support tools
- dashboards
- override tools
- repair/reconciliation tools
- impersonation/support access
- bulk internal actions
- internal permission boundaries

## 32. Observability, Monitoring, Logging, Tracing, and Alerting
- structured logs
- metrics
- traces
- dashboards
- health checks
- readiness/liveness
- alert correctness
- silent failure detection
- observability pipeline failure

## 33. Infrastructure, Runtime, and Platform Failure Behavior
- container restarts
- node/pod failures
- disk full
- memory exhaustion
- CPU saturation
- DNS failure
- TLS expiry
- load balancer issues
- storage failures
- graceful shutdown/startup

## 34. Backup, Restore, Disaster Recovery, and Business Continuity
- backup correctness
- restore correctness
- restore validation
- RPO/RTO realism
- region failover
- cold rebuild
- runbook adequacy
- backup security

## 35. Lifecycle, Offboarding, Decommissioning, and End-of-Life
- account closure
- tenant offboarding
- org deletion
- integration disconnects
- archival vs deletion
- retention after offboarding
- API/feature sunset behavior

## 36. Content Moderation, Trust, Safety, and Policy Enforcement
- abusive content handling
- reporting flows
- moderation queues
- moderator tooling
- appeals/review
- takedown propagation
- cache/index removal after takedown

## 37. AI, ML, Ranking, Recommendation, and Automated Decisioning Assurance
- model output quality
- fallback behavior
- adversarial prompting/input
- drift
- confidence thresholds
- bias/fairness concerns
- auditability
- automation safety boundaries

## 38. Human Support, Manual Operations, and Recovery Workflows
- manual account recovery
- manual correction
- refunds/reversals
- escalation/handoff
- support-assisted recovery
- partial manual action failure
- auditability of manual operations

## 39. Ecosystem, Contractual, and External Expectation Compliance
- SLA/SLO expectations
- API customer contracts
- deprecation policy compliance
- partner integration expectations
- app store/marketplace requirements
- deliverability constraints

## 40. Severity, Risk, Blast Radius, and Recoverability Modeling
- user harm
- financial harm
- privacy/security harm
- regulatory harm
- operational harm
- blast radius
- detectability
- recoverability
- prioritization

## 41. Oracles, Invariants, Reference Truth, and Correctness Proof Strategy
- source of truth definition
- golden datasets
- independent verification
- cross-system reconciliation
- invariant testing
- impossible-state prevention

## 42. Exploratory, Fuzz, Property-Based, Chaos, and Unknown-Unknown Discovery
- exploratory testing
- fuzzing
- randomized/property-based tests
- monkey testing
- fault injection
- chaos testing
- postmortem-driven test additions

## 43. Documentation, Help, Runbooks, and Knowledge Accuracy
- user docs
- setup docs
- API docs
- migration docs
- support docs
- incident runbooks
- behavior/documentation alignment

## 44. Coverage Model Assurance
- critical-path coverage
- edge-case coverage
- failure-mode coverage
- operational coverage
- environment coverage
- regression quality
- overlap/gap analysis
- false-confidence detection