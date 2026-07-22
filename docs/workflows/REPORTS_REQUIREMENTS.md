# UTMS Reports Requirements

Source-verified: 2026-07-22

The current frontend implements 20 report cards across Management, Operational, Performance and System categories. Report calculations execute through `reportsApi` over domain RPC in backend mode, using the transitional domain state rather than PostgreSQL report read models.

## Implemented Reports

All report cards support role-based visibility, application scope where available, shared table filtering/column chooser/export, and Reports-page JSON/Excel/PDF mock export.

| # | Report key | Title | Primary purpose |
|---|---|---|---|
| 1 | `overview` | داشبورد کلان سامانه | System-wide health and open request list. |
| 2 | `quality-health` | سلامت کیفیت سامانه | Pass/fail/blocked, bug risk, coverage and Playwright rate. |
| 3 | `product-quality` | نمای مدیریتی کیفیت محصول | Product-owner summary and risky applications. |
| 4 | `test-requests` | گزارش درخواست‌های تست | Dedicated request status, owner, version/build, age and linked quality evidence. |
| 5 | `requirements` | گزارش نیازمندی‌ها | Requirement status and gaps. |
| 6 | `flow-coverage` | گزارش پوشش Flow | Flow-to-Test-Case coverage. |
| 7 | `traceability` | گزارش Traceability | Requirement to Flow, Test Case, Run, Bug, Request and VersionHistory path. |
| 8 | `test-cases` | گزارش تست کیس‌ها | Test case readiness, risk and automation candidates. |
| 9 | `test-runs` | گزارش اجرای تست | Test execution pass/fail/blocked detail. |
| 10 | `open-bugs` | گزارش باگ‌های باز | Open bug list with severity, priority, developer and status. |
| 11 | `developer-performance` | عملکرد Developer | Developer request and bug quality metrics. |
| 12 | `developer-bugfix` | عملکرد اصلاح باگ | Developer bug-fix quality and reopen metrics. |
| 13 | `checklists` | گزارش چک‌لیست امنیت | Security checklist progress. |
| 14 | `releases` | گزارش VersionHistory | Decision summary plus version change history. |
| 15 | `emergency` | گزارش Tag اضطراری | Emergency VersionHistory risk and reason analysis. |
| 16 | `playwright` | گزارش Playwright | Automated run status, duration and result counts. |
| 17 | `attachments` | گزارش پیوست‌ها | File count, type, size and status. |
| 18 | `users-roles` | گزارش کاربران و نقش‌ها | User status and role assignments. |
| 19 | `audit` | گزارش Audit Trail | Sensitive operation history. |
| 20 | `comments` | گزارش کامنت‌ها | Product/VersionHistory comments. |

## Current Functional Coverage

1. Reports can be filtered by selected Application scope.
2. Reports have shared date range, status and person/text filters.
3. Role-based report card visibility is implemented in the frontend.
4. Traceability report exists for management roles.
5. VersionHistory report includes change history rows.
6. Test Requests report has its own read model and no longer reuses Developer Performance data.
7. Reports page export downloads JSON, Excel-compatible CSV and frontend/mock PDF.
8. Reports page has mock Scheduled Report and Alert modals.

## Backend Follow-Up

1. Production-grade server-side PDF rendering.
2. Backend execution of Scheduled Report.
3. Backend execution and delivery of Alert rules.
4. Backend Audit Export.
5. Direct deep-link navigation from every statistic/table row to the underlying cartable/entity.
