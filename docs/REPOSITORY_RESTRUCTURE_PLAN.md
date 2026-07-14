# Repository Restructure Plan

## Current Folder Inventory

| Path | Current responsibility | Target responsibility |
| --- | --- | --- |
| `src/` | Vite React frontend source, UI primitives, layout, pages, stores, frontend services, in-memory seed data, domain types. | `apps/web/src/` with frontend-only code. Shared contracts are extracted to `packages/contracts` over time. |
| `server/` | CommonJS API Console backend, DOCX template, file-backed runtime store directory. | Runtime entry under `apps/api`; API Console implementation under `apps/api/src/modules/api-console`; runtime data under `runtime/`. |
| `docs/` | Mixed diagrams, requirements, reports, trackers, phase notes, API notes, and test plans. | Categorized documentation under `docs/architecture`, `docs/api`, `docs/workflows`, `docs/testing`, `docs/security`, and `docs/migration`. |
| `dist/` | Generated Vite build output. | Removed from root; generated output belongs under app build output and is ignored. |
| `logs/` | Runtime/generated log output. | Removed from root; runtime logs belong under ignored runtime/artifact locations. |
| `index.html` | Vite frontend entry. | `apps/web/index.html`. |
| `vite.config.ts` | Vite frontend config. | `apps/web/vite.config.ts`. |
| `tsconfig.json` | Frontend TypeScript config. | `apps/web/tsconfig.json`, extending root `tsconfig.base.json`. |
| `package.json` | Single-app scripts and all dependencies. | Root workspace scripts/tooling plus per-workspace package manifests. |
| `package-lock.json` | npm lockfile. | Root npm workspace lockfile. |
| `UTMS.rar` | Archive artifact in repository root. | `artifacts/archive/UTMS.rar` and ignored as generated/archive material. |

## Identified Structural Problems

- Frontend, backend-like server code, generated output, runtime logs, and archive artifacts live together at the repository root.
- The existing API Console server is a single large CommonJS file with routing, persistence, parsing, policy, execution, audit, and documentation generation in one implementation.
- The frontend service layer is an in-memory implementation in one very large file and imports seed data directly.
- Shared domain contracts are concentrated in frontend-owned type files instead of a repository-level contracts package.
- Documentation is not categorized by responsibility.
- Root scripts only cover Vite and the legacy API Console server.
- Runtime API Console persistence is file-backed and lives beside backend source.
- No executable architecture boundary check exists.

## Duplicated Responsibilities

- Role and workflow contract concepts exist in frontend type files and backend constants.
- API Console policy exists in frontend client code and backend server code.
- API Console request/response shapes are frontend-owned despite being shared API contracts.
- Runtime data and source code share the `server/` ownership boundary.

## Misplaced Files

- `server/api-console-server.cjs` belongs under an API module boundary.
- `server/templates/api-console-document-template.docx` belongs with the API Console module infrastructure.
- `server/data/.gitignore` belongs under ignored runtime storage.
- `src/data/mockData.ts` is production-imported seed data and should not remain in a mock-data folder.
- `dist/`, `logs/`, and `UTMS.rar` should not remain in the repository root.

## Target Locations By File Group

| File group | Target location |
| --- | --- |
| Frontend Vite app | `apps/web` |
| API runtime and API Console module | `apps/api` |
| Worker foundation | `apps/worker` |
| Playwright runner foundation | `apps/playwright-runner` |
| Shared public contracts | `packages/contracts` |
| Framework-independent utilities | `packages/shared` |
| Repository configuration package | `packages/config` |
| Shared test builders/fixtures/fakes | `packages/test-support` |
| Prisma schema, migrations, seeds | `database/prisma` |
| Docker and compose files | `infrastructure` |
| Permanent operational scripts | `scripts` |
| Cross-workspace tests | `tests` |
| Generated/runtime output | `artifacts` and `runtime` |

## Move Mapping

