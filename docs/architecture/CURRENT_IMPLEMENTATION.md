# Current Implementation

Source-verified: 2026-07-22

This document describes the code that is executable in this checkout. Product requirements and phase reports describe intended or historical behavior; when they conflict with runtime details, this document and the linked source files are the current implementation reference.

## Runtime Topology

| Runtime | Entry point | Current responsibility | Maturity |
| --- | --- | --- | --- |
| Web | `apps/web/src/main.tsx` | React 19/Vite UI, route guards, active-context selection, cartables, reports and API Console client | Executable |
| API | `apps/api/src/main.cjs` | Health, domain RPC, reports RPC and Online API Console HTTP routes | Executable transitional server |
| Worker | `apps/worker/src/main.ts` | Declares notification-outbox and scheduled-report capabilities | Foundation only; no processor loop |
| Playwright runner | `apps/playwright-runner/src/main.ts` | Declares per-run isolation and artifact policy | Foundation only; no job executor |
| PostgreSQL | `database/prisma/schema.prisma` | Full target relational schema and baseline seed data | Schema/migration executable; runtime adapters are partial |
| Redis | Compose services | Provisioned dependency for future queues/coordination | Not used by current domain operations |

The default development ports are web `5173`, API `4174`, PostgreSQL `5432` and Redis `6379`.

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

The API server exposes four groups:

- `GET /api/health` for process health.
- `GET /api/domain/health`, `GET /api/domain/services` and `POST /api/domain/rpc` for domain services and reports.
- `/api/api-console/*` for Online API Console collections, requests, execution, sharing, repository, documentation and exports.
- `/api/reports/*` as an API Console server prefix; report read models used by the web app currently run through `reportsApi` over domain RPC.

The machine-readable API Console inventory is `tests/data/api-route-inventory.json`. See [Domain RPC API](../api/DOMAIN_RPC_API.md), [Reports API](../api/REPORTS_API.md) and [Online API Console](../api/ONLINE_API_CONSOLE_IMPLEMENTATION.md).

## Persistence Boundary

The repository contains a complete Prisma schema, but the running system uses a mixed persistence model.

| Data | Runtime persistence | Source |
| --- | --- | --- |
| Users, credentials, password-reset OTPs, role assignments | PostgreSQL through Prisma | `postgres-user-service.cjs` |
| Applications | PostgreSQL through Prisma | `postgres-application-service.cjs` |
| Workflow policies and application-policy assignment | PostgreSQL through Prisma | `postgres-workflow-policy-service.cjs` |
| Test-management domains, reports, settings and security reviews | API-process memory plus `runtime/domain-rpc/utms-state.json` when invoked through domain RPC; IndexedDB with a localStorage mirror in browser mock mode | `apps/web/src/services/api.ts`, `persistentStore.ts`, `reportsApi.ts` |
| Online API Console | JSON store, encrypted secret vault and key beneath `API_CONSOLE_DATA_DIR` | `api-console-server.cjs` |
| PostgreSQL schema beyond the three adapters above | Tables and seeds exist, but the current domain server does not yet route those services to Prisma repositories | `database/prisma/schema.prisma` |
| Redis | Persistent Compose volume only | No application consumer yet |

This means “backend mode” is real HTTP execution, but it is not synonymous with “all domains use PostgreSQL.” The domain server bundles the transitional TypeScript service implementation from `apps/web/src/services` for services without a dedicated PostgreSQL adapter.

## Domain RPC Behavior

The browser wraps domain service objects with `createDomainRpcProxy`.

- `VITE_DOMAIN_API_MODE=backend` is the default. Calls go to `POST /api/domain/rpc`.
- `VITE_DOMAIN_API_MODE=mock` runs eligible operations in the browser. Users, applications and workflow policies remain backend-only.
- `VITE_DOMAIN_API_MODE=strict` disables availability fallback.
- In non-strict backend mode, any backend error on an eligible service falls back to its local implementation. Transport/502/503/504 failures also open the temporary fallback circuit for subsequent calls.
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

`db:migrate` uses `prisma migrate deploy`. `db:verify` validates the schema, connects to PostgreSQL and checks required UTMS tables. The committed initial migration is under `database/prisma/migrations/20260720000000_init_utms_postgres`.

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

The normal Compose stack is:

```bash
docker compose up --build
```

Optional foundations use `--profile jobs` and `--profile runner`.

## Verification

`npm run verify` runs format checking, lint, architecture rules, type checking, workspace unit checks, contract checks and builds. Playwright and k6 suites are separate; see [Playwright strategy](../testing/PLAYWRIGHT_TEST_STRATEGY.md) and [performance guide](../testing/PERFORMANCE_EXECUTION_GUIDE.md).

CI is defined in `.github/workflows/qa.yml` and uses Node.js 22, an isolated Compose test stack, Chromium/Firefox/WebKit projects, bounded evidence suites and safe k6 profiles.

## Known Production Gaps

- Most Prisma models do not yet have runtime repositories.
- Domain RPC reuses and bundles frontend service code as a transitional adapter.
- The current API Dockerfile does not copy `apps/web/src`, so the dynamically generated non-PostgreSQL service bundle is unavailable inside that image; eligible browser calls can fall back locally. The image must include a prebuilt backend-owned bundle or, preferably, dedicated modules.
- API Console and most domain state remain file-backed outside the three PostgreSQL-backed services.
- The root Compose file mounts API Console state but not `runtime/domain-rpc`, so transitional domain state is not durable across API-container replacement.
- The active-context header is development trust, not signed authentication/authorization.
- Redis, the worker and the product Playwright runner are not operational integrations.
- Scheduled reports, alert delivery, external CDE/FAVA calls and production object storage are not implemented.
- API Console persistence and secret storage need production database/secret-management adapters.

Track test-specific limitations in [Known Test Gaps](../testing/KNOWN_TEST_GAPS.md).
