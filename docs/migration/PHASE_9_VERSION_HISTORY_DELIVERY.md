# Phase 9 VersionHistory Snapshot and Delivery Notes

This document records the frontend/mock implementation boundary for VersionHistory decision delivery.

## Snapshot Alignment

Implemented mock behavior:

- VersionHistory snapshot now computes `securityChecklistResult` from per-TestCase Security Review records.
- Linked Test Cases are resolved from the single Primary Test Request used by the publish UX.
- Security Review aggregation rule:
  - any failed item -> `FAIL`
  - otherwise any partial item -> `PARTIAL`
  - all linked reviews completed and all items pass or are not applicable -> `PASS`
  - otherwise -> `NOT_TESTED`
- Legacy request-level `Checklist` data remains a fallback when no per-TestCase Security Review exists.

## Decision Notifications

Implemented mock behavior:

- Final decisions enqueue notifications through the Phase 7 outbox model.
- `publish` and Emergency Risk Acceptance also enqueue notifications.
- Notifications are linked to `VERSION_HISTORY`.
- Stakeholder recipients are deduplicated from:
  - VersionHistory creator
  - QA reviewer
  - decision owner
  - Primary request requester and assignee
  - assigned developers on linked bugs
  - QA Lead, Tech Lead, and Product Owner roles in the same Application scope

## Backend Boundary

Production should commit the following in one transaction for final decisions:

- VersionHistory status and decision fields
- immutable decision snapshot
- linked TestRun locks
- Primary Test Request release fields
- audit event
- notification and outbox records

The same pattern should apply to publish and emergency risk acceptance commands.
