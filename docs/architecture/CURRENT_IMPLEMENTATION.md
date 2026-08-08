# Current Implementation

Source-verified: 2026-08-08

This document describes the code that is executable in this checkout. Product requirements and phase reports describe intended or historical behavior; when they conflict with runtime details, this document and the linked source files are the current implementation reference.

The live CDE transport, direct project browser, mapped Playwright file workflow,
snapshot worker, and real runner are documented in detail in
[Live CDE and Playwright implementation record](../integrations/CDE_PLAYWRIGHT_IMPLEMENTATION.md).

## Runtime Topology

| Runtime | Entry point | Current responsibility | Maturity |
| --- | --- | --- | --- |
| Web | `apps/web/src/main.tsx` | React 19/Vite UI, route guards, active-context selection, cartables, reports and API Console client | Executable |
| API | `apps/api/src/main.cjs` | Health, domain/report RPC, Online API Console, server sessions, live CDE integration and Playwright orchestration routes | Executable transitional server |
| Worker | `apps/worker/src/runtime.mjs` | BullMQ CDE source-snapshot materialization and expired-snapshot purge | Executable for the Playwright pipeline; other declared worker capabilities remain foundations |
| Playwright runner | `apps/playwright-runner/src/runtime.mjs` | BullMQ Playwright 1.55 execution, heartbeat/cancellation and encrypted artifact upload | Executable product runner |
| PostgreSQL | `database/prisma/schema.prisma` | Target relational schema, migrations and baseline seed data | Executable; runtime adoption is partial |
| Redis | Compose or the local development launcher | CDE session state, CouchDB path locks, BullMQ queues and run cancellation | Active dependency for CDE/Playwright operations |
| CouchDB | Compose or configured external service | Authoritative Playwright test documents bound to exact CDE project mappings | Active dependency for Playwright file management and snapshots |
| S3-compatible storage | MinIO in Compose | Encrypted immutable source snapshots and Playwright artifacts | Active dependency for snapshot/run execution |

The default development ports are web `5173`, API `4174`, PostgreSQL `5432`,
Redis `6379`, CouchDB `5984`, MinIO `9000`, and the MinIO console `9001`.

## Web Routes

`apps/web/src/App.tsx` defines the route table and applies `canAccessCartable` before rendering guarded pages.

| Route | Page or behavior |
| --- | --- |
| `/` | Redirect to `/dashboard` |
| `/dashboard` | Dashboard |
| `/test-requests` | Test requests |
| `/requirements` | Requirements and flows |
| `/test-cases` | Test cases |
| `/test-runs` | Redirect to `/test-runs-bugs` |
| `/bugs` | Bugs |
| `/test-runs-bugs` | Test-run execution and bugs |
| `/developer-board` | Developer work board |
| `/run-issues` | Run issues |
| `/checklists` | Checklists |
| `/security-review` | Security remediation and role-to-role follow-up |
| `/playwright` | Playwright runs |
| `/playwright-files` | Managed/discovered Playwright files |
| `/releases` | VersionHistory decisions and publishing |
| `/reports` | Reports |
| `/api-console` | Online API Console |
| `/users` | User administration |
| `/applications` | Application administration |
| `/checklist-admin` | Security-checklist template administration |
| `/admin-operations` | Command/outbox/audit operations |
| `/audit` | Audit log |
| `/settings` | Integration and runner settings |

Unauthenticated users see the login flow. Authenticated users without permission are redirected to the dashboard; unknown paths render the in-app 404 page.

## HTTP Surfaces

The API server exposes these principal groups:

- `GET /api/health` for process health.
- `GET /api/domain/health`, `GET /api/domain/services` and `POST /api/domain/rpc` for domain services and reports.
- `/api/api-console/*` for Online API Console collections, requests, execution, sharing, repository, documentation and exports.
- `/api/reports/*` as an API Console server prefix; report read models used by the web app currently run through `reportsApi` over domain RPC.
- `/api/auth/*` for opaque server login sessions, active-context switching and logout.
- `/api/cde/session*` for the separate server-side CDE connection.
- `/api/cde/projects*` for direct live CDE project/catalog/package browsing.
- `/api/applications/:id/cde/*`, `/playwright/files` and `/environments` for mapped source/test administration.
- `/api/playwright/runs*` and token-protected internal snapshot routes for real queued execution.

