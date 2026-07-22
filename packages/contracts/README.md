# Contracts Package

Source-verified: 2026-07-22

`packages/contracts` owns public API contracts shared across apps and packages.

What belongs here:

- DTOs exchanged across app boundaries.
- Enums and literal unions used by more than one runtime.
- Pagination and error contracts.
- Domain events published between bounded contexts.

What does not belong here:

- Backend implementation classes.
- Frontend-only UI state.
- Test fixtures.
- Framework-specific validators or decorators.

Contracts must remain framework-independent and must not read environment variables.

## Current Exports

- Pagination DTOs.
- `UserRole`.
- API error contracts.
- Domain-event contracts.

Many detailed UTMS entity types still live under `apps/web/src/types`. Move a type here only when it is genuinely exchanged across runtime boundaries, and update both producers and consumers together.
