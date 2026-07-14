# Phase 11 Admin Unlock and Post-Decision Lock Notes

This document records the frontend/mock implementation boundary for post-decision locks and audited unlock.

## Implemented Mock Behavior

- VersionHistory final decision locks linked Test Runs.
- Linked Bugs are also locked through the same VersionHistory decision path.
- Locked Bugs cannot be assigned, updated, moved to ready-for-retest, retested, or closed.
- Creating a new Bug from a locked failed Run is blocked.
- System Admin can unlock a locked Test Run or Bug only with a required reason.
- Unlock writes audit metadata and command trace records.
- The Test Run/Bug UI shows lock state and exposes Admin-only unlock actions.

## Backend Boundary

Production should persist lock metadata on TestRun and Bug:

- `lockedByVersionHistoryId`
- `lockedAt`
- `unlockedById`
- `unlockedAt`
- `unlockReason`

Unlock must be a privileged command with required reason, audit, command trace, and idempotency support.
