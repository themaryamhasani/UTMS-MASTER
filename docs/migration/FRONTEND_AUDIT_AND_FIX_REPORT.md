# Frontend Audit and Fix Report

Date: 2026-07-13

> Historical snapshot: the command availability, repository paths, changed-file list and remaining-test gaps below describe the pre-monorepo audit on this date. They are not the current checkout status. Use the root `README.md`, `package.json`, [test coverage matrix](../testing/TEST_COVERAGE_MATRIX.md), [system Context update](SYSTEM_CONTEXT_AND_APPLICATION_SCOPE.md), and [theme/accessibility update](THEME_AND_ACCESSIBILITY.md) for the current implementation.

## 1. Executive summary

The UTMS frontend was audited across routing, RBAC surfaces, shared UI primitives, high-risk workflow pages, the mock API service layer, Reports, Release/VersionHistory, Playwright, and the Online API Console.

Major risks found:

- Direct navigation and refresh were not route-addressable because the app shell used local page state instead of browser routes.
- TypeScript did not pass because Vite client types and an API Console label type were missing.
- Several workflow pages swallowed failures through empty catches or browser console logging instead of user-visible error states.
- Shared UI primitives had production defects: buttons could submit forms accidentally, modals lacked practical dialog/focus behavior, icon buttons lacked accessible names, and tables used unstable fallback keys.
- Dynamic report/API-console data paths relied on `any` or unvalidated JSON shapes.
- npm audit initially reported 2 vulnerabilities: 1 high in Vite and 1 low in esbuild.

Major improvements completed:

- Added browser route support for all sidebar/admin/cartable pages with guarded routes and a 404 page.
- Restored clean TypeScript and production build validation.
- Removed executable `any`, `console.error`, `console.log`, empty catch blocks, `@ts-ignore`, `@ts-nocheck`, and broad lint suppressions from `src`.
- Hardened shared Button, Modal, Table, Toast, Header, and Sidebar behavior.
- Converted high-risk workflow forms and Reports/API Console dynamic render paths to domain unions, `unknown`, and typed boundary helpers.
- Upgraded Vite to 7.3.6 and esbuild to 0.28.1; final `npm audit` reports 0 vulnerabilities.

## 2. Baseline results

Package manager: npm, detected from `package-lock.json`.

Initial checks before fixes:

| Check | Result | Details |
| --- | --- | --- |
| `git status --short` | Clean | No pre-existing uncommitted source changes were present. |
| `npm.cmd install` | Passed | 106 packages audited; reported 2 vulnerabilities: 1 low, 1 high. |
| `npm.cmd run build` | Passed | Vite production build completed. |
| `npx.cmd tsc --noEmit` | Failed | `OnlineApiConsolePage.tsx` `FieldLabel` children type was too narrow; `apiConsoleApi.ts` needed Vite `import.meta.env` types. |
| `npm run typecheck` | Not available | No `typecheck` script exists in `package.json`; `npx.cmd tsc --noEmit` was used. |
| `npm run lint` | Not available | No `lint` script exists in `package.json`. |
| `npm test` | Not available | No `test` script exists in `package.json`. |
| `npm.cmd run backend:self-check` | Passed | 22 passed, 0 failed. |

Warning-pattern baseline included `any`, empty catches, console error logging, mock-data imports, timers, and random demo values. The executable prohibited patterns were addressed; remaining mock/timer/random usages are documented in Remaining issues.

## 3. Issues fixed

