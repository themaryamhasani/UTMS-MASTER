# UTMS

Unified Test Management System is now organized as an npm-workspace monorepo.

## Workspaces

- `apps/web` - React/Vite frontend.
- `apps/api` - backend API entrypoint and API Console transitional module.
- `apps/worker` - background worker foundation.
- `apps/playwright-runner` - isolated Playwright execution foundation.
- `packages/contracts` - shared API contracts.
- `packages/shared` - framework-independent shared utilities.
- `packages/config` - shared configuration contracts.
- `packages/test-support` - shared test fixtures and builders.

## Common Commands

Use `npm.cmd` on Windows PowerShell when script execution policy blocks `npm.ps1`.

```bash
npm install
npm run dev:web
npm run dev:api
npm run backend:self-check
npm run verify
npm run build
```

The web dev server proxies `/api` to the API server on port `4174`.

## Automated QA

The repository uses Playwright Test for browser, API, system, security,
accessibility, compatibility, performance, reliability, regression, UAT, and
structural decision suites. Start with
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
npm run test:structural
npm run test:all
```

For the isolated Docker environment use `npm run test:stack:up`,
`npm run test:stack:wait`, `npm run test:stack:seed`, and
`npm run test:stack:down`. Reports are written to ignored `artifacts/tests/`,
`test-results/`, `playwright-report/`, and `coverage/` directories. The
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

Start with [docs/INDEX.md](docs/INDEX.md). The restructuring details are in:

- [Repository restructure plan](docs/REPOSITORY_RESTRUCTURE_PLAN.md)
- [Final repository structure](docs/architecture/FINAL_REPOSITORY_STRUCTURE.md)
- [Dependency inventory](docs/architecture/DEPENDENCY_INVENTORY.md)
- [Legacy component tracker](docs/migration/LEGACY_COMPONENT_TRACKER.md)
- [Repository restructuring report](docs/migration/REPOSITORY_RESTRUCTURING_REPORT.md)

## Runtime Data

Runtime and generated data belong under ignored locations:

- `runtime/`
- `artifacts/`
- app-local `dist/`

Do not put source files, runtime stores, generated reports, logs, or archives in the repository root.
