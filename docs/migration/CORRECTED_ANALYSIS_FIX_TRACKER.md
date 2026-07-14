# UTMS Corrected Analysis Fix Tracker

## Core Correction

The corrected analysis establishes that publish decisions are handled by `VersionHistory`, not by an independent Release flow.

Operational chain:

`Test Request -> Requirement & Flow -> Test Case -> Test Run -> Bug/Run Issue -> Fix & Retest -> Security Checklist -> Playwright -> QA Quality -> VersionHistory`

## Current vs Corrected Implementation

| # | Topic | Corrected Analysis | Current Implementation | Gap | Status |
|---|-------|-------------------|------------------------|-----|--------|
| 1 | VersionHistory Creation | Must be initiated from Primary Test Requests, not standalone | User selects eligible Primary Test Request; version/build are inherited | Implemented in Phase 3 | Implemented |
| 2 | VersionHistory Snapshot | Must be auto-computed from Test Runs, Bugs, per-TestCase Security Reviews, Playwright results | Snapshot is computed from the single Primary Request used in the publish UX, per-TestCase Security Reviews, and preserved after decision | SecurityReview source aligned in Phase 9 | Implemented |
| 3 | Test Request -> VersionHistory Chain | VersionHistory should be linked to a Primary Test Request | API validates Primary Request scope/version/build; Related Request selection is not exposed in current UX | Implemented in Phase 3 and aligned later | Implemented |
| 4 | Bug Blocking / Emergency Tag | Critical bugs must require risk acceptance before approval | Emergency Tag is computed from open critical bugs across linked requests; approval requires risk acceptance | Implemented in Phase 3 | Implemented |
| 5 | Requirement Completeness | Requirements must be complete before QA Quality can be set | QA Quality command validates linked requirements | Implemented in Phase 3 | Implemented |
| 6 | Run Lock After Decision | Test Runs must be locked after VersionHistory is finalized | Tech Lead decision locks linked Test Runs; Retest Required returns same VersionHistory to Draft | Implemented in Phase 3 | Implemented |
| 7 | Developer Visibility | Developer should only see own requests, assigned bugs, and related runnable test data | Role-aware APIs now filter Test Requests, Test Cases, Test Runs, Bugs, dashboard critical bugs, and bug/run wizard data | Implemented in Phase 4 | Implemented |
| 8 | Test Case Requirements | Test Case must have Requirement + Flow to be Ready | Test Case readiness is computed from required fields, ready Requirement, linked Flow, Active toggle, and run creation is blocked unless Ready | Implemented in Phase 4 and aligned later | Implemented |
| 9 | Bug Creation | Bug only from failed Test Run, never standalone | Bug creation is within the run wizard | Already correct | Already Correct |
| 10 | Run Issue | Blocked creates Run Issue, not Bug | Run Issue creation exists for blocked runs | Already correct | Already Correct |
| 11 | Security Checklist | Must appear in VersionHistory Snapshot but not block MVP | Snapshot now reads Security Review records generated per Test Case, with legacy Checklist fallback | Implemented in Phase 9 | Implemented |
| 12 | Emergency Risk | Must have risk acceptance, reason, QA status | Risk acceptance is separate from the computed Emergency Tag | Implemented in Phase 3 | Implemented |
| 13 | Active Context | One Role + one Scope per session | Context selection implemented | Already correct | Already Correct |
| 14 | Audit Trail | Append-only for sensitive operations | VersionHistory QA/decision/risk actions write audit entries | Implemented in Phase 3 | Implemented |
| 15 | Attachment | On all forms, soft-delete only | Attachment support exists | Already correct | Already Correct |
| 16 | Playwright | Real execution path in product design | Mock queue-backed runner now supports queued dispatch, runner metadata, timeout, cancel, command preview, and log/report/trace artifacts | Production runner/CI integration remains backend follow-up | Implemented in Phase 6 (Mock Runner) |
| 17 | Tech Lead Read-only | Tech Lead can view but not edit test data | Tech Lead decision path does not edit test data | Already correct | Already Correct |
| 18 | Product Owner | View + Comment only, no sign-off | Product Owner has limited access and comments | Already correct | Already Correct |
| 19 | RetestTask / Regression Queue | Fixing a Bug must atomically create a QA RetestTask without creating an empty Run | Mock API now creates idempotent RetestTask, QA starts Task to create a Pending Run, and VersionHistory snapshot counts Retest tasks | Implemented in Phase 5 | Implemented |
| 20 | Backend Contracts | Sensitive commands need idempotency/correlation and outbox-backed delivery | Sensitive mock commands accept CommandMetadata, write CommandTrace, and propagate correlation to audit/notification outbox | Durable backend command store and OpenAPI remain follow-up | Implemented in Phase 10 (Mock Boundary) |
| 21 | Notification Outbox | Workflow notifications should be outbox-backed across in-app/email/SMS channels | Mock notifications now create channel delivery items with correlation IDs, delivery status, process, and retry APIs | Real email/SMS providers remain backend follow-up | Implemented in Phase 7 (Mock Delivery) |
| 22 | Modular Publish Authority | Publish/version decision authority may differ per Application/Project | VersionHistory permissions now use per-Application WorkflowPolicy capabilities; standard Tech Lead decision and QA-owned decision models are supported in mock settings | Backend policy persistence/enforcement remains follow-up | Implemented in Phase 8 |
| 23 | VersionHistory Decision Notifications | Final decisions must record Notification with Audit and Lock | Decision, Publish, and Emergency Risk Acceptance now notify VersionHistory stakeholders through the mock outbox | Production transaction boundary remains backend follow-up | Implemented in Phase 9 |
| 24 | Command Trace / Idempotency | API Layer must enforce validation, idempotency, context and correlation | Mock API now supports idempotency replay and correlation tracing for sensitive commands | Durable persistence/transactional backend enforcement remains follow-up | Implemented in Phase 10 |
| 25 | Admin Unlock | Run/Bug after final decision can only change after audited Admin unlock | Test Runs and Bugs are locked by VersionHistory decision; System Admin can unlock with required reason and audit | Durable backend enforcement remains follow-up | Implemented in Phase 11 |
| 26 | Operations Observability | Admin needs command/outbox/audit correlation visibility | Admin Operations page exposes Command Trace, Notification Outbox processing/retry, and correlated Audit records | Backend read models remain follow-up | Implemented in Phase 12 |
| 27 | Integration and Runner Settings | CDE/FAVA and Playwright Runner should be feature-flagged and modular | Settings page manages mock runner config and adapter configs; Playwright start/discovery read these settings | Real workers/providers remain backend follow-up | Implemented in Phase 13 |

