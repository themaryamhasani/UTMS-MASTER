# UTMS System QA Fix Plan

> Historical frontend/mock fix record. Use [System QA Test Plan](../testing/SYSTEM_QA_TEST_PLAN.md) and [Current Implementation](../architecture/CURRENT_IMPLEMENTATION.md) for current scope.

This document reflects the current frontend/mock implementation after phases 14-17.

## Fixes Applied

### Authentication And Access

1. Login validation uses inline Persian errors for phone and password.
2. `App.tsx` checks cartable access before rendering pages.
3. Logout confirmation is an internal modal in `App.tsx`.
4. QA Specialist automated-test access is controlled per role assignment through `automatedTestsEnabled`.

### Forms And Validation

1. Test Request title rejects a leading whitespace character and backtick.
2. Version inputs are sanitized to SemVer-compatible ASCII characters and validated with the shared SemVer regex.
3. Build number inputs reject non-ASCII characters, including Persian letters.
4. Description fields use the 700-character shared limit where the related form has been updated.
5. Requirement creation requires at least one Flow, and activation is blocked when no Flow exists.
6. Test Case forms require Requirement and Flow; Test Request selection is not exposed.

### Workflow UX

1. Flow deletion in Requirement Detail uses internal `ConfirmModal`; browser `confirm()` is removed.
2. Test Request acceptance by QA Lead opens assignment selection, and assigned tester can be edited later.
3. Test Run and Bug edits support the pre-release-lock workflow.
4. Developer Board adds a Trello-like workflow with "باگ نیست" and "بدون نیاز به اقدام".
5. VersionHistory uses one Primary Test Request in publish UX and hides old Related Request selection.
6. Risk acceptance is checklist-driven.

### Tables

1. Shared `Table` includes quick filter.
2. Shared `Table` includes Column Chooser.
3. Shared `Table` includes Excel-compatible export.
4. Shared pagination supports 10, 30, 70 and 100 rows.
5. Primary table pages pass `onLimitChange`; Applications page has local pagination.

### Reports

1. Reports page includes 20 report cards.
2. Test Requests report uses dedicated `getTestRequestReport`.
3. Reports page includes shared filters: date range, status and person/text.
4. Reports page supports JSON, Excel-compatible CSV and frontend/mock PDF export.
5. Reports page has frontend/mock Scheduled Report and Alert modals.

### Playwright

1. `/playwright-files` lists discovered and UTMS-managed Playwright files.
2. Users with automated-test permission can create and edit managed Playwright files.
3. New Playwright runs include browser/project, headed, workers, retries, max failures, trace and reporter.
4. The mock runner generates HTML, JSON or JUnit XML report artifacts.

## Verification

- `npm run build` completed successfully.
- `rg "confirm\\(|alert\\(|beforeunload" src` returns no matches.

## Backend Follow-Up

1. Real Playwright Runner/CI execution.
2. Real CDE/FAVA adapters.
3. Server-side PDF rendering.
4. Scheduled Report and Alert execution.
5. Audit Export backend.