The machine-readable API Console inventory is `tests/data/api-route-inventory.json`. See [Domain RPC API](../api/DOMAIN_RPC_API.md), [Reports API](../api/REPORTS_API.md) and [Online API Console](../api/ONLINE_API_CONSOLE_IMPLEMENTATION.md).

## Persistence Boundary

The repository contains a complete Prisma schema, but the running system uses a mixed persistence model.

| Data | Runtime persistence | Source |
| --- | --- | --- |
| Users, credentials, password-reset OTPs, role assignments | PostgreSQL through Prisma | `postgres-user-service.cjs` |
| Applications | PostgreSQL through Prisma | `postgres-application-service.cjs` |
| Workflow policies and application-policy assignment | PostgreSQL through Prisma | `postgres-workflow-policy-service.cjs` |
| Test requests, requirements, flows and test cases | PostgreSQL snapshot bridge through Prisma; refreshed before RPC reads and persisted transactionally after mutations | `postgres-test-management-state.cjs` |
| Test runs, bugs, retest tasks, run issues, legacy checklists, non-CDE legacy Playwright state, VersionHistory, audit, notifications, comments, attachments, reports, settings and security reviews | API-process memory plus `runtime/domain-rpc/utms-state.json` when invoked through domain RPC; IndexedDB with a localStorage mirror in browser mock mode | `apps/web/src/services/api.ts`, `persistentStore.ts`, `reportsApi.ts` |
| UTMS sessions, CDE mappings, branch selections, environment profiles, CDE source snapshots, CouchDB Playwright metadata/cache and real Playwright runs | PostgreSQL through Prisma | `auth-session-server.cjs`, `cde-server.cjs`, `database/prisma/schema.prisma` |
| Authoritative Playwright test source and exact CDE project binding | CouchDB | `couchdb-test-store.cjs` |
| Encrypted CDE cookie jars, CouchDB path locks, snapshot/run queues and cancellation markers | Redis | `cde-session-store.cjs`, `cde-write-lock.cjs`, `playwright-queue.cjs` |
| Encrypted source snapshots and Playwright artifacts | Private S3-compatible storage | `object-store.cjs`, `apps/playwright-runner/src/runtime.mjs` |
| Online API Console | JSON store, encrypted secret vault and key beneath `API_CONSOLE_DATA_DIR` | `api-console-server.cjs` |
| Remaining PostgreSQL schema | Tables and seeds exist, but the remaining domain services are not yet routed to Prisma repositories | `database/prisma/schema.prisma` |

The test-management bridge hydrates its four collections from PostgreSQL
before domain-RPC execution and writes them back in one transaction after
mutations. `VersionHistory` is still transitional, so its relation is not
persisted by this snapshot bridge; the mirrored QA, security and release
decision fields on `TestRequest` are persisted.

“Backend mode” is real HTTP execution, but it is not synonymous with “all
domains use PostgreSQL.” The domain server bundles the transitional
TypeScript service implementation from `apps/web/src/services` for services
without a dedicated PostgreSQL adapter or bridge.

## Domain RPC Behavior

The browser wraps domain service objects with `createDomainRpcProxy`.

- `VITE_DOMAIN_API_MODE=backend` is the default. Calls go to `POST /api/domain/rpc`.
- `VITE_DOMAIN_API_MODE=mock` runs eligible operations in the browser. Users, applications and workflow policies remain backend-only.
- `VITE_DOMAIN_API_MODE=strict` disables availability fallback.
- In non-strict backend mode, only transport failures and HTTP 502/503/504 responses fall back to an eligible local implementation and open the temporary fallback circuit. Validation, authorization, domain and other 4xx/5xx errors are surfaced to the caller.
- Read operations use request single-flight and a short browser response cache. Mutations clear that cache.
- The server applies its own single-flight policy and persists non-query transitional state after mutations.

The development `x-utms-context` header carries active-context data. It is not a signed production authentication mechanism.

## Database Lifecycle

The default connection is `postgresql://postgres:1234@localhost:5432/UTMS?schema=public` unless `DATABASE_URL` is set.

```bash
npm run db:generate
npm run db:migrate
npm run db:migrate:status
npm run db:seed
npm run db:verify
```