| ID | Severity | Area | Root cause | Files changed | Fix implemented | Validation |
| --- | --- | --- | --- | --- | --- | --- |
| CRIT-001 | Critical | TypeScript/build correctness | Missing Vite client env types and overly narrow `FieldLabel` children type blocked `tsc`. | `src/vite-env.d.ts`, `src/pages/OnlineApiConsolePage.tsx` | Added Vite client reference and allowed `FieldLabel` to render `React.ReactNode`. | `npx.cmd tsc --noEmit` passed. |
| CRIT-002 | Critical | Routing/navigation | App shell used local state only; direct URLs and refresh could not reliably resolve pages. | `src/App.tsx` | Added `BrowserRouter`, route map, guarded routes, URL navigation, route aliases, active sidebar sync, logout navigation, and 404 page. | `npm.cmd run build` and `npx.cmd tsc --noEmit` passed. |
| HIGH-001 | High | Error handling | Multiple pages hid failures through empty catches or console logging. | Dashboard, Audit, Bugs, Playwright, Releases, Run Issues, Test Cases, Test Requests, Test Runs, Test Runs/Bugs, Playwright Files | Replaced silent failures with state fallback and user-facing toast errors. Removed frontend `console.error` patterns. | `rg` scan has no executable `console.error`, `console.log`, empty catch, or debugger matches in `src`. |
| HIGH-002 | High | Form safety | Shared `Button` defaulted to native submit behavior when used inside forms/modals. | `src/components/ui/Button.tsx`, layout/page buttons | Defaulted buttons to `type="button"` unless explicitly provided. Added explicit button types to layout controls. | TypeScript/build passed; form-submit risk removed from shared component. |
| HIGH-003 | High | Modal accessibility/runtime behavior | Modals lacked dialog semantics, Escape handling, focus restore, and scroll locking. | `src/components/ui/Modal.tsx` | Added dialog role, `aria-modal`, `aria-labelledby`, Escape close, focus restore, body scroll lock, and close-button label/type. | TypeScript/build passed. |
| HIGH-004 | High | Type safety | Reports, mock API metadata, and workflow forms used `any` or unsafe casts. | `src/pages/ReportsPage.tsx`, `src/services/api.ts`, `src/types/index.ts`, workflow pages | Replaced with `unknown`, typed report rows/data boundary, typed audit/entity guards, typed checklist/security review results, and domain union form states. | `rg "\bany\b"` has no executable matches in `src`; `tsc` passed. |
| HIGH-005 | High | Dependency security | Vite 7.3.2/esbuild 0.27.x triggered npm audit advisories on Windows dev server paths. | `package.json`, `package-lock.json`, npm installed package tree | Upgraded Vite to 7.3.6 and pinned esbuild 0.28.1. | `npm.cmd audit --json` reports 0 vulnerabilities. |
| HIGH-006 | High | Online API Console | Parsed JSON snapshots and self-check response data rendered unknown object values directly. | `src/pages/OnlineApiConsolePage.tsx` | Converted JSON parsing to `unknown`, added `asRecord`/typed array use, typed parser self-check detail rows, and stringified unknown render values. | `tsc`, build, and `backend:self-check` passed. |
| MED-001 | Medium | Shared tables | Generic table type allowed `any`, exported unknown values loosely, and fell back to array-index keys too early. | `src/components/ui/Table.tsx` | Changed generic to `object`, added stable key selection from `id`/`key`/`code`, and centralized unknown value flattening. | TypeScript/build passed. |
| MED-002 | Medium | Accessible feedback | Header/sidebar/toast icon controls lacked stronger semantics and async feedback was not announced. | `src/components/layout/Header.tsx`, `src/components/layout/Sidebar.tsx`, `src/components/ui/Toast.tsx` | Added button types, aria labels/expanded states, and polite live-region status for toasts. | TypeScript/build passed. |
| MED-003 | Medium | Workflow form correctness | Several workflow pages used broad casts for priorities, statuses, purposes, and release decisions. | `LoginPage`, `TestRequestsPage`, `TestCasesPage`, `TestRunsBugsPage`, `ReleasesPage`, `ChecklistAdminPage` | Added form-state types and explicit domain union conversions at select/input boundaries. | TypeScript passed. |
| MED-004 | Medium | Admin operations | Audit metadata became `unknown`; metadata cells rendered raw unknown values. | `src/pages/AdminOperationsPage.tsx` | Converted correlation/idempotency metadata to strings before rendering. | TypeScript passed. |
| LOW-001 | Low | Code hygiene | Dead commented code and noisy warning comments created false-positive scans. | `BugsPage`, `PlaywrightPage`, `RequirementsPage` | Removed stale commented handler and reworded comments. | Warning scan clean for prohibited executable patterns. |

Fixed issue count by severity:

- Critical: 2
- High: 6
- Medium: 4
- Low: 1

## 4. Business-rule validation

| Rule | Result | Evidence / validation |
| --- | --- | --- |
| QA Specialist execution permissions | Passed | `canPerformAction` grants `test-run:create`, `test-run:execute`, `test-run:finalize`, `bug:create`, `bug:retest`, `run-issue:create`, `run-issue:resolve`, and `playwright:run` to `QA_SPECIALIST`. Automated test access also respects `canUseAutomatedTests` for QA Specialist contexts. |
| QA Lead inherited permissions | Passed | QA Lead is included alongside QA Specialist for test case, test run, bug, retest, run issue, Playwright, and shared cartables. UI pages consume the same helpers instead of duplicating role checks. |
| QA Lead-only Sign-off | Passed with policy nuance | VersionHistory quality review/sign-off uses `versionHistory:qaReview`, whose workflow policy owner is QA Lead. Final decision owner remains policy-driven: default policies can assign `versionHistory:decide` to Tech Lead or QA Lead depending application policy. The UI labels show the active owner from policy. |
| System Admin-only system management | Passed | `canAccessCartable` restricts users, applications, audit, and admin/settings surfaces to `SYSTEM_ADMIN`; admin actions remain System Admin-only in `canPerformAction`. |
| System Admin role assignment | Passed | Users/admin pages use `admin:create-user`, `admin:edit-user`, `admin:delete-user`, and `admin:manage-users`, all restricted to `SYSTEM_ADMIN`. |
| SemVer | Passed | `src/utils/semver.ts` centralizes `SEMVER_REGEX`; Test Requests, Test Runs, Test Runs/Bugs, Bugs fixed version, Developer Board, Releases, and service-layer validation use SemVer helpers. |
| Release workflow | Passed | Releases page uses workflow policy helpers for create, QA review, decision, risk accept, and comment actions; mock API also validates workflow capabilities server-side in the mock contract. |
| Cartable | Passed | Sidebar and app routes both use `canAccessCartable`; direct URL access now goes through `GuardedRoute` rather than relying on visible menu items only. |
| Online API Console | Passed | UI parsing/rendering is typed; backend self-check verifies Bash, Windows CMD caret escaping, PowerShell, data method inference, TLS, Core Query/Command detection, secret masking, scripts, DOCX generation, SSRF localhost protection, and masked cURL export: 22 passed, 0 failed. |

