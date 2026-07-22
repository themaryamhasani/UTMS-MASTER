# UTMS

UTMS is a Persian, RTL Unified Test Management System organized as an npm-workspace monorepo. The current checkout includes a React web application, a transitional Node API, a complete Prisma/PostgreSQL schema, local persistence adapters, automated QA, and Docker environments.

For the exact runtime and persistence boundaries, start with [Current Implementation](docs/architecture/CURRENT_IMPLEMENTATION.md). In particular, the Prisma schema is broader than the current PostgreSQL-backed runtime: users, applications and workflow policies have dedicated Prisma adapters; most other domain services still use transitional file/browser persistence through the domain-RPC bridge.

## Workspaces

- `apps/web` - React/Vite frontend.
- `apps/api` - health, domain RPC, partial PostgreSQL adapters and API Console transitional server.
- `apps/worker` - background worker capability descriptor; no processor loop yet.
- `apps/playwright-runner` - isolated execution capability descriptor; no job executor yet.
- `packages/contracts` - shared API contracts.
- `packages/shared` - framework-independent shared utilities.
- `packages/config` - shared configuration contracts.
- `packages/test-support` - shared test fixtures and builders.

## Prerequisites

- Node.js 22 and npm, matching CI and Docker.
- PostgreSQL 16 for database-backed users, applications and workflow policies, or Docker Compose for the complete local infrastructure.
- Playwright browser binaries only when running browser suites.

## Quick Start

Use `npm.cmd` on Windows PowerShell when script execution policy blocks `npm.ps1`.

```bash
npm ci
npm run db:migrate
npm run db:seed
npm run dev:all
```

The web app runs on `http://localhost:5173`, the API on `http://localhost:4174`, and Vite proxies API-only paths to the API server. `npm run dev` starts only the web app; use `dev:web`, `dev:api`, `dev:worker` and `dev:runner` for individual workspaces.

Useful checks:

```bash
npm run backend:self-check
npm run db:verify
npm run verify
```

`npm run verify` covers formatting, lint, architecture rules, type checking, workspace unit/contract checks and builds. It does not run the Playwright projects below.

## Runtime APIs

- Health: `GET /api/health`
- Domain discovery: `GET /api/domain/health` and `GET /api/domain/services`
- Domain execution: `POST /api/domain/rpc`
- Online API Console: `/api/api-console/*`

See [Domain RPC API](docs/api/DOMAIN_RPC_API.md), [Reports API](docs/api/REPORTS_API.md) and [Online API Console](docs/api/ONLINE_API_CONSOLE_IMPLEMENTATION.md).

## Automated QA

The repository uses Playwright Test for browser, API, system, security, accessibility, compatibility, bounded performance, reliability, regression, UAT and structural decision suites. Start with
[the test strategy](docs/testing/PLAYWRIGHT_TEST_STRATEGY.md), then run:

```bash
npm ci
npx playwright install chromium firefox webkit
npm run test:smoke
npm run test:integration
npm run test:e2e
npm run test:system
npm run test:security
npm run test:accessibility
npm run test:compatibility
npm run test:performance
npm run test:reliability
npm run test:regression
npm run test:uat
npm run test:structural
npm run test:all
```

For the isolated Docker environment use `npm run test:stack:up`, `npm run test:stack:wait`, `npm run test:stack:seed` and `npm run test:stack:down`. Reports are written to ignored `artifacts/tests/`, `test-results/`, `playwright-report/` and `coverage/` directories. The
[coverage matrix](docs/testing/TEST_COVERAGE_MATRIX.md) distinguishes executed
evidence from known implementation gaps.

## Docker Compose

Run the core system from the repository root:

```bash
docker compose up --build
```

The Compose system starts Postgres, Redis, the API on `http://localhost:4174`, and the web app on `http://localhost:5173`. Optional background foundations are available with profiles:

```bash
docker compose --profile jobs --profile runner up --build
```

Stop the stack and keep volumes:

```bash
docker compose down
```

Remove persisted Compose data when you need a clean local system:

```bash
docker compose down -v
```

## Documentation

Start with [docs/INDEX.md](docs/INDEX.md). The primary current-state references are:

- [Current implementation](docs/architecture/CURRENT_IMPLEMENTATION.md)
- [Final repository structure](docs/architecture/FINAL_REPOSITORY_STRUCTURE.md)
- [Dependency inventory](docs/architecture/DEPENDENCY_INVENTORY.md)
- [Database guide](database/README.md)
- [Playwright strategy](docs/testing/PLAYWRIGHT_TEST_STRATEGY.md)
- [Known test gaps](docs/testing/KNOWN_TEST_GAPS.md)

Plans, phase notes, fix trackers and completed restructuring reports are retained as historical records under `docs/migration` and are not the current runtime source of truth.

## Runtime Data

Runtime and generated data belong under ignored locations:

- `runtime/`
- `artifacts/`
- app-local `dist/`

Do not put source files, runtime stores, generated reports, logs, or archives in the repository root.
