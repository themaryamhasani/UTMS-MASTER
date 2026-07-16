# Final Repository Structure

## Directory Tree

```text
utms/
├── apps/
│   ├── api/
│   ├── playwright-runner/
│   ├── web/
│   └── worker/
├── packages/
│   ├── config/
│   ├── contracts/
│   ├── shared/
│   └── test-support/
├── database/
│   └── prisma/
├── infrastructure/
│   ├── compose/
│   └── docker/
├── scripts/
│   ├── database/
│   ├── development/
│   └── verification/
├── docs/
│   ├── ADR/
│   ├── api/
│   ├── architecture/
│   ├── migration/
│   ├── testing/
│   └── workflows/
├── tests/
│   ├── accessibility/
│   ├── compatibility/
│   ├── contract/
│   ├── e2e/
│   ├── performance/
│   ├── regression/
│   ├── reliability/
│   ├── smoke/
│   ├── structural/
│   ├── system/
│   └── uat/
├── artifacts/
├── runtime/
├── package.json
├── package-lock.json
├── tsconfig.base.json
├── eslint.config.js
├── prettier.config.js
├── .editorconfig
├── .env.example
├── .env.test.example
└── README.md
```

## Top-Level Responsibilities

- `apps` contains independently runnable applications.
- `packages` contains shared packages with explicit ownership.
- `database` contains Prisma schema, migrations, and seeds.
- `infrastructure` contains Docker, compose, observability, and deployment support.
- `scripts` contains permanent root-runnable scripts.
- `docs` contains categorized documentation.
- `tests` contains cross-workspace contract, browser, system, accessibility, compatibility, performance, reliability, regression, UAT, and structural suites. API integration/security specs live under `apps/api/test`.
- `artifacts` and `runtime` are ignored generated/runtime locations.

## Dependency Direction

Backend module code follows presentation to application to domain. Infrastructure may implement domain/application ports. Domain code must not import framework, persistence, queue, filesystem, or environment modules.

Frontend code must not import backend implementation. Worker code must not import frontend code. API code must not import Playwright runner implementation. Production code must not import `packages/test-support`.

## Adding New Frontend Features

Add feature-owned UI and behavior under `apps/web/src/features/<feature-name>` when creating new feature code. Shared UI primitives belong in `apps/web/src/components` only when reused across features.

## Adding New Backend Modules

Add backend modules under `apps/api/src/modules/<module-name>` using kebab-case names. Keep controllers thin, put business workflows in application handlers/domain services, and keep persistence in infrastructure.

## Adding Scripts

Add permanent scripts under `scripts/development`, `scripts/database`, `scripts/migration`, `scripts/verification`, or `scripts/ci`. Expose only meaningful workspace-level commands from the root `package.json`.

## Adding Tests

- Unit tests stay near source.
- API integration/E2E/security tests go under `apps/api/test`.
- Worker and runner tests go under their app `test` folders.
- Cross-workspace contract tests go under `tests/contract`.
- Cross-workspace browser/system suites go under the matching `tests/<suite>` directory and are mapped to Playwright projects in `playwright.config.ts`.
- Shared fixtures go under `packages/test-support`.

## Adding Infrastructure

Add Dockerfiles under `infrastructure/docker/<app>` and compose files under `infrastructure/compose`.
