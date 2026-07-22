# Database

Source-verified: 2026-07-22

Database ownership lives under `database/`.

What belongs here:

- Prisma schema, migrations, and domain-organized seed files under `database/prisma`.
- Database utility scripts under `database/scripts` when they are implementation assets.

What does not belong here:

- Application business logic.
- Runtime database dumps.
- Backend repositories or service classes.

Operational commands should be exposed through root `npm run db:*` scripts and implemented under `scripts/database`.

## Local PostgreSQL

The default local connection is:

```text
postgresql://postgres:1234@localhost:5432/UTMS?schema=public
```

Root commands:

- `npm run db:generate` generates the Prisma Client.
- `npm run db:migrate` applies migrations to the configured PostgreSQL database.
- `npm run db:migrate:status` checks migration state.
- `npm run db:seed` inserts baseline workflow, runner, integration and API Console infrastructure rows.
- `npm run db:verify` validates the Prisma schema and confirms the core UTMS tables exist.

`db:migrate` runs `prisma migrate deploy`; it does not create a development migration interactively. Set `DATABASE_URL` to override the local default.

## Schema Coverage

The initial schema covers the UTMS production domains:

- Identity, application scope, user credentials, sessions and role assignments.
- Workflow policies, integration adapter settings and Playwright runner settings.
- Test requests, requirements, flows, test cases, test runs, bugs, retest tasks, run issues and checklists.
- Per-test-case security reviews and checklist templates.
- Playwright runs, managed/discovered test files, hidden discovery paths and artifacts through attachments.
- VersionHistory release decisions, linked requests, revisions and immutable snapshots.
- Audit logs, comments, notifications, notification outbox, command traces and idempotency records.
- Online API Console collections, request definitions, executions, sharing, consumers, references, usage and documentation evidence.
- Scheduled reports, report alerts and domain-event outbox records.

## Runtime Adoption

Schema coverage is not the same as repository coverage. The API currently routes `userApi`, `applicationApi` and `workflowPolicyApi` to PostgreSQL adapters. Other domain-RPC services use transitional server file persistence (or browser persistence in mock mode) even though corresponding Prisma models exist. See [Current Implementation](../docs/architecture/CURRENT_IMPLEMENTATION.md#persistence-boundary).

The committed seed populates workflow policies, applications, identity/role data, integration and runner settings, VersionHistory/testing baselines and API Console relational tables. The Online API Console runtime itself remains on its dedicated file store in this checkout.
