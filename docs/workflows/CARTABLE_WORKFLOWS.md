# UTMS - Cartable Workflows

## Overview
This document describes all workflow actions and state transitions for each Cartable in the UTMS system.

The executable implementation for these workflows is currently the frontend mock service at `apps/web/src/services/api.ts`; the server does not yet expose production Test Request, Requirement, Test Case, Test Run, Bug, Run Issue, Playwright or Release domain APIs.

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
| IN_PROGRESS | COMPLETE | QA_LEAD | COMPLETED | - |
| Any (except COMPLETED) | CANCEL | DEVELOPER/QA_LEAD | CANCELLED | - |

### Workflow Files
- **Frontend**: `apps/web/src/pages/TestRequestsPage.tsx`
- **Mock service**: `apps/web/src/services/api.ts` - `testRequestApi`
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
- **Mock service**: `apps/web/src/services/api.ts` - `requirementApi`, `flowApi`

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
- **Mock service**: `apps/web/src/services/api.ts` - `testCaseApi`

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
- **Mock service**: `apps/web/src/services/api.ts` - `testRunApi`

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
- **Mock service**: `apps/web/src/services/api.ts` - `bugApi`

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
- **Mock service**: `apps/web/src/services/api.ts` - `runIssueApi`

---

## 7. Checklist Workflow

### Actors
- **SECURITY_REVIEWER**: Reviews security/performance checklists
- **QA_LEAD/TECH_LEAD**: Views results

### State Transition Table
| Current State | Action | Actor | Next State |
|---------------|--------|-------|------------|
| - | CREATE | System | PENDING |
| PENDING | START | Reviewer | IN_PROGRESS |
| IN_PROGRESS | REVIEW_ITEM | Reviewer | IN_PROGRESS |
| IN_PROGRESS | COMPLETE | Reviewer | COMPLETED |

### Checklist Types
- SECURITY: Security controls review
- PERFORMANCE: Performance testing results
- PENETRATION: Penetration testing results

### Item Results
- PASS: Requirement met
- FAIL: Requirement not met
- PARTIAL: Partially met
- NOT_TESTED: Not applicable

### Workflow Files
- **Frontend**: `apps/web/src/pages/ChecklistsPage.tsx`
- **Mock service**: `apps/web/src/services/api.ts` - `checklistApi`

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
- **Mock service**: `apps/web/src/services/api.ts` - `playwrightApi`

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
| QA_REVIEW | SET_QUALITY | QA_LEAD | PENDING_DECISION |
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

### Emergency Publish
- Requires: Emergency reason, risk description
- Tech Lead accepts risk
- Audit logged specially

### Workflow Files
- **Frontend**: `apps/web/src/pages/ReleasesPage.tsx`
- **Mock service**: `apps/web/src/services/api.ts` - `releasePublishApi`

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
- **Mock service**: `apps/web/src/services/api.ts` - `auditLogApi`

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
- **Mock service**: `apps/web/src/services/api.ts` - `bugApi`

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
- **Mock service**: `apps/web/src/services/api.ts` - `playwrightApi`

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
- **Mock service**: `apps/web/src/services/reportsApi.ts`
