# Dependency Inventory

Source-verified against `package.json`, workspace manifests and `package-lock.json`: 2026-07-22

## Root Runtime Dependencies

- `@prisma/client` `7.8.0` and `@prisma/adapter-pg` `7.8.0` provide the generated client and PostgreSQL driver adapter.
- `pg` `8.22.0` provides PostgreSQL connectivity for Prisma and database verification.

These dependencies are installed at the workspace root and are resolved by API/shared database modules even though `apps/api/package.json` does not repeat them.

## Root Development Tooling

- TypeScript `5.9.3` and Node types `22.19.17`.
- Prisma CLI `7.8.0`.
- Playwright Test (declared `^1.55.0`; lockfile installation may select a newer compatible `1.x`).
- `@axe-core/playwright` for automated accessibility checks.
- `c8` for the configured structural coverage set.

Node.js 22 is used by Dockerfiles and CI.

## Web Application

Production dependencies in `apps/web/package.json`:

- React and React DOM `19.2.6`.
- React Router DOM `^7.18.0`.
- TanStack React Query `^5.101.2`.
- Zustand `^5.0.14`.
- Lucide React `^1.21.0`.
- `date-fns` and `date-fns-jalali`.
- `uuid`, `clsx`, `tailwind-merge` and the Vazirmatn font package.

Web development dependencies include Vite, the React and Tailwind Vite plugins, Tailwind CSS 4, `vite-plugin-singlefile`, esbuild and React/Node typings.

## API Application

The API package is CommonJS and uses:

- Node built-ins for the HTTP server, filesystem store, cryptography, networking, ZIP/DOCX generation and process control.
- Root Prisma/PostgreSQL dependencies for user, application and workflow-policy adapters.
- Root esbuild resolution through the web workspace dependency to create the transitional domain-service runtime bundle.

The last dependency is an implementation bridge, not the target backend module architecture.

## Worker And Product Runner

`apps/worker` and `apps/playwright-runner` currently use TypeScript and Node built-ins only. Their source exports runtime descriptors; neither workspace contains an active processing/execution loop yet.

## Shared Packages

- `@utms/contracts`, `@utms/config` and `@utms/test-support` have no production package dependencies.
- `@utms/shared` exports framework-independent helpers and a Prisma client module that resolves the root Prisma/PostgreSQL dependencies.

## External Runtime Images

- PostgreSQL `16-alpine`.
- Redis `7-alpine`.
- Node `22-alpine` for application images.
- Playwright `v1.55.0-noble` in the test stack.
- k6 `0.54.0` for the performance harness.

## Maintenance Notes

- `package.json` version ranges and `package-lock.json` are authoritative; avoid copying installed versions into operational commands.
- Run `npm audit` and review Docker base images as part of release security work; this document does not claim a zero-vulnerability audit.
- Keep Prisma CLI and client on compatible versions.
- Avoid adding production dependencies to the root unless they are genuinely shared by runtime workspaces.
- The API Console file store and local secret vault are architectural concerns, not missing npm dependencies; production replacements require persistence and secret-management adapters.
