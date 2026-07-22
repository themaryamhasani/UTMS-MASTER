# UTMS Reports Implementation Tracker

> Historical frontend delivery tracker. Reports now execute through domain RPC in backend mode, but still use transitional state rather than PostgreSQL read models. See [Reports API](../api/REPORTS_API.md).

This tracker is synced with the current frontend/mock implementation after phases 14-17.

## Current Status

| Area | Status | Source |
|---|---|---|
| Reports cartable | Implemented | `src/pages/ReportsPage.tsx` |
| Report read models | Implemented in mock API | `src/services/reportsApi.ts` |
| Test Requests report | Implemented with dedicated read model | `reportsApi.getTestRequestReport` |
| Shared table filter | Implemented | `src/components/ui/Table.tsx` |
| Column chooser | Implemented | `src/components/ui/Table.tsx` |
| Excel/CSV export | Implemented for shared tables | `exportToExcel` |
| Reports JSON export | Implemented as frontend/mock download | `ReportsPage` |
| Reports Excel export | Implemented as frontend/mock download | `ReportsPage` |
| Reports PDF export | Implemented as frontend/mock blob | `ReportsPage` |
| Report scheduling UI | Implemented as mock UI | `ReportsPage` |
| Report alert UI | Implemented as mock UI | `ReportsPage` |
| Date/status/person filters | Implemented for report detail tables | `ReportsPage` |

## Available Report Cards

The reports page currently exposes these report keys and mock read models:

- `overview`
- `quality-health`
- `product-quality`
- `test-requests`
- `requirements`
- `flow-coverage`
- `traceability`
- `test-cases`
- `test-runs`
- `open-bugs`
- `developer-performance`
- `developer-bugfix`
- `checklists`
- `releases`
- `emergency`
- `playwright`
- `attachments`
- `users-roles`
- `audit`
- `comments`

## Implementation Notes

- The `test-requests` report no longer reuses developer performance data; it uses a dedicated read model.
- Shared tables provide quick client filtering, column visibility control, and export from visible/filtered rows.
- Pagination has been normalized to 10, 30, 70, and 100 where the page uses the shared pagination component.
- Browser `confirm()`, `alert()`, and `beforeunload` are not used in `src`; sensitive confirmations use internal modals.
- Report scheduling and alert definition are frontend/mock only and are documented as backend follow-up work.

## Backend Follow-Ups

These are not frontend gaps. They belong to the backend/worker phase:

1. Server-side PDF generation.
2. Durable scheduled report jobs.
3. Durable alert rules and delivery workers.
4. Audit export from backend query/read model.
5. Production read models/materialized views for heavy reports.
6. Role/scope enforcement on the backend for every report endpoint.

## Verification

- `npm run build` passes.
- `git diff --check -- src docs` has no whitespace errors; only line-ending warnings may appear on Windows.