## 5. Tests executed

| Command | Result | Details |
| --- | --- | --- |
| `npm.cmd install` | Passed | Initial install completed; after dependency update, npm audited 106 packages. |
| `npx.cmd tsc --noEmit` | Passed | Final TypeScript check succeeded. |
| `npm.cmd run build` | Passed | Vite 7.3.6 built `dist/index.html`; single-file bundle output about 993.25 kB, gzip about 245.44 kB. |
| `npm.cmd run backend:self-check` | Passed | 22 passed, 0 failed. |
| `npm.cmd audit --json` | Passed | Final audit reports 0 vulnerabilities. |
| Warning scan | Passed for prohibited executable patterns | `rg` found no executable `any`, console logging/error, empty catch, debugger, ts-ignore, ts-nocheck, or eslint-disable in `src`. |
| `npm run lint` | Not executed | No `lint` script exists. |
| `npm test` | Not executed | No `test` script exists. |
| Browser smoke / Playwright route smoke | Not executed | No browser test runner or smoke script exists in the package. Adding one would be a new testing dependency and should be planned separately. |

## 6. Remaining issues

| Issue | Exact blocker | Risk | Recommended next action |
| --- | --- | --- | --- |
| No lint script | `package.json` does not define `lint` and no lint configuration was found in the available scripts. | Static style/accessibility regressions are harder to gate. | Add ESLint/TypeScript lint configuration and a CI `npm run lint` gate. |
| No automated frontend test script | `package.json` does not define `test`; no existing frontend unit/integration test stack is wired. | RBAC and workflow regressions rely on manual review plus TypeScript/build checks. | Add focused Vitest/React Testing Library tests for RBAC helpers, route guards, SemVer, and critical workflow actions. |
| No browser smoke runner | No Playwright/Cypress smoke script exists for app routes. | Direct-route and responsive behavior cannot be claimed as browser-tested. | Add Playwright smoke coverage for login, direct routes, role contexts, Online API Console, and logout. |
| Production backend boundary | The frontend still uses the repository mock service layer and Online API Console dev context header patterns documented in the project. | Production security cannot rely on frontend-only RBAC or mock persistence. | Connect the service layer to production APIs with backend-enforced auth/RBAC, 401/403 normalization, and server-side Online API Console context validation. |
| Repository hygiene | The repository tracks `node_modules` and `dist`, and has no `.gitignore`. Dependency/security updates therefore modify tracked installed package files. | Large noisy diffs and platform-specific installed artifacts can obscure review. | Decide whether vendored dependencies/build artifacts are intentional; if not, add `.gitignore` and remove tracked generated files in a dedicated cleanup change. |
| Mock/demo timing and random values | Mock API uses simulated delays/timers and demo random file sizes/password generation. | Appropriate for local mock behavior, but not production persistence/security. | Keep behind dev/mock boundary when real backend integration is introduced. |

## 7. Changed file summary

Architecture:

- `src/App.tsx`
- `src/vite-env.d.ts`
- `package.json`
- `package-lock.json`
- `dist/index.html`

Components:

- `src/components/layout/Header.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/components/ui/Button.tsx`
- `src/components/ui/Modal.tsx`
- `src/components/ui/Table.tsx`
- `src/components/ui/Toast.tsx`

Pages:

- `src/pages/AdminOperationsPage.tsx`
- `src/pages/AuditPage.tsx`
- `src/pages/BugsPage.tsx`
- `src/pages/ChecklistAdminPage.tsx`
- `src/pages/DashboardPage.tsx`
- `src/pages/LoginPage.tsx`
- `src/pages/OnlineApiConsolePage.tsx`
- `src/pages/PlaywrightFilesPage.tsx`
- `src/pages/PlaywrightPage.tsx`
- `src/pages/ReleasesPage.tsx`
- `src/pages/ReportsPage.tsx`
- `src/pages/RequirementsPage.tsx`
- `src/pages/RunIssuesPage.tsx`
- `src/pages/TestCasesPage.tsx`
- `src/pages/TestRequestsPage.tsx`
- `src/pages/TestRunsBugsPage.tsx`
- `src/pages/TestRunsPage.tsx`

Services:

- `src/services/api.ts`

State management:

- No store implementation was changed; existing `authStore` permission helpers were validated and reused from route guards/pages.

Styles:

- No global style files were changed.

Tests:

- No test files were added because no frontend test runner is currently configured.

Documentation:

- `docs/FRONTEND_AUDIT_AND_FIX_REPORT.md`

