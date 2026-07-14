# Contracts Package

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