`db:migrate` uses `prisma migrate deploy`. `db:verify` validates the schema,
connects to PostgreSQL and checks required UTMS tables. Committed migrations
currently include:

- `20260720000000_init_utms_postgres`
- `20260726000000_request_security_workflow`
- `20260726103000_test_request_types_text`
- `20260726114000_complete_approved_test_requests`
- `20260726130000_security_review_follow_up`
- `20260803130000_live_cde_playwright`
- `20260808110000_couchdb_playwright_store`

## Shared Packages

- `@utms/contracts`: pagination, user-role, API-error and domain-event contracts.
- `@utms/shared`: clocks, correlation IDs, secret redaction, validation results and the shared Prisma client export.
- `@utms/config`: environment contract types.
- `@utms/test-support`: deterministic builders, generators and fixtures; production code must not import it.

The frontend still owns most detailed UTMS domain types in `apps/web/src/types`. Moving cross-runtime shapes into `@utms/contracts` remains incomplete.

## Local Development

Use Node.js 22, matching Docker and CI.

```bash
npm ci
copy .env.example .env
npm run db:migrate
npm run db:seed
npm run dev:all
```

Individual processes are available through `npm run dev:web`, `npm run dev:api`, `npm run dev:worker` and `npm run dev:runner`. On Windows PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`.

`dev:all` preflights ports 5173 and 4174, reuses a reachable configured Redis,
tries an ephemeral development Redis when none is configured, and falls back
to Compose Redis when the Windows Memurai runtime is unavailable. It also
reuses CouchDB or starts the local Compose CouchDB service. It passes the same
dependency URLs to all four processes and cleans up their process trees on exit.
An occupied port fails startup instead of allowing Vite to silently select a
different port. The API process is not watched, so restart `dev:all` after API
source changes.

The current Windows workstation runs native Apache CouchDB 3.5.2 from
`F:\Program Files\Apache CouchDB` as an external service on port 5984 and uses
Compose Redis on port 6379. These endpoints are configured in ignored `.env`;
no second CouchDB container is started by `dev:all`.

The normal Compose stack is:

```bash
docker compose up --build
```

The default Compose stack includes PostgreSQL, Redis, CouchDB, MinIO, API and Web.
Snapshot-worker and Playwright-runner services use the jobs and runner profiles.

## Verification

`npm run verify` runs format checking, lint, architecture rules, type checking, workspace unit checks, contract checks and builds. Playwright and k6 suites are separate; see [Playwright strategy](../testing/PLAYWRIGHT_TEST_STRATEGY.md) and [performance guide](../testing/PERFORMANCE_EXECUTION_GUIDE.md).

CI is defined in `.github/workflows/qa.yml` and uses Node.js 22, an isolated Compose test stack, Chromium/Firefox/WebKit projects, bounded evidence suites and safe k6 profiles.

## Known Production Gaps

- Most Prisma models do not yet have dedicated runtime repositories.
- Domain RPC reuses and bundles frontend service code as a transitional adapter.
- The current API Dockerfile does not copy `apps/web/src`, so the dynamically
  generated transitional service bundle is unavailable inside that image.
  Bundle-loading failures are server errors and are now surfaced rather than
  hidden by local fallback. The image must include a prebuilt backend-owned
  bundle or, preferably, dedicated modules.
- API Console and remaining transitional domain state are file-backed outside the three dedicated PostgreSQL services and the test-management bridge.
- The root Compose file mounts API Console state but not `runtime/domain-rpc`, so transitional domain state is not durable across API-container replacement.
- The active-context header is development trust, not signed authentication/authorization.
- Scheduled reports, alert delivery and FAVA calls are not implemented.
- Live CDE source browsing is implemented, while managed Playwright edits and
  runs still require administrator mappings, CouchDB, deployed environment
  profiles, and production secret configuration. UTMS does not write tests to
  CDE; each Couch document carries an exact server-generated CDE binding.
- The CDE/Playwright pipeline uses S3-compatible encrypted object storage; its
  production object-store, network and container resource policies still need
  deployment-specific validation.
- API Console persistence and secret storage need production database/secret-management adapters.

Track test-specific limitations in [Known Test Gaps](../testing/KNOWN_TEST_GAPS.md).
