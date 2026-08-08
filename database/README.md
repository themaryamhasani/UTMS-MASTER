# Database

Source-verified: 2026-08-08

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
- Per-test-request security reviews created only when QA explicitly requires a security test, plus checklist templates.
- Playwright runs, CouchDB document/revision/binding indexes, legacy managed/discovered test files, hidden discovery paths and artifacts through attachments.
- VersionHistory release decisions, linked requests, revisions and immutable snapshots.
- Audit logs, comments, notifications, notification outbox, command traces and idempotency records.
- Online API Console collections, request definitions, executions, sharing, consumers, references, usage and documentation evidence.
- Scheduled reports, report alerts and domain-event outbox records.

## Runtime Adoption

Schema coverage is not the same as repository coverage. The API routes
`userApi`, `applicationApi` and `workflowPolicyApi` to dedicated PostgreSQL
adapters. Test requests, requirements, flows and test cases use
`postgres-test-management-state.cjs`, which refreshes those collections from
PostgreSQL before RPC execution and persists mutations transactionally.
Other domain-RPC services still use transitional server file persistence or
browser persistence in mock mode, even when a Prisma model exists. See
[Current Implementation](../docs/architecture/CURRENT_IMPLEMENTATION.md#persistence-boundary).

## Migrations

The current migration chain is:

1. `20260720000000_init_utms_postgres`
2. `20260726000000_request_security_workflow`
3. `20260726103000_test_request_types_text`
4. `20260726114000_complete_approved_test_requests`
5. `20260726130000_security_review_follow_up`
6. `20260803130000_live_cde_playwright`
7. `20260808110000_couchdb_playwright_store`

The third migration changes `TestRequest.testTypes` to `TEXT[]`, matching the
multi-select domain model. The fourth completes the primary test request when
an approved or conditional release decision has already been recorded.
The fifth adds the traceable security-remediation states, executions,
transitions and attachment references, and removes `NOT_TESTED` from security
review item results.

The sixth migration introduces server sessions, CDE mappings, branch
selections, environments, snapshots and real Playwright-run metadata. The
seventh moves authoritative Playwright source to CouchDB by adding Couch
document/revision/binding metadata and making the historical writable-CDE-test
package fields nullable.

The committed seed populates workflow policies, applications, identity/role data, integration and runner settings, VersionHistory/testing baselines and API Console relational tables. The Online API Console runtime itself remains on its dedicated file store in this checkout.
