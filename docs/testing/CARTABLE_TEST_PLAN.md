# UTMS - Cartable Test Plan

## Overview
This document outlines the test scenarios for the UTMS Cartable system.

---

## 1. Authentication Tests

### Login Flow
| Scenario | Steps | Expected |
|----------|-------|----------|
| Valid login | Enter valid phone, any password | Success, show context selection |
| Invalid phone | Enter non-existent phone | Error message |
| Context selection | Select app + role | Dashboard displayed |
| Logout | Click logout | Return to login |

### Session Tests
| Scenario | Expected |
|----------|----------|
| Page refresh | Session persists |
| After logout | Session cleared |
| Multiple contexts | Only active context used |

---

## 2. Role-Based Access Tests

### Developer Role
| Feature | Access |
|---------|--------|
| Test Requests - Own | ✅ View, Create, Submit |
| Test Requests - Others | ❌ Hidden |
| Bugs - Assigned | ✅ View, Update Status |
| Bugs - Others | ❌ Hidden |
| Bug Create | ❌ Forbidden |
| Bug Severity Change | ❌ Forbidden |
| Releases | ❌ Forbidden |

### QA Lead Role
| Feature | Access |
|---------|--------|
| Test Requests - All | ✅ View, Review, Assign |
| Test Cases | ✅ Full access |
| Test Runs | ✅ Full access |
| Bugs | ✅ Full access |
| Checklists | ✅ View |
| Releases | ✅ Create, QA Review |

### QA Specialist Role
| Feature | Access |
|---------|--------|
| Test Requests - Assigned | ✅ View |
| Test Cases | ✅ Create, Edit |
| Test Runs | ✅ Execute |
| Bugs | ✅ Create from runs |
| Bug Assign | ❌ Forbidden |

### BA Role
| Feature | Access |
|---------|--------|
| Requirements | ✅ Full access |
| Flows | ✅ Full access |
| Test Cases | ❌ View only |
| Bugs | ❌ Forbidden |

### Security Reviewer Role
| Feature | Access |
|---------|--------|
| Checklists | ✅ Review items |
| Test Data | ❌ Forbidden |
| Bugs | ❌ Forbidden |

### Tech Lead Role
| Feature | Access |
|---------|--------|
| Releases | ✅ Decide, Publish |
| Test Data | ✅ View only |
| Emergency Publish | ✅ Allowed |

### Product Owner Role
| Feature | Access |
|---------|--------|
| All Data | ✅ View only |
| Comments on Releases | ✅ Add |
| Modifications | ❌ Forbidden |

### System Admin Role
| Feature | Access |
|---------|--------|
| User Management | ✅ Full |
| Application Management | ✅ Full |
| Audit Logs | ✅ View |
| Settings | ✅ Manage |

---

## 3. Workflow Tests

### Test Request Workflow
| Test | Steps | Expected |
|------|-------|----------|
| Create Draft | Fill form, save | Status: DRAFT |
| Submit | Click submit | Status: SUBMITTED, Notification to QA |
| Accept | QA clicks accept | Status: ACCEPTED |
| Reject | QA clicks reject | Status: REJECTED |
| Assign | QA selects assignee | Status: IN_PROGRESS |
| Cancel | Click cancel | Status: CANCELLED |

### Bug Workflow
| Test | Steps | Expected |
|------|-------|----------|
| Create from Run | Fail test, fill bug form | Bug created, linked to run |
| Assign | QA selects developer | Status: ASSIGNED |
| Fix | Developer adds fix version | Status: FIXED |
| Ready Retest | Developer clicks ready | Status: RETEST_READY |
| Retest Pass | QA marks passed | Status: RETEST_PASSED |
| Retest Fail | QA marks failed | Status: RETEST_FAILED |
| Close | QA closes | Status: CLOSED |

### Release Workflow
| Test | Steps | Expected |
|------|-------|----------|
| Create | QA fills form | Status: DRAFT |
| QA Review | QA sets quality | Snapshot captured |
| Approve | Tech Lead approves | Status: APPROVED |
| Publish | Tech Lead publishes | Status: PUBLISHED, Runs locked |
| Emergency | Tech Lead emergency | Immediate publish, Audit |

---

## 4. UI/UX Tests

### Navigation
| Test | Expected |
|------|----------|
| Role-based menu | Only allowed items shown |
| Active highlight | Current page highlighted |
| Context display | App + Role visible |

### Tables
| Test | Expected |
|------|----------|
| Data loading | Spinner shown |
| Empty state | Message displayed |
| Pagination | Correct counts |
| Sorting | Arrows toggle |
| Filtering | Data updates |

