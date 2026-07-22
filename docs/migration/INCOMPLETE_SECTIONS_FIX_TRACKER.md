# Frontend Completion Tracker

> Historical phase tracker. “Complete” refers to its frontend/mock scope, not production PostgreSQL, worker or external-integration completeness. See [Current Implementation](../architecture/CURRENT_IMPLEMENTATION.md).

This tracker reflects the state after frontend phases 14-17.

## Completed Items

| Area | Status | Evidence |
|---|---|---|
| Browser confirm removal | Complete | `rg "confirm\\(|alert\\(|beforeunload" src` returns no matches. |
| Test Requests report read model | Complete | `reportsApi.getTestRequestReport()` and `ReportsPage` `test-requests` case. |
| Shared Column Chooser | Complete | `src/components/ui/Table.tsx` has `enableColumnChooser`. |
| Shared table quick filter | Complete | `src/components/ui/Table.tsx` has `enableClientFilter`. |
| Shared Excel/CSV export | Complete | `src/components/ui/Table.tsx` has built-in export and `exportToExcel`. |
| Pagination page sizes | Complete | Shared pagination offers 10, 30, 70 and 100; primary table pages pass `onLimitChange`. |
| Reports JSON export | Complete | `ReportsPage` has JSON export. |
| Reports Excel export | Complete | `ReportsPage` exports the filtered primary rows to Excel-compatible CSV. |
| Reports PDF mock export | Complete | `ReportsPage` downloads a frontend mock PDF artifact. |
| Scheduled Report UI | Complete | `ReportsPage` has a mock schedule modal. |
| Alert UI | Complete | `ReportsPage` has a mock alert modal. |

## Backend/Worker Follow-Up

| Item | Owner phase |
|---|---|
| Real PDF rendering | Backend reporting/export service |
| Real Scheduled Report execution | Backend scheduler/notification worker |
| Real Alert evaluation and delivery | Backend alert/notification worker |
| Real Audit Export | Backend audit/export service |
| Real CDE adapter | Backend integration worker |
| Real Playwright Runner | Backend/CI runner worker |

## Verification

- `npm run build` completed successfully after the frontend changes.
- `git diff --check -- docs` should be run after documentation-only edits.
