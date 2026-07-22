# UTMS Reports Test Plan

Source-verified: 2026-07-22

This plan matches `apps/web/src/pages/ReportsPage.tsx` and `apps/web/src/services/reportsApi.ts`. In backend mode the read models execute through `reportsApi` on domain RPC, using transitional domain state rather than PostgreSQL report repositories.

## Report Access Tests

| # | Role/context | Expected |
|---|---|---|
| 1 | SYSTEM_ADMIN | All 20 report cards are visible. |
| 2 | QA_LEAD | QA, quality, VersionHistory, Playwright, Traceability and operational reports are visible. |
| 3 | TECH_LEAD | Quality, developer, VersionHistory, Playwright, Traceability and decision reports are visible. |
| 4 | PRODUCT_OWNER | Management, product quality, VersionHistory, comments and Traceability reports are visible. |
| 5 | DEVELOPER | Developer-scoped request/bug/release-change reports are visible. |
| 6 | QA_SPECIALIST | Test case/run/bug/Playwright reports are visible according to role scope. |
| 7 | BA | Requirement and Flow reports are visible. |
| 8 | SECURITY_REVIEWER | Checklist and allowed version-change visibility are available. |

## Data Tests

| # | Report | Expected |
|---|---|---|
| 1 | System Overview | Counts match the seeded/transitional domain state for requests, test cases, runs, bugs, VersionHistory, Playwright, attachments and audit. |
| 2 | Quality Health | Pass/fail/blocked/reopen/coverage/playwright rates are calculated. |
| 3 | Test Requests | Dedicated request report shows status, priority, requester, assignee, version/build, age and linked quality evidence. |
| 4 | Requirements | Requirements without Flow/Test Case are highlighted. |
| 5 | Flow Coverage | Flows with and without Test Case coverage are listed. |
| 6 | Test Cases | QA ownership, readiness and automation candidate data are shown. |
| 7 | Test Runs | Run status and result details are shown. |
| 8 | Open Bugs | Closed/rejected/no-action bugs are excluded from the open list. |
| 9 | Developer Performance | Per-developer request and bug metrics are calculated. |
| 10 | VersionHistory | Decision summary and change history are shown. |
| 11 | Traceability | Requirement to Flow/Test Case/Run/Bug/Test Request/VersionHistory path is shown. |
| 12 | Playwright | Status, duration and test result counts are shown. |

## Export And Filter Tests

| # | Test | Expected |
|---|---|---|
| 1 | Common filters | Date, status and person/text filters affect report table rows. |
| 2 | Table toolbar | Quick filter, Column Chooser and Excel export are visible on shared tables. |
| 3 | JSON export | JSON file downloads. |
| 4 | Excel export | Excel-compatible CSV downloads for filtered primary rows. |
| 5 | PDF export | Frontend/mock PDF artifact downloads. |
| 6 | Schedule modal | User can define frequency and recipient; mock success toast appears. |
| 7 | Alert modal | User can define metric, threshold and recipient; mock success toast appears. |

## Known Backend Follow-Up

1. Data comes from transitional domain state through backend RPC (or browser state in mock mode); production should use PostgreSQL read models.
2. PDF, Scheduled Report and Alert are frontend/mock only; production execution is backend work.
3. Direct deep-link navigation to every entity row remains a backend/router integration follow-up.