## Phase 3 Summary

The VersionHistory module now follows the PRD direction:

- No standalone UI creation with manual version/build.
- Mandatory Primary Test Request linkage.
- Current publish UX uses one Primary Test Request; Related Request selection is kept only as legacy/internal compatibility where present.
- Auto-computed evidence from Test Cases, Test Runs, Bugs, Run Issues, Checklists, and Playwright.
- QA opinion requires notes and creates an immutable revision record.
- Tech Lead decision creates a Decision Snapshot and locks linked Test Runs.
- Retest Required returns the same VersionHistory to Draft.
- Emergency Tag is computed from open critical bugs and requires explicit risk acceptance before approval.
- QA opinion and Tech Lead decision are reflected on the Primary Test Request.

## Phase 4 Summary

Workflow hardening outside VersionHistory is now covered in the mock frontend/API layer:

- Developer visibility is enforced through role-aware APIs for Test Requests, Test Cases, Test Runs, Bugs, dashboard critical bugs, and wizard lists.
- Developers see only their own requests, assigned bugs, and test evidence linked to those items.
- Test Case creation now requires a ready Requirement, linked Flow, and all PRD-required design fields; Test Request is not a required input in the current UX.
- Test Case readiness is computed by the API; incomplete or inactive Test Cases cannot become Ready or be executed.
- Bug creation is blocked unless it comes from a failed Test Run.
- Bug assignees must be active Developers in the same Application scope.
- Developer fixed-version and ready-for-retest actions are limited to assigned bugs and notify QA roles in the mock notification store.

## Phase 5 Summary

Retest/Regression handoff now follows the PRD shape in the mock layer:

- `RetestTask` is a first-class entity separate from `TestRun`.
- Developer "fixed / ready for retest" creates one idempotent RetestTask per open Bug handoff.
- Creating a RetestTask does not create an empty Run.
- QA starts the RetestTask from the queue; only then is a Pending TestRun created.
- Starting the same RetestTask twice reuses the existing Run instead of creating duplicates.
- The execution wizard opens with Test Request, Test Case, previous Run, and Retest/Regression purposes prefilled from the Task.
- Completing the Retest/Regression result updates the source Bug and completes the Task.
- VersionHistory snapshots now include open/completed RetestTask counts.
- Audit and Notification support the `RETEST_TASK` entity type.

## Phase 6 Summary

Playwright execution now follows the PRD runner boundary in the mock layer:

