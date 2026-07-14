# Phase 10 Command Boundary and Idempotency Notes

This document records the frontend/mock implementation boundary for command metadata, idempotency, and correlation tracing.

## Implemented Mock Behavior

- Shared `CommandMetadata` was added with:
  - `Idempotency-Key`
  - `Correlation-ID`
  - requested time
  - command source
- Sensitive mock commands now accept optional command metadata.
- Successful idempotent commands are cached by command name and idempotency key.
- Repeated commands with the same key return the previous result and write a `REPLAYED` command trace instead of duplicating domain side effects.
- Audit logs can carry command metadata.
- Notifications and outbox items carry the same correlation id used by the domain command.
- A read-only `commandTraceApi` exposes command traces by application, correlation id, and idempotency key.

## Covered Commands

- Bug ready-for-retest and retest result commands
- RetestTask ensure/start/complete commands
- TestRun create/update status commands
- Playwright start/cancel commands
- VersionHistory create, submit for QA review, QA quality review, final decision, publish, and emergency risk acceptance commands

## Backend Boundary

Production APIs should map these fields to headers:

- `Idempotency-Key`
- `Correlation-ID`
- active user/context headers

Production persistence should store command records durably and commit the command record, domain mutation, audit event, and notification outbox rows in the same transaction for sensitive workflows.

The mock command trace is not a replacement for backend persistence; it is a frontend/API contract shape for the future backend implementation.
