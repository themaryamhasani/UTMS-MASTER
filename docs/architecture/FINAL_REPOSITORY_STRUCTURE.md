# Repository Structure

Source-verified: 2026-07-22

## Directory Tree

```text
utms/
|-- .github/workflows/       CI workflows
|-- apps/
|   |-- api/                 Node HTTP API and backend adapters
|   |-- playwright-runner/   product runner foundation
|   |-- web/                 React/Vite frontend
|   `-- worker/              background-job foundation
|-- packages/
|   |-- config/              environment contracts
|   |-- contracts/           cross-runtime DTOs/events/errors
|   |-- shared/              framework-independent utilities and Prisma client
|   `-- test-support/        reusable test builders/fixtures
|-- database/prisma/         schema, migrations and seeds
|-- infrastructure/
|   |-- compose/             development, test and performance stacks
|   `-- docker/              application and test-support images
|-- scripts/
|   |-- database/            Prisma and database verification tasks
|   |-- development/         local process orchestration
|   |-- testing/             test stack and suite orchestration
|   `-- verification/        format, lint, architecture and contracts
|-- performance/             k6 scenarios, journeys, helpers and reporting
|-- docs/
|   |-- ADR/                 architecture decisions
|   |-- api/                 executable API references
|   |-- architecture/        current topology and dependency boundaries
|   |-- migration/           historical delivery and migration evidence
|   |-- testing/             QA and performance evidence
|   `-- workflows/           requirements and workflow rules
|-- tests/                   cross-cutting Playwright suites and fixtures
|-- artifacts/               ignored generated test/performance output
|-- runtime/                 ignored local runtime state
|-- docker-compose.yml       default local stack
|-- package.json             workspace commands and dependencies
|-- playwright.config.ts     Playwright projects and reporters
|-- prisma.config.ts         Prisma schema/seed configuration
`-- tsconfig.base.json       shared TypeScript defaults
```

## Top-Level Ownership

- `apps` contains independently runnable applications.
- `packages` contains code intended for reuse across applications.
- `database` owns the relational schema, migrations and seed definitions; repository/service implementations remain with the application that uses them.
- `infrastructure` owns Docker and Compose definitions, not application source or secrets.
- `scripts` contains permanent commands that run from the repository root.
- `performance` contains the k6 harness; browser performance assertions remain under `tests/performance`.
- `docs` separates current references from historical migration evidence.
- `tests` contains cross-workspace browser, API, structural and system evidence. API integration/security specs live under `apps/api/test`.
- `runtime` and `artifacts` are generated, ignored and must not be treated as source.

## Current Internal Structure

The intended feature/module architecture is only partially decomposed:

- Frontend screens currently live under `apps/web/src/pages`, shared controls under `components`, service interfaces under `services`, and domain types under `types`.
- API Console is a large transitional CommonJS adapter under `apps/api/src/modules/api-console/infrastructure/http`.
- Domain RPC and three PostgreSQL adapters live under `apps/api/src/modules/domain-rpc`.
- The domain-RPC dispatcher temporarily bundles service implementations from `apps/web/src/services` for domains without backend-owned adapters.

Do not infer that the planned `features/<feature>` or clean-domain slices already exist. See [Current Implementation](CURRENT_IMPLEMENTATION.md) for the executable boundary.

## Dependency Direction

The repository checks these core rules through `npm run architecture:check`:

- Frontend code must not import backend implementation.
- Worker code must not import frontend code.
- API code must not import the Playwright runner implementation.
- Production code must not import `packages/test-support`.
- Shared contracts and utilities must stay framework-independent.
- Runtime/generated directories must not become source dependencies.

The domain-RPC server's bundling of frontend service modules is an explicitly transitional exception implemented through a generated runtime bundle, not a target dependency direction.

## Adding Code

### Frontend

Add cohesive new features under `apps/web/src/features/<feature-name>` when practical. Existing page-oriented code may be migrated incrementally. Shared UI primitives belong in `apps/web/src/components/ui` only when reused.

### API

Add backend-owned modules under `apps/api/src/modules/<module-name>`. Keep HTTP handling thin, domain workflows in application/domain services and persistence in infrastructure adapters. New production work should not expand the generated domain-RPC dependency on frontend code.

### Database

Update `database/prisma/schema.prisma`, generate a committed migration under `database/prisma/migrations`, update domain-organized seeds and verify with the root `db:*` commands.

### Scripts

Use the existing `scripts/development`, `scripts/database`, `scripts/testing` and `scripts/verification` categories. Expose stable repository workflows through the root `package.json`.

### Tests

- Unit tests stay near their owning source when introduced.
- API integration/security specs belong under `apps/api/test`.
- Cross-cutting suites belong in the matching `tests/<suite>` directory and Playwright project.
- Shared test-only builders and generators belong in `packages/test-support`.
- k6 scenarios and journeys belong under `performance`.

### Infrastructure

Add images beneath `infrastructure/docker/<service>` and specialized stacks beneath `infrastructure/compose`. Keep the root Compose file as the discoverable default local stack.
