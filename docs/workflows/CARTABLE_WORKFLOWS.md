# UTMS - Cartable Workflows

> Scope update 2026-08-10: CDE and both Playwright workflows are extracted to [Playwright Studio](https://github.com/themaryamhasani/playwright-studio). Their sections below are retained only as pre-extraction history.

Source-verified: 2026-07-26

## Overview
This document describes all workflow actions and state transitions for each Cartable in the UTMS system.

The executable implementation is defined in `apps/web/src/services/api.ts`
and exposed to the browser through `POST /api/domain/rpc` in backend mode.
Test requests, requirements, flows and test cases are synchronized with
PostgreSQL by `postgres-test-management-state.cjs`. Other services in this
document still use transitional file/runtime state. Resource-style REST
endpoints, where mentioned, remain target public contracts.

Application-scope invariants apply to every transition: independent roots require an explicit Application in APP/multi-system Contexts; Test Case derives it from Requirement, Test Run from Test Request, Bug/Run Issue from Test Run, and cross-system links are rejected.

---

## 1. Test Request Workflow

### Actors
- **DEVELOPER**: Creates and submits test requests
- **QA_LEAD**: Reviews, accepts/rejects, and assigns requests

### State Transition Table
| Current State | Action | Actor | Next State | Side Effects |
|---------------|--------|-------|------------|--------------|
| - | CREATE | DEVELOPER | DRAFT | Audit Log |
| DRAFT | SUBMIT | DEVELOPER | SUBMITTED | Notify QA Lead |
| SUBMITTED | REVIEW | QA_LEAD | UNDER_REVIEW | - |
| UNDER_REVIEW | ACCEPT | QA_LEAD | ACCEPTED | Audit Log |
| UNDER_REVIEW | REJECT | QA_LEAD | REJECTED | Notify Developer |
| ACCEPTED | ASSIGN | QA_LEAD | IN_PROGRESS | Notify Assignee |
| IN_PROGRESS | SET_QUALITY: RETEST_REQUIRED | QA_LEAD | IN_PROGRESS | Reason required; notify Assignee |
| RETEST_REQUIRED | FINALIZE_NEW_RUN | QA_SPECIALIST | IN_PROGRESS | Return to QA review; notify QA Lead |
| IN_PROGRESS | RELEASE_APPROVED/CONDITIONAL | Decision owner | COMPLETED | Reflect release decision and write audit |
| Any (except COMPLETED) | CANCEL | DEVELOPER/QA_LEAD | CANCELLED | - |

### Request Types

- `INITIAL`
- `RETEST_REGRESSION`
- `SMOKE`
- `UAT`
- `EXPLORATORY`

The UI translates these stored values. Assignment writes the assignee identity
to the audit/history record and creates an in-app notification for the QA
specialist.

### QA Quality Review

- QA Lead may provide a missing build number before recording quality.
- User-selectable outcomes are `READY`, `CONDITIONAL`, `NOT_READY` and
  `RETEST_REQUIRED`.
- `RETEST_REQUIRED` requires a reason, clears any previous security selection,
  keeps the request in progress and informs the assigned QA specialist.
- The retest reason is visible in the specialist cartable.
- A newly finalized run must increase the final-run count recorded at the
  retest request. It then changes the QA quality state to `IN_PROGRESS`,
  removes the card from the retest-required list and notifies QA Lead.

### Workflow Files
- **Frontend**: `apps/web/src/pages/TestRequestsPage.tsx`
- **Domain service**: `apps/web/src/services/api.ts` - `testRequestApi` (RPC-backed in backend mode)
- **Types**: `apps/web/src/types/index.ts` - `TestRequest`, `TestRequestStatus`

---

## 2. Requirement Workflow

### Actors
- **BA**: Creates and completes requirements
- **QA_LEAD**: Reviews and approves requirements

### State Transition Table
| Current State | Action | Actor | Next State |
|---------------|--------|-------|------------|
| - | CREATE | BA/QA_LEAD | DRAFT |
| DRAFT | UPDATE | BA/QA_LEAD | IN_PROGRESS |
| IN_PROGRESS | COMPLETE | BA/QA_LEAD | COMPLETED |
| COMPLETED | APPROVE | QA_LEAD | APPROVED |

### Flow Management
- Flows are linked to requirements
- BA can create multiple flows per requirement
- Flows track user journeys and scenarios

### Workflow Files
- **Frontend**: `apps/web/src/pages/RequirementsPage.tsx`
- **Domain service**: `apps/web/src/services/api.ts` - `requirementApi`, `flowApi` (RPC-backed in backend mode)

---

## 3. Test Case Workflow

### Actors
- **QA_LEAD**: Creates and manages test cases
- **QA_SPECIALIST**: Creates and edits test cases

### State Transition Table
| Current State | Action | Actor | Next State |
|---------------|--------|-------|------------|
| - | CREATE | QA | DRAFT |
| DRAFT | COMPLETE | QA | READY |
| READY | DEPRECATE | QA | OBSOLETE |

### Required Fields (MVP)
- Title, Scenario, Preconditions, Test Data
- Steps, Expected Result, Test Type
- Test Design Technique, Priority, Risk Level
- Quality Attribute, Automation/Regression Candidate

### Workflow Files
- **Frontend**: `apps/web/src/pages/TestCasesPage.tsx`
- **Domain service**: `apps/web/src/services/api.ts` - `testCaseApi` (RPC-backed in backend mode)

---

## 4. Test Run Workflow

### Actors
- **QA_LEAD**: Executes tests, creates bugs
- **QA_SPECIALIST**: Executes tests, creates bugs

### State Transition Table
| Current State | Action | Actor | Next State | Side Effects |
|---------------|--------|-------|------------|--------------|
| - | CREATE | QA | PENDING | Auto-fill version |
| PENDING | START | QA | IN_PROGRESS | - |
| IN_PROGRESS | PASS | QA | PASSED | - |
| IN_PROGRESS | FAIL | QA | FAILED | Bug required |
| IN_PROGRESS | BLOCK | QA | BLOCKED | Run Issue required |
| IN_PROGRESS | SKIP | QA | SKIPPED | Reason required |
| Any Final | FINALIZE | QA | (locked) | - |

### Bug Creation Wizard
1. Test marked as FAILED
2. System shows bug form
3. Required: Title, Description, Steps, Severity
4. Bug linked to test run

### Run Issue Creation
1. Test marked as BLOCKED
2. System shows issue form
3. Select type: Environment/Access/Data/Dependency
4. Issue linked to test run

### Application Cascade

1. Select a Test Request.
2. Resolve its Application and load only completed/approved Requirements from that Application.
3. Select a Requirement and load only ready Test Cases linked to that Requirement.
4. Limit previous Runs, created Bugs and Run Issues to the same Test Request Application.

### Workflow Files
- **Frontend**: `apps/web/src/pages/TestRunsBugsPage.tsx`
- **Route**: `/test-runs-bugs`; `/test-runs` is a compatibility redirect
- **Domain service**: `apps/web/src/services/api.ts` - `testRunApi` (RPC-backed in backend mode)

---

## 5. Bug Workflow

### Actors
- **QA**: Creates bugs from failed tests
- **QA_LEAD**: Assigns bugs
- **DEVELOPER**: Fixes bugs
- **QA**: Retests bugs

### State Transition Table
| Current State | Action | Actor | Next State |
|---------------|--------|-------|------------|
| - | CREATE | QA | NEW |
| NEW | ASSIGN | QA_LEAD | ASSIGNED |
| ASSIGNED | START_FIX | DEVELOPER | IN_PROGRESS |
| IN_PROGRESS | FIX | DEVELOPER | FIXED |
| FIXED | READY_RETEST | DEVELOPER | RETEST_READY |
| RETEST_READY | RETEST_PASS | QA | RETEST_PASSED |
| RETEST_READY | RETEST_FAIL | QA | RETEST_FAILED |
| RETEST_PASSED | CLOSE | QA_LEAD | CLOSED |

### Constraints
- Bug must be linked to failed test run
- Developer can only update own bugs
- Developer cannot change severity/priority

### Workflow Files
- **Frontend**: `apps/web/src/pages/BugsPage.tsx`
- **Domain service**: `apps/web/src/services/api.ts` - `bugApi` (RPC-backed in backend mode)

---

## 6. Run Issue Workflow

### Actors
- **QA_LEAD/QA_SPECIALIST**: Reports and resolves issues

### State Transition Table
| Current State | Action | Actor | Next State |
|---------------|--------|-------|------------|
| - | CREATE | QA | OPEN |
| OPEN | START | QA | IN_PROGRESS |
| IN_PROGRESS | RESOLVE | QA | RESOLVED |
| RESOLVED | CLOSE | QA | CLOSED |

### Issue Types
- ENVIRONMENT: Server/infrastructure issues
- ACCESS: Permission/authentication issues
- DATA: Test data problems
- DEPENDENCY: External service issues

### Workflow Files
- **Frontend**: `apps/web/src/pages/RunIssuesPage.tsx`
- **Domain service**: `apps/web/src/services/api.ts` - `runIssueApi` (RPC-backed in backend mode)

---

## 7. Security Review Workflow

### Actors
- **SECURITY_REVIEWER**: Completes the request-scoped security checklist
- **QA_LEAD/TECH_LEAD**: Views results

### State Transition Table
| Current State | Action | Actor | Next State |
|---------------|--------|-------|------------|
| QA quality READY/CONDITIONAL | REQUIRE_SECURITY | QA_LEAD | PENDING |
| PENDING | START | Reviewer | IN_PROGRESS |
| IN_PROGRESS | REVIEW_ITEM | Reviewer | IN_PROGRESS |
| IN_PROGRESS | COMPLETE with PASS/N_A only | Reviewer | COMPLETED |
| IN_PROGRESS | COMPLETE with FAIL/PARTIAL | Reviewer | NEEDS_QA_REVIEW |
| RETURNED_TO_SECURITY | RECHECK with PASS/N_A only | Reviewer | COMPLETED |
| RETURNED_TO_SECURITY | RECHECK with FAIL/PARTIAL | Reviewer | NEEDS_QA_REVIEW |

### Item Results
- PASS: Requirement met
- FAIL: Requirement not met
- PARTIAL: Partially met
- N_A: Not applicable

### Creation And Scope

- A security review is created only when QA Lead selects «نیاز به تست امنیت»
  while recording `READY` or `CONDITIONAL`.
- If the checkbox is not selected, the request is not shown in the Security
  Reviewer cartable.
- The review is unique per Test Request, not per Test Case.
- The QA Lead must complete the technical, access and environment-specific
  security configuration before submission.
- Dates and date-times are entered with Jalali controls. Passwords are never
  entered in the form; only the secure delivery method is recorded.
- Development, Test/SSO and Production fields are conditionally validated.
  Production requires explicit approvals and operational safeguards.

### Reviewer Evidence

The reviewer can inspect application, request/requirement/test-case identity,
version/build, request type and date, responsible people, QA approval time and
drill-down counts for test cases, final/open/passed/failed/blocked/skipped
runs and open Blocker/Critical bugs.

Every checklist item must have a result and at least one security evidence
file must be uploaded before submission. Each file is limited to 10 MiB and
remains downloadable by authorized participants throughout remediation.
Completed rows remain visible in the checklist cartable.

If every result is `PASS` or `N_A`, completion moves the related
VersionHistory from `SECURITY_REVIEW` to `PENDING_DECISION` and notifies Tech
Lead. Any `FAIL` or `PARTIAL` result keeps VersionHistory in
`SECURITY_REVIEW` and sends the full checklist and documents to QA Lead.

### Security Remediation Cartable

Route: `/security-review`

Visible roles are System Admin, QA Lead, QA Specialist, Developer and Security
Reviewer. Role-specific transitions are:

1. QA Lead either assigns the findings to a QA Specialist or returns them to
   Security Reviewer; notes are required.
2. QA Specialist creates a named security execution and assigns it to a
   Developer.
3. Developer records the remediation and sends it back to the assigned QA
   Specialist.
4. QA Specialist uploads a report of at most 10 MiB and submits it to QA Lead.
5. QA Lead approves the report and returns it to Security Reviewer, or rejects
   the report back to QA Specialist.
6. Security Reviewer updates the checklist and resubmits it.

Every transition records actor, timestamp, source and destination status,
notes and related attachment IDs. Notifications are emitted to the next
responsible role or user.

### Workflow Files
- **Frontend**: `apps/web/src/pages/ChecklistsPage.tsx`
- **Remediation frontend**: `apps/web/src/pages/SecurityReviewPage.tsx`
- **Domain service**: `apps/web/src/services/api.ts` -
  `securityChecklistApi` (RPC-backed in backend mode)

---

## 8. Playwright Workflow

### Actors
- **QA_LEAD/QA_SPECIALIST**: Runs automated tests

### State Transition Table
| Current State | Action | Actor | Next State |
|---------------|--------|-------|------------|
| - | START | QA | RUNNING |
| RUNNING | COMPLETE | System | PASSED/FAILED |
| RUNNING | ERROR | System | ERROR |
| RUNNING | CANCEL | QA | CANCELLED |

### Features
- Auto-discovery of CDE test files from Front, Back NodeJS/DataService, and Gateway roots
- UTMS-managed Playwright test files remain selectable for execution even when auto-discovery is disabled
- Manual path entry option
- Test file selection uses a simple responsive list/select in the start modal
- User-friendly command options: Browser/Project, headed, workers, retries, max failures, trace, and reporter
- Real-time status updates
- Log/artifact viewing
- Reporter-specific output: HTML, JSON, or JUnit/XML report artifact
- In-modal report preview and download
- Failure details show test title, project, file, line/column, message, and code frame
- Named lists for Passed, Skipped, and Cancelled tests

### Workflow Files
- **Frontend**: `apps/web/src/pages/PlaywrightPage.tsx`
- **Frontend**: `apps/web/src/pages/PlaywrightFilesPage.tsx`
- **Domain service**: `apps/web/src/services/api.ts` - `playwrightApi` (RPC-backed in backend mode)

---

## 9. Release/Publish Workflow

### Actors
- **QA_LEAD**: Creates releases, sets quality status
- **TECH_LEAD**: Makes decisions, publishes
- **PRODUCT_OWNER**: Views and comments

### State Transition Table
| Current State | Action | Actor | Next State |
|---------------|--------|-------|------------|
| - | CREATE | QA_LEAD | DRAFT |
| DRAFT | SUBMIT | QA_LEAD | QA_REVIEW |
| QA_REVIEW | SET_QUALITY without security | QA_LEAD | PENDING_DECISION |
| QA_REVIEW | SET_QUALITY with security | QA_LEAD | SECURITY_REVIEW |
| SECURITY_REVIEW | COMPLETE_SECURITY | SECURITY_REVIEWER | PENDING_DECISION |
| PENDING_DECISION | APPROVE | TECH_LEAD | APPROVED |
| PENDING_DECISION | CONDITIONAL | TECH_LEAD | CONDITIONAL |
| PENDING_DECISION | REJECT | TECH_LEAD | REJECTED |
| PENDING_DECISION | BLOCK | TECH_LEAD | BLOCKED |
| APPROVED/CONDITIONAL | PUBLISH | TECH_LEAD | PUBLISHED |
| Any | EMERGENCY | TECH_LEAD | EMERGENCY→PUBLISHED |

### Quality Snapshot
Captured when QA sets quality status:
- Total test cases
- Passed/Failed/Blocked runs
- Bug counts (critical, major, open, closed)
- Checklist results
- Playwright pass rate

The actual decision authority is capability-based. The standard workflow
assigns it to Tech Lead; the QA-owned workflow also grants it to QA Lead.
An `APPROVED` or `CONDITIONAL` decision marks the primary Test Request as
`COMPLETED` and records the reflected status change in its audit history.

### Emergency Publish
- Requires: Emergency reason, risk description
- Tech Lead accepts risk
- Audit logged specially

### Workflow Files
- **Frontend**: `apps/web/src/pages/ReleasesPage.tsx`
- **Domain service**: `apps/web/src/services/api.ts` - `releasePublishApi` (RPC-backed in backend mode)

---

## 10. Audit Trail

### Logged Actions
- CREATE, UPDATE, DELETE operations
- Status changes
- Assignments
- Submit, Review, Approve, Reject
- Publish, Emergency Publish
- Role changes
- Login/Logout

### Retention
- All logs are append-only
- No deletion allowed
- System Admin view only

### Workflow Files
- **Frontend**: `apps/web/src/pages/AuditPage.tsx`
- **Domain service**: `apps/web/src/services/api.ts` - `auditLogApi` (RPC-backed in backend mode)

---

## 11. Developer Board Workflow

### Actors
- **DEVELOPER**: Reviews assigned bugs and moves them through a friendly board UI.

### Behavior
- The board is a convenience view over the same bug lifecycle used by the formal bug cartable.
- Drag/drop status updates are allowed for developer-owned items according to role permissions.
- The "no action needed" status is available to developers as a correction path.
- The board does not replace QA retest, QA lead assignment, or locked release rules.

### Workflow Files
- **Frontend**: `apps/web/src/pages/DeveloperBoardPage.tsx`
- **Domain service**: `apps/web/src/services/api.ts` - `bugApi` (RPC-backed in backend mode)

---

## 12. Playwright Test File Workflow

### Actors
- **QA_LEAD/QA_SPECIALIST** with automated-test permission.

### Behavior
- Files are discovered from Application CDE roots and merged with UTMS-managed files.
- Users can create a managed test file by selecting application/folder, entering a valid `kebab-case.spec.ts` file name, and writing the script in the code editor modal.
- Users can edit all managed file metadata and script content.
- Managed files remain selectable in the Playwright run form even when auto-discovery is disabled.

### Workflow Files
- **Frontend**: `apps/web/src/pages/PlaywrightFilesPage.tsx`
- **Domain service**: `apps/web/src/services/api.ts` - `playwrightApi` (RPC-backed in backend mode)

---

## 13. Reports Workflow

### Actors
- Report-capable users in their active scope.

### Behavior
- Users select a report card, optionally filter by application, date range, status, and person.
- Detail tables support quick filter, column chooser, pagination, and Excel-compatible export.
- The reports page also provides JSON export, Excel export, mock PDF export, mock Schedule UI, and mock Alert UI.
- The Test Requests report uses its own dedicated read model instead of developer performance data.

### Workflow Files
- **Frontend**: `apps/web/src/pages/ReportsPage.tsx`
- **Domain service**: `apps/web/src/services/reportsApi.ts` - `reportsApi` (RPC-backed in backend mode)
