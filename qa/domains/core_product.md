# Domain: Core Product

Focus only on these categories.

## Included Categories
- Domain Correctness and Business Rule Integrity
- User Experience, Interface, and Interaction Behavior
- Accessibility and Inclusive Use
- Input, Validation, Parsing, and Content Handling
- Client State, Server State, and Cross-Layer Consistency
- Authentication, Identity, Session, and Account Lifecycle
- Authorization, Permissions, Ownership, and Isolation

## Audit Goals
- Verify core user journeys work correctly
- Verify user-visible states are accurate and recoverable
- Verify auth/session/permission behavior
- Verify validation and edge-input handling
- Verify state consistency across UI and server

## Required Evidence
- existing unit/integration/e2e tests
- auth/session tests
- permission tests
- form validation tests
- state-management tests
- accessibility checks where present

## Common Missing Cases
- session expiry mid-workflow
- duplicate submits
- optimistic UI rollback
- multi-tab conflicts
- unauthorized object access
- hidden UI without backend enforcement
- keyboard-only workflow failures
- field boundary and malformed input cases

## Output Requirements
For each category:
- current verified coverage
- evidence
- missing tests
- automatable vs manual
- risk level