| Current Path | Target Path | Reason | Required Import Changes | Migration Risk | Verification Method |
| --- | --- | --- | --- | --- | --- |
| `src/` | `apps/web/src/` | Isolate frontend app. | Vite alias remains `@ -> apps/web/src`; relative imports continue to work. | Medium: build entry and tsconfig path changes. | `npm run build:web`, `npm run typecheck -w @utms/web`. |
| `index.html` | `apps/web/index.html` | Keep frontend entry in app workspace. | None. | Low. | Vite build. |
| `vite.config.ts` | `apps/web/vite.config.ts` | Keep Vite config app-owned. | Alias root recalculates from new directory. | Low. | Vite build. |
| `tsconfig.json` | `apps/web/tsconfig.json` | App-owned TypeScript config. | Extend root base config. | Medium: path inheritance. | Typecheck. |
| `package.json` | `apps/web/package.json` | Move frontend dependencies to frontend workspace. | Root scripts delegate to workspace scripts. | Medium: workspace lockfile update. | `npm install`, root script checks. |
| `server/api-console-server.cjs` | `apps/api/src/modules/api-console/infrastructure/http/api-console-server.cjs` | Move legacy API Console backend into bounded API module infrastructure. | Root and API scripts point to new entry. Default runtime data path changes to `runtime/api-console`. | Medium: `__dirname` defaults for data/template paths. | `npm run backend:self-check`, `npm run build:api`. |
| `server/templates/api-console-document-template.docx` | `apps/api/src/modules/api-console/infrastructure/templates/api-console-document-template.docx` | Template is API Console infrastructure asset. | Patch template default path. | Low. | API self-check DOCX case. |
| `server/data/.gitignore` | `runtime/api-console/.gitignore` | Runtime data is not source. | Patch data default path. | Low. | API self-check writes secrets/store in runtime. |
| `src/data/mockData.ts` | `apps/web/src/services/seedData.ts` | Remove production imports from a mock-data folder while preserving local in-memory behavior. | Update imports from `../data/mockData` to `../services/seedData` or `./seedData`. | Medium: many frontend references. | Typecheck and build. |
| `docs/*.png` | `docs/architecture/diagrams/` | Architecture diagrams belong under architecture docs. | Update docs index. | Low. | `docs/INDEX.md` links. |
| `docs/*TEST_PLAN*.md`, checklist audits | `docs/testing/` | Test documentation ownership. | Update docs index. | Low. | Docs index. |
| `docs/*API*.md`, API Console docs | `docs/api/` | API documentation ownership. | Update docs index. | Low. | Docs index. |
| `docs/*SECURITY*.md` | `docs/security/` | Security documentation ownership. | Update docs index. | Low. | Docs index. |
| `docs/*WORKFLOW*.md`, requirements/PRD | `docs/workflows/` | Product and workflow documentation ownership. | Update docs index. | Low. | Docs index. |
| `docs/*TRACKER*.md`, phase notes, gap reports, audits | `docs/migration/` | Migration/history documentation ownership. | Update docs index. | Low. | Docs index. |
| `UTMS.rar` | `artifacts/archive/UTMS.rar` | Archive artifact should not be root source. | None. | Low. | Root inventory and `.gitignore`. |

## Migration Sequence

1. Create target monorepo directories and this plan.
2. Move frontend files into `apps/web`.
3. Convert root `package.json` to npm workspaces and create app/package manifests.
4. Move API Console backend and its template into `apps/api`.
5. Redirect API runtime data to `runtime/api-console`.
6. Add worker and Playwright runner foundations.
7. Add shared packages, database, infrastructure, scripts, tests, and docs READMEs.
8. Categorize existing docs and add `docs/INDEX.md`.
9. Add architecture and root-cleanliness checks.
10. Remove generated root output and temporary folders.
11. Run verification commands and document remaining limitations.

## Backward Compatibility Risks

- Existing API Console data in `server/data` will not be used by the new default runtime path. The old path only contained a `.gitignore` in this snapshot.
- API Console default CORS and port behavior must remain unchanged.
- Vite dev proxy must continue targeting `http://localhost:4174`.
- Existing frontend routes must remain unchanged.

## Temporary Compatibility Layers

- `apps/api` retains the current API Console CommonJS implementation as a transitional infrastructure adapter while the module is decomposed into domain/application/presentation slices.
- `apps/web/src/services/api.ts` remains an in-memory frontend service to preserve current frontend behavior until real backend modules replace it.

## Files Deleted

- Generated root `dist/` and root `logs/` are deleted during cleanup.

## Files Archived

- `UTMS.rar` is moved to `artifacts/archive/UTMS.rar`.

## Files Moved

- Frontend app files move into `apps/web`.
- API Console server and DOCX template move into `apps/api`.
- Runtime API Console `.gitignore` moves into `runtime/api-console`.
- Existing docs are categorized under the appropriate `docs/*` subfolders.

## Files Split

- Root `package.json` is split into root workspace scripts and `apps/web/package.json`.
- Root `tsconfig.json` is split into `tsconfig.base.json` and `apps/web/tsconfig.json`.

## Files Merged

- No source files are merged in this migration. Existing large frontend and API Console files are tracked as legacy decomposition work.
