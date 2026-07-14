# Phase 6/7 Execution and Delivery Notes

This document records the mock implementation boundary for Phase 6 Playwright execution and Phase 7 notification delivery.

## Phase 6: Playwright Queue/Runner

Implemented mock behavior:

- `playwrightApi.start` creates a queued `PENDING` run.
- The dispatcher moves the run to `RUNNING`, assigns a runner id, command, working directory, timeout, dispatch timestamp, and heartbeat timestamp.
- Completion stores deterministic pass/fail/skip/cancel statistics and creates artifact attachments:
  - `runner.log`
  - `playwright-report.html`, `playwright-report.json`, or `playwright-report.xml` based on the selected reporter
  - `trace.zip`
- Artifact paths use an object-storage-style path under `/object-storage/playwright/{runId}`.
- Runs can be cancelled while `PENDING` or `RUNNING`; cancellation creates a partial report with named cancelled tests.
- The UI exposes discovered/manual paths, timeout, queue status, runner metadata, command, working directory, logs, and non-report artifact paths.
- The start form includes user-friendly Playwright options: Browser/Project multi-select, headed mode, workers, retries, max failures, trace, and reporter.
- The detail modal previews the selected report format, downloads the generated report file, shows failure line/column/code-frame details, and lists Passed, Skipped, and Cancelled tests by name.

Production boundary:

- Browser code must not execute shell commands.
- A backend API should persist the job and enqueue a worker command.
- A worker/runner should execute Playwright with controlled secrets and environment.
- Logs, screenshots, traces, and reports should be uploaded to object storage with MIME/file extension matching the selected reporter.
- Backend report ingestion should preserve Playwright-style test result details: test title, project, file, line/column, error message, code frame, and status-specific named test lists.
- Runner updates should write audit and notification outbox records.

## Phase 7: Notification Outbox

Implemented mock behavior:

- Creating a notification also creates one `NotificationOutboxItem` per channel.
- Default workflow channels are `IN_APP` and `EMAIL`.
- `SMS` is present in the shared type contract for production parity.
- Delivery items track:
  - notification id
  - user id
  - channel
  - status
  - retry count
  - last error
  - correlation id
  - created time
  - delivered time
- Notification records expose aggregate delivery state through `channels`, `deliveryStatus`, and `deliveredAt`.
- The notification API exposes:
  - `getOutbox(userId?)`
  - `processOutbox(limit?, userId?)`
  - `retryFailed(userId?)`

Production boundary:

- Domain commands should write notification and outbox records in the same transaction.
- Delivery workers should process outbox rows asynchronously with provider-specific retry/backoff.
- Email and SMS provider integration remains backend work.
- Correlation IDs and idempotency keys should be carried across audit, command, and notification delivery logs.
