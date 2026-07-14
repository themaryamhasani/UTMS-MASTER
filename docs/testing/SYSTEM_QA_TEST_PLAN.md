# UTMS System QA Test Plan

This manual test plan matches the current frontend/mock implementation after phases 14-17.

## 1. Authentication And Access

| # | Scenario | Steps | Expected result |
|---|---|---|---|
| 1.1 | Valid login | Enter a seeded phone number and password | Context selection is shown. |
| 1.2 | Invalid phone | Enter an invalid phone | Inline Persian validation appears. |
| 1.3 | Context selection | Select one available role/application context | Dashboard loads with scoped sidebar. |
| 1.4 | Logout | Click logout | Internal modal appears; confirming returns to login. |
| 1.5 | QA Specialist without automated tests | Select a QA Specialist assignment with automated tests disabled | Playwright and Playwright Files cartables are hidden. |

## 2. Form Validation

| # | Form | Field | Test | Expected |
|---|---|---|---|---|
| 2.1 | Test Request | Title | Leading space | Character is rejected/trimmed and inline error is shown. |
| 2.2 | Test Request | Title | Backtick | Character is rejected and inline error is shown. |
| 2.3 | Version fields | Version | Persian letters | Characters are not accepted; SemVer validation remains active. |
| 2.4 | Build fields | Build number | Persian letters | Characters are rejected. |
| 2.5 | Requirement | Flow | Create requirement with no Flow | Submit is blocked. |
| 2.6 | Requirement | Activation | Activate requirement with no Flow | Activation is blocked. |
| 2.7 | Test Case | Requirement/Flow | Save without Requirement or Flow | Inline validation is shown. |

## 3. Workflow Tests

| # | Workflow | Action | Expected |
|---|---|---|---|
| 3.1 | Requirement | Delete Flow | Internal ConfirmModal appears; no browser confirm. |
| 3.2 | Test Request | QA Lead accepts | Assignment modal opens; selected tester is stored. |
| 3.3 | Test Run | Edit unlocked run | Run fields, attachments and linked bugs can be edited. |
| 3.4 | Bug | Developer selects "باگ نیست" or "بدون نیاز به اقدام" | Status changes with required reason. |
| 3.5 | VersionHistory | Create publish record | One Primary Test Request is selected; no Related Request UI. |

## 4. Table Tests

| # | Scenario | Expected |
|---|---|---|
| 4.1 | Open any table | Quick filter, Column Chooser and Excel export are visible. |
| 4.2 | Toggle column | Column hides/shows without losing data. |
| 4.3 | Quick filter | Visible rows are filtered. |
| 4.4 | Export table | Excel-compatible CSV downloads. |
| 4.5 | Pagination | Page size selector offers 10, 30, 70 and 100 where pagination is present. |

## 5. Reports Tests

| # | Scenario | Expected |
|---|---|---|
| 5.1 | Open Test Requests report | Dedicated request rows are shown, not Developer Performance rows. |
| 5.2 | Use common filters | Date/status/person-text filters affect report table rows. |
| 5.3 | Export JSON | JSON file downloads. |
| 5.4 | Export Excel | Excel-compatible CSV downloads. |
| 5.5 | Export PDF | Frontend/mock PDF artifact downloads. |
| 5.6 | Schedule report | Mock schedule modal accepts frequency and recipient. |
| 5.7 | Alert | Mock alert modal accepts metric, threshold and recipient. |

## 6. Playwright Tests

| # | Scenario | Expected |
|---|---|---|
| 6.1 | Open Playwright Files | Discovered and managed files are listed. |
| 6.2 | Create/edit managed file | Folder, file name, description and script are stored. |
| 6.3 | Start Playwright run | File select lists discovered and managed files. |
| 6.4 | Set runner options | Command preview/run metadata includes project, headed, workers, retries, max failures, trace and reporter. |
| 6.5 | View report | HTML/JSON/JUnit preview/download follows selected reporter. |

## 7. Verification Commands

| Command | Expected |
|---|---|
| `rg "confirm\\(|alert\\(|beforeunload" src` | No matches. |
| `npm run build` | Successful build. |

## Backend Follow-Up

1. Mock APIs are in-memory and do not verify database transaction guarantees.
2. PDF/Scheduled/Alert are frontend/mock; production execution is backend work.
3. Playwright and CDE real integrations require backend/worker implementation.