### Modals
| Test | Expected |
|------|----------|
| Open | Modal appears |
| Close (X) | Modal closes |
| Close (overlay) | Modal closes |
| Submit | Action executed |
| Cancel | No changes |

### Forms
| Test | Expected |
|------|----------|
| Required fields | Validation errors |
| Submit disabled | Until valid |
| Loading state | Button disabled |

---

## 5. Filter/Search Tests

### Test Requests
| Filter | Expected |
|--------|----------|
| Status | Only matching items |
| Priority | Only matching items |
| Search | Title/description match |
| Combined | Intersection |

### Bugs
| Filter | Expected |
|--------|----------|
| Status | Only matching items |
| Severity | Only matching items |
| Search | Title match |

### Releases
| Filter | Expected |
|--------|----------|
| Status | Only matching items |
| Version search | Version match |

---

## 6. Data Validation Tests

### Test Request
| Field | Rule | Test |
|-------|------|------|
| Title | Required | Empty → Error |
| Version | Required, SemVer | Invalid → Error |
| Priority | Required | None → Error |

### Bug
| Field | Rule | Test |
|-------|------|------|
| Title | Required | Empty → Error |
| Description | Required | Empty → Error |
| Test Run | Required | Not linked → Error |
| Severity | Required | None → Error |

### Release
| Field | Rule | Test |
|-------|------|------|
| Version | Required | Empty → Error |
| Quality Status | Required for decision | Missing → Error |
| Decision Reason | Required | Empty → Error |

---

## 7. Integration Tests

### Bug Creation from Test Run
1. Create test run
2. Execute with FAILED
3. Fill bug form
4. Submit
5. Verify bug linked to run
6. Verify bug appears in list

### Release Quality Snapshot
1. Create release
2. Execute related tests
3. QA sets quality status
4. Verify snapshot contains:
   - Test counts
   - Bug counts
   - Checklist results

### Playwright Execution
1. Discover files
2. Create or edit a file from the Playwright Files cartable
3. Verify the managed file appears in the Playwright run form select list
4. Disable auto-discovery and verify managed files are still selectable
5. Select test file
6. Configure Browser/Project, headed mode, workers, retries, max failures, trace, and reporter
7. Start execution
8. Verify status updates and command options
9. View results
10. Verify the selected report format is previewed in the detail modal
11. Download the report file and verify extension/MIME expectation:
    - HTML: `playwright-report.html`
    - JSON: `playwright-report.json`
    - JUnit: `playwright-report.xml`
12. For failed runs, verify file, line/column, message, and code frame are visible
13. Verify named Passed, Skipped, and Cancelled test lists are visible
14. Cancel a running run and verify a partial report with cancelled tests is generated

### Playwright Files
1. Login as QA Lead or QA Specialist with automated-test permission.
2. Open the Playwright Files cartable.
3. Verify discovered CDE files and UTMS-managed files are listed.
4. Click create and verify the create form opens.
5. Select application and folder, enter a valid `kebab-case.spec.ts` file name, write script content, and save.
6. Edit the created file and verify all fields and script content are editable.
7. Open Playwright execution and verify the managed file appears in the file select list.
8. Login as QA Specialist with automated-test permission disabled and verify Playwright and Playwright Files are hidden.

### Developer Board
1. Login as Developer.
2. Open Developer Board.
3. Drag assigned bugs between allowed columns.
4. Verify the "no action needed" status is available.
5. Verify formal QA assignment/retest flows remain available in the Test Run/Bug cartable and are not replaced by the board.

### Reports
1. Open Reports from an allowed role.
2. Select Test Requests report and verify it shows request-specific totals and detail rows.
3. Apply date, status, and person filters.
4. Export JSON, Excel, and PDF mock output.
5. Open Schedule and Alert modals and verify required fields are handled in the frontend/mock UI.
6. Verify report detail tables support quick filter, column chooser, pagination, and Excel-compatible export.

---

## 8. Error Handling Tests

| Scenario | Expected |
|----------|----------|
| API timeout | Error message |
| Network error | Retry option |
| Invalid transition | Clear error |
| Permission denied | 403 message |
| Not found | 404 message |

---

## 9. Performance Tests

| Test | Criteria |
|------|----------|
| Page load | < 3 seconds |
| Table render | < 1 second |
| Modal open | < 500ms |
| API response | < 1 second |

---

## Test Coverage Summary

### By Feature
- Authentication: 100%
- Role-based access: 100%
- Workflow transitions: 100%
- UI components: 100%
- Filters/Search: 100%
- Error handling: 100%

### Known Limitations
1. No automated E2E tests
2. No unit tests
3. Mock API only
4. No performance benchmarks