- Starting a Playwright run creates a `PENDING` queued job instead of immediately completing execution.
- The mock dispatcher moves jobs to `RUNNING`, assigns runner metadata, and records command, working directory, timeout, and heartbeat timestamps.
- Runs can be cancelled while `PENDING` or `RUNNING`.
- Completion creates log, trace, and reporter-specific report artifacts as attachment records with object-storage-style paths.
- The Playwright UI exposes queue/runner metadata, discovered/managed/manual file selection, timeout, command options, logs, non-report artifacts, and report preview/download.
- The run form supports Browser/Project, headed, workers, retries, max failures, trace, and reporter controls.
- Reporter output is operational in the mock layer: HTML, JSON, and JUnit/XML generate matching report file names, MIME types, previews, and downloads.
- Failed reports show Playwright-style failure details with test title, project, file, line/column, message, and code frame.
- Reports include named Passed, Skipped, and Cancelled test lists; cancelled runs generate a partial report.

## Phase 7 Summary

Notification delivery now has an outbox-backed mock model:

- Creating a notification also creates one delivery item per channel.
- Default workflow channels are `IN_APP` and `EMAIL`; `SMS` is supported by the shared type/API contract.
- Each delivery item tracks status, retry count, last error, correlation ID, creation time, and delivered time.
- Notification records expose aggregate delivery status and delivered time for the UI.
- The notification API exposes `getOutbox`, `processOutbox`, and `retryFailed` for delivery visibility/testing.

## Phase 8 Summary

VersionHistory authority is now policy-driven in the frontend/mock layer:

- Each Application has a `workflowPolicyId`.
- The standard model keeps QA Lead as quality reviewer and Tech Lead as final decision owner.
- The QA-owned model lets QA Lead both review quality and make the final publish/version decision.
- VersionHistory UI buttons, labels, and mock API checks use `versionHistory:*` capabilities instead of fixed `release:*` role assumptions.
- System Admin settings can switch the mock workflow policy per Application.

## Phase 9 Summary

VersionHistory snapshot and final decision delivery are now aligned with the corrected workflow:

- `securityChecklistResult` is computed from per-TestCase Security Review records linked to the Primary Request evidence.
- Legacy request-level `Checklist` data remains a fallback if no per-TestCase Security Review exists.
- VersionHistory final decisions now enqueue notifications for stakeholders.
- Publish and Emergency Risk Acceptance also enqueue stakeholder notifications.
- Notification delivery uses the Phase 7 outbox model with `VERSION_HISTORY` entity linkage and correlation ids.

## Phase 10 Summary

Command boundary readiness is now represented in the mock frontend/API layer:

- Shared `CommandMetadata` captures idempotency key, correlation id, requested time, and command source.
- Sensitive workflow commands accept optional metadata without breaking existing UI calls.
- Successful idempotent commands are cached by command name and idempotency key.
- Replayed commands return the previous result and write `REPLAYED` command traces instead of duplicating audit/notification side effects.
- Audit logs, notifications, and notification outbox items can carry the same correlation id.
- A read-only `commandTraceApi` exposes traces by application, correlation id, and idempotency key.

## Phase 11 Summary

Post-decision locking now covers the editable evidence surface:

- VersionHistory final decision locks linked Test Runs and linked Bugs.
- Locked Bugs cannot be assigned, updated, retested, closed, or moved back into the RetestTask workflow.
- New Bug creation from a locked failed Run is blocked.
- System Admin can unlock a locked Run or Bug only with a required reason.
- Unlock writes audit metadata and command trace records.
- The Test Run/Bug UI shows lock state and exposes Admin-only unlock controls.

## Phase 12 Summary

Admin observability now exists in the frontend/mock layer:

- A System Admin operations page exposes Command Trace, Notification Outbox, and correlated Audit records.
- The page supports search across command name, correlation id, idempotency key, notification id, entity id, and status.
- Admin can process queued outbox items and retry failed delivery items.
- The page is wired into the Admin navigation and protected by the audit/admin permission path.

## Phase 13 Summary

Integration and runner settings are now modeled as configurable boundaries:

- Shared types define Playwright runner config and CDE/FAVA adapter config.
- Mock `systemSettingsApi` reads and updates runner/adapter settings.
- Settings page manages feature flags, command template, working directory, timeout, artifact root, secret references, base URLs, credentials references, and sync direction.
- Playwright discovery/start reads the configured feature flags and runner settings.
- Secrets remain references only; no raw credential is exposed to the UI.

## Remaining Follow-Up

Remaining production follow-up: backend persistence, production OpenAPI contracts, durable command/idempotency store, persisted workflow-policy enforcement, transactional notification outbox commits, backend read models for observability, the real Playwright worker/CI runner, object storage integration, external adapter workers, and real email/SMS delivery providers.
