# UTMS Reports API Documentation

Current report APIs are implemented in `src/services/reportsApi.ts` and consumed by `src/pages/ReportsPage.tsx`.

The APIs are frontend/mock read models over in-memory data. Production should replace these with backend read models or query endpoints.

## API List

| # | UI key | Mock API | Returns |
|---|---|---|---|
| 1 | `overview` | `reportsApi.getSystemOverview(applicationId?)` | Request, test case, run, bug, VersionHistory, Playwright, attachment and audit summary plus open request list. |
| 2 | `quality-health` | `reportsApi.getQualityHealth(applicationId?)` | Pass/fail/blocked rates, critical bugs, reopen rate, requirement coverage and Playwright pass rate. |
| 3 | `product-quality` | `reportsApi.getProductQualityOverview()` | Product-level active requests, release readiness, pass rate and risky applications. |
| 4 | `test-requests` | `reportsApi.getTestRequestReport(applicationId?)` | Dedicated request status, owner, version/build, age, test-case/run/bug and VersionHistory summary. |
| 5 | `requirements` | `reportsApi.getRequirementReport(applicationId?)` | Requirement counts and coverage/gap details. |
| 6 | `flow-coverage` | `reportsApi.getFlowCoverage(applicationId?)` | Flow coverage totals and per-flow details. |
| 7 | `traceability` | `reportsApi.getTraceabilityReport(applicationId?)` | Requirement to Flow/Test Case/Run/Bug/Test Request/VersionHistory path. |
| 8 | `test-cases` | `reportsApi.getTestCaseReport(applicationId?)` | Test case readiness, risk and QA breakdown. |
| 9 | `test-runs` | `reportsApi.getTestRunReport(applicationId?)` | Run result totals and details. |
| 10 | `open-bugs` | `reportsApi.getOpenBugsList(applicationId?)` | Open bug list with severity, priority, developer and status. |
| 11 | `developer-performance` | `reportsApi.getDeveloperPerformance(applicationId?)` | Per-developer request and bug quality metrics. |
| 12 | `developer-bugfix` | `reportsApi.getDeveloperBugFixReport(applicationId?)` | Per-developer bug-fix metrics. |
| 13 | `checklists` | `reportsApi.getChecklistReport(applicationId?)` | Security checklist status and progress. |
| 14 | `releases` | `reportsApi.getReleaseReport(applicationId?)` | VersionHistory decision stats, details and change history. |
| 15 | `emergency` | `reportsApi.getEmergencyPublishReport(applicationId?)` | Emergency VersionHistory stats and risk details. |
| 16 | `playwright` | `reportsApi.getPlaywrightReport(applicationId?)` | Playwright run totals, pass rate, duration and details. |
| 17 | `attachments` | `reportsApi.getAttachmentReport()` | Attachment counts, size and file details. |
| 18 | `users-roles` | `reportsApi.getUsersRolesReport()` | User counts and role assignments. |
| 19 | `audit` | `reportsApi.getAuditReport(applicationId?)` | Audit totals by action and audit event details. |
| 20 | `comments` | `reportsApi.getCommentReport()` | VersionHistory/Product Owner comments. |

## Permission Rules

1. The Reports route is visible through dashboard access.
2. Each report card has its own `roles` list in `ReportsPage.tsx`.
3. Frontend visibility is role-based; production APIs must enforce the same role and application scope server-side.
4. Application scope is passed to report APIs where implemented.

## Frontend Export And Filters

1. Reports page supports JSON export for the loaded report.
2. Reports page supports Excel-compatible CSV export for the filtered primary report rows.
3. Reports page supports frontend/mock PDF export; production should replace this with server-side PDF rendering.
4. Reports page includes frontend/mock Scheduled Report and Alert modals.
5. Shared `Table` instances include quick filter, Column Chooser and Excel-compatible export.

## Backend Follow-Up

Production still needs server-side PDF rendering, real Scheduled Report execution, real Alert evaluation/delivery and backend Audit Export.
