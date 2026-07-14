# Dependency Inventory

## Root Tooling

- `typescript` - repository-wide type checking.
- `@types/node` - Node.js typings for API, worker, runner, and scripts.

## Web App Dependencies

Production dependencies live in `apps/web/package.json`:

- React and React DOM.
- React Router.
- TanStack Query.
- Zustand.
- Lucide React.
- `date-fns` and `date-fns-jalali`.
- `uuid`.
- `clsx` and `tailwind-merge`.

Web-only development dependencies:

- Vite.
- React Vite plugin.
- Tailwind CSS Vite plugin.
- Tailwind CSS.
- Vite single-file plugin.
- React and Node typings.

## API App Dependencies

`apps/api` currently uses Node.js built-ins only. The API Console server remains a transitional CommonJS adapter.

## Worker And Runner Dependencies

`apps/worker` and `apps/playwright-runner` currently use TypeScript and Node.js built-ins only.

## Shared Package Dependencies

`packages/contracts`, `packages/shared`, `packages/config`, and `packages/test-support` currently have no production dependencies.

## Duplicate Libraries

No duplicate dependency versions were introduced by the migration. Existing web dependencies remain scoped to `apps/web`.

## Deprecated Libraries

No deprecated libraries were identified from the package manifests during this restructuring pass.

## Security Concerns

- API Console runtime persistence is still file-backed under `runtime/api-console`; this is isolated from source but must be replaced with database-backed repositories before production use.
- Secret values are not added to environment examples.

## Removed Dependencies

No dependency was removed. Dependencies were relocated from the root app manifest into `apps/web/package.json`.

## Newly Introduced Dependencies

No new production dependency was introduced. `@types/node` is declared at the root for workspace type checking.
