# UTMS - Implementation Assumptions (Updated)

## Item 1: QA Delete/Edit
- "Delete" is soft-delete (deactivation) not physical deletion
- Edit for Requirements opens the existing detail/edit modal
- QA_LEAD can delete requirements, test cases, test runs, bugs
- QA_SPECIALIST can delete test cases, test runs, bugs but NOT requirements

## Item 2: User Management
- National code (کد ملی) is 10 digits
- "استعلام" simulates a database lookup; in production this queries PostgreSQL
- When user is found, name and phone are auto-filled and can be edited
- When user is NOT found, fields are empty for manual entry
- Access scope: APP = access to all systems, SYSTEMS = one or more selected systems only
- Multi-select for systems uses checkbox grid
- Password is auto-generated (8 chars, alphanumeric)
- In production, the generated password would be sent via SMS/email

## Item 2b: Applications CRUD
- Application deletion means deactivation (soft delete)
- Application code is uppercased automatically
- Only SYSTEM_ADMIN can create/edit/delete applications

## Item 3: Admin Scope
- SYSTEM_ADMIN with scope APP sees everything across all systems
- SYSTEM_ADMIN with scope SYSTEMS sees only their assigned systems' data
- In the current implementation, SYSTEM_ADMIN always gets full access via canAccessCartable/canPerformAction shortcuts
- Scope filtering per system would be applied at the data query level in production

## Item 4: Security Reviewer Checklists
- Checklists are linked to test requests (testRequestId)
- Each test request contains multiple test cases and test runs
- The Security Reviewer fills checklist items that cover the test cases/runs within that scope
- For per-test-case granularity, separate checklist records can be created
- In the current MVP, checklists are per test request

## Item 5: Admin Checklist Back-Office
- The admin back-office shows all checklists across the active application
- Admin can view status, results, progress of all checklists
- Admin cannot modify checklist results (that's the reviewer's job)
- Admin view provides oversight/monitoring capability

## Item 6: Phase 4 Mock Workflow Hardening
- Role-aware visibility is enforced in the mock API, not only in UI components
- Test Case readiness is computed from required fields, ready Requirement, linked Flow, and Active toggle
- Incomplete or inactive Test Cases cannot be executed
- Bug creation requires a failed Test Run
- Bug assignees must be active Developers in the same Application scope
- Retest/Regression handoff is implemented in the mock API as an idempotent RetestTask plus outbox-backed mock notifications

## Item 7: Phase 5 RetestTask and Backend Contracts
- RetestTask is separate from TestRun; creating the task does not create a Run
- QA starts the RetestTask to create the Pending Retest/Regression Run
- Starting the same RetestTask again reuses the existing Run
- Mock notifications use an outbox delivery model; default workflow channels are in-app and email, and SMS is supported by the shared contract
- Production APIs should require Idempotency-Key and Correlation-ID for sensitive commands

## Item 8: Phase 6 Playwright Queue/Runner
- The mock Playwright API models production as a queue-backed runner boundary
- Starting a run creates a queued `PENDING` job before dispatching to `RUNNING`
- Runner metadata includes command, selected Playwright options, working directory, timeout, runner id, dispatch time, heartbeat, and artifact paths
- Logs, reporter-specific reports, and traces are stored as mock attachment records with object-storage-style paths
- The run detail UI separates the selected report artifact from other artifacts to avoid duplicated report information
- The current implementation does not execute shell commands or expose secrets in the browser

## Item 9: Phase 7 Notification Outbox
- Notifications are still mock-backed, but they now create delivery items per channel
- Aggregate notification delivery status is derived from outbox delivery items
- `getOutbox`, `processOutbox`, and `retryFailed` expose the delivery lifecycle for tests and future admin tooling
- Real email/SMS providers are outside the mock implementation and remain backend work

## Item 10: Phase 8 Modular Workflow Policy
- VersionHistory authority is capability-based, not hard-coded to one role
- The default Application policy keeps QA Lead as quality reviewer and Tech Lead as final decision owner
- A QA-owned policy is available for Applications where QA Lead owns both quality review and final publish/version decision
- System Admin can switch the mock workflow policy per Application from Settings
- Switching to the QA-owned policy refreshes active contexts and grants QA Lead the final `versionHistory:decide` capability for that Application
- Backend implementation should persist policies and enforce the same `versionHistory:*` capabilities server-side

## Item 11: Phase 9 VersionHistory Snapshot and Notifications
- VersionHistory security snapshot reads the per-TestCase Security Review model first
- Legacy request-level Checklist data remains only as a fallback for older mock records
- Final VersionHistory decisions notify stakeholders through the mock notification outbox
- Publish and Emergency Risk Acceptance also emit stakeholder notifications
- Production backend should commit snapshot, lock, audit, and outbox records in one transaction

## Item 12: Phase 10 Command Boundary
- Sensitive mock commands accept optional `CommandMetadata`
- `CommandMetadata` carries idempotency key, correlation id, requested time, and source
- Mock idempotency replay is keyed by command name and idempotency key
- Replayed commands return the previous result without duplicating audit or notification side effects
- Audit logs, notifications, and outbox items can share the same correlation id
- Production backend should persist command records durably and enforce the same contract transactionally

## Item 13: Phase 11 Admin Unlock
- VersionHistory final decision locks linked Test Runs and Bugs in the mock layer
- Locked Bugs cannot continue operational workflow transitions until unlocked
- System Admin unlock requires a reason and writes audit plus command trace records
- Unlock does not delete the original VersionHistory snapshot or lock history

## Item 14: Phase 12 Operations Observability
- System Admin can view command traces, notification outbox rows, and correlated audit records from one page
- Outbox processing and retry are still mock delivery operations
- Correlation ID is treated as the join key across command, audit, notification, and outbox views

## Item 15: Phase 13 Integration and Runner Settings
- Playwright runner settings are mock-configurable from Settings
- CDE and FAVA adapters are feature-flagged and store credential references only
- Playwright discovery/start respect the Playwright feature flag and auto-discovery setting
- Application CDE roots are validated to start with `https://cde.edus.ir/` and to match the configured Front, Back NodeJS/DataService, or Gateway URL pattern
- Playwright files created or edited inside UTMS are treated as managed files and remain selectable for execution even if auto-discovery is disabled
- Reporter selection is simulated end-to-end in the mock layer: command option, report artifact extension/MIME, in-modal preview, and downloadable file content are kept consistent
- Playwright report content includes named Passed, Skipped, Cancelled, and Failed details; failed details include file location and code frame
- Real external calls, worker execution, and secret resolution remain backend responsibilities
