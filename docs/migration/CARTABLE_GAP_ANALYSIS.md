# UTMS Cartable Gap Analysis

This document is synced with the current frontend/mock source. The frontend is considered final for the mock phase; production persistence, workers, storage, and external adapters remain backend responsibilities.

## Route and Cartable Inventory

| ID | Route | Page | Access Boundary | Frontend/Mock Status |
|---|---|---|---|---|
| C01 | `dashboard` | `DashboardPage` | All authenticated roles with active context | Complete |
| C02 | `test-requests` | `TestRequestsPage` | Developer, QA Lead, QA Specialist, BA, Tech Lead, Product Owner | Complete |
| C03 | `requirements` | `RequirementsPage` | BA, QA Lead, QA Specialist, Product Owner, Developer, Tech Lead | Complete |
| C04 | `test-cases` | `TestCasesPage` | QA Lead, QA Specialist, Developer, Tech Lead | Complete |
| C05 | `test-runs-bugs` | `TestRunsBugsPage` | QA Lead, QA Specialist, Developer, Tech Lead | Complete |
| C06 | `developer-board` | `DeveloperBoardPage` | Developer only | Complete |
| C07 | `run-issues` | `RunIssuesPage` | QA Lead, QA Specialist | Complete |
| C08 | `checklists` | `ChecklistsPage` | Security Reviewer, QA Lead, Tech Lead | Complete |
| C09 | `playwright` | `PlaywrightPage` | QA Lead and QA Specialist with automated-test permission | Complete |
| C10 | `playwright-files` | `PlaywrightFilesPage` | QA Lead and QA Specialist with automated-test permission | Complete |
| C11 | `releases` | `ReleasesPage` | QA Lead, Tech Lead, Product Owner, Developer | Complete |
| C12 | `reports` | `ReportsPage` | Dashboard/report-capable roles in scope | Complete |
| C13 | `users` | `UsersPage` | System Admin | Complete |
| C14 | `applications` | `ApplicationsPage` | System Admin | Complete |
| C15 | `checklist-admin` | `ChecklistAdminPage` | System Admin | Complete |
| C16 | `admin-operations` | `AdminOperationsPage` | System Admin | Complete |
| C17 | `audit` | `AuditPage` | System Admin | Complete |
| C18 | `settings` | `SettingsPage` | System Admin | Complete |

## Current Cross-Cutting Behavior

- Access is enforced by `canAccessCartable` in `src/stores/authStore.ts`.
- QA Specialist automated-test access is controlled by the assignment-level `automatedTestsEnabled` flag.
- Playwright and Playwright Files are hidden when automated-test permission is disabled for that active context.
- The application back-office stores CDE roots for Front, Back NodeJS/DataService, and Gateway.
- Playwright file discovery combines CDE-discovered files with UTMS-managed test files.
- Playwright run creation supports Browser/Project, headed mode, workers, retries, max failures, trace, and reporter.
- Playwright report preview/download supports HTML, JSON, and JUnit/XML in the mock runner.
- Shared tables provide quick filter, column chooser, pagination, and Excel-compatible export.
- Reports include traceability, version changes, test requests, quality health, Playwright, audit, users/roles, attachments, and comments.
- Confirmations use internal modals instead of browser `confirm()`/`alert()`.

## Known Production Boundaries

The following items are intentionally outside the frontend/mock finalization scope:

1. Real NestJS/NodeJS backend and database persistence.
2. Real Playwright runner/CI worker.
3. Real CDE/Fava adapter calls and credential resolution.
4. Object storage for uploaded files and runner artifacts.
5. Server-side PDF/report generation.
6. Durable scheduled reports and alert delivery.
7. Transactional publish/lock/audit/outbox enforcement.

## Final Assessment

No remaining frontend cartable gap is currently documented. The remaining work is backend, worker, integration, storage, and production security hardening.
