# Phase 5 Backend Contracts

This document records the production contracts implied by Phase 5 and extended by Phases 6 and 7. The current implementation is mock-backed, but the frontend/API shape now follows these boundaries.

## RetestTask Commands

All mutation endpoints must accept:

- `Idempotency-Key`
- `Correlation-ID`
- active context headers for role and application scope

Phase 10 mock implementation:

- Sensitive mock commands accept optional `CommandMetadata`.
- Idempotent replay is tracked by command name plus idempotency key.
- Replayed commands return the cached successful result and write a `REPLAYED` command trace.
- Audit, notification, and notification outbox records carry the command correlation id where applicable.
- `commandTraceApi` exposes traces for tests/admin diagnostics.

### Mark Bug Ready For Retest

`POST /api/v1/bugs/{bugId}/ready-for-retest`

Atomic behavior:

- Validate the actor can update the assigned Bug.
- Set Bug status to `RETEST_READY`.
- Create or reuse one open `RetestTask` for the Bug.
- Write audit events for Bug and RetestTask.
- Enqueue notification through the outbox.
- Do not create a TestRun.

Idempotency rule:

- Repeating the command for the same Bug while an open RetestTask exists returns the existing task.

### Start RetestTask

`POST /api/v1/retest-tasks/{taskId}/start`

Atomic behavior:

- Validate QA scope.
- If the task is `QUEUED`, create a Pending TestRun with:
  - `testRequestId`
  - `testCaseId`
  - `previousRunId`
  - purposes `RETEST` and `REGRESSION_TEST`
  - `sourceBugId`
  - `retestTaskId`
- Set task status to `IN_PROGRESS`.
- If the task is already `IN_PROGRESS`, return the existing Run.

### Complete RetestTask

`POST /api/v1/retest-tasks/{taskId}/complete`

Atomic behavior:

- Persist the Retest/Regression result on the created Run.
- If passed, set Bug status to `RETEST_PASSED`.
- If failed, set Bug status to `RETEST_FAILED` or `REOPENED` according to the workflow action.
- Set task status to `COMPLETED`.
- Write audit and outbox notification records.

## Notification Delivery

Production delivery should use an outbox table written in the same transaction as the domain change. Phase 7 implements this shape in the mock layer.

Required channels:

- In-app
- Email
- SMS

Recommended delivery fields:

- `notificationId`
- `entityType`
- `entityId`
- `recipientUserId`
- `channel`
- `deliveryStatus`
- `retryCount`
- `lastError`
- `createdAt`
- `deliveredAt`

Mock implementation:

- `Notification` stores aggregate `channels`, `deliveryStatus`, and `deliveredAt`.
- `NotificationOutboxItem` stores per-channel status, retry count, last error, correlation ID, creation time, and delivered time.
- `notificationApi.getOutbox`, `notificationApi.processOutbox`, and `notificationApi.retryFailed` expose the delivery lifecycle for tests/admin tooling.
- Default workflow notifications use in-app and email channels; SMS is part of the contract but has no real provider in the mock.

Phase 9 VersionHistory commands:

- Final decision, publish, and emergency risk acceptance enqueue `VERSION_HISTORY` notifications in the mock layer.
- Production should commit VersionHistory status/snapshot, TestRun locks, audit, notification, and outbox rows in the same transaction.
- Security checklist evidence for VersionHistory snapshot should be read from per-TestCase Security Reviews, with legacy request-level Checklist data treated only as migration/fallback input.

Phase 10 VersionHistory command metadata:

- Create, submit for QA review, QA quality review, final decision, publish, and emergency risk acceptance accept command metadata in the mock API.
- Final decision, publish, and emergency risk acceptance propagate the same correlation id to audit, notification, and outbox records.
- Production should reject reused idempotency keys with incompatible payload fingerprints.

Phase 11 Admin Unlock:

- Final decisions lock linked TestRun and Bug records.
- `POST /api/v1/test-runs/{id}/unlock` and `POST /api/v1/bugs/{id}/unlock` should require System Admin context, reason, idempotency key, and correlation id.
- Unlock should write audit, command trace, and lock metadata without modifying immutable VersionHistory snapshots.

Phase 12 Observability:

- Production should expose read models for command trace, notification outbox, and audit events.
- Correlation ID should be queryable across all three views.
- Processing/retry endpoints should be admin-only and asynchronous in production.

## Playwright Runner Boundary

The mock Playwright API now models a queue/runner/artifact flow, but production should still split the command path:

1. API creates a `PlaywrightRun` job.
2. Worker enqueues runner command.
3. Runner executes with configured command, working directory, timeout, environment, and secret references.
4. Runner stores logs, screenshots, traces, and reports in object storage.
5. Worker updates `PlaywrightRun` and writes audit/outbox events.

The UI must never receive raw secrets or execute shell commands directly.

Mock implementation:

- `playwrightApi.start` creates a `PENDING` queued job.
- The dispatcher assigns `runnerId`, command, working directory, timeout, dispatch time, and heartbeat metadata.
- Completion creates log/report/trace artifact attachments with object-storage-style paths.
- Pending or running jobs can be cancelled.
- Phase 10 adds command metadata and trace support to Playwright start/cancel commands.

Phase 13 Runner and Integration Settings:

- Playwright runner config should be persisted and versioned.
- Command template, working directory, timeout, runner id, artifact root, and secret references are settings, not hard-coded browser behavior.
- CDE and FAVA adapters should be feature-flagged and use credential references only.
- Workers must resolve secrets server-side and never expose raw credentials to the browser.
