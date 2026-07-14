# UTMS - Cartable Requirements

## Overview
This document details the requirements for each Cartable in the UTMS system.

---

## 1. Developer Test Request Inbox (C01)

### Actor/Role
DEVELOPER

### Access Rule
Only see test requests created by self

### Visibility Rule
`requesterId = currentUser.id AND applicationId = activeContext.applicationId`

### Records Shown
- Test requests created by the developer
- All statuses visible

### Required Filters
- Status (All, Draft, Submitted, etc.)
- Priority (Critical, High, Medium, Low)
- Date Range
- Search (title, description)

### Available Actions
- Create Draft
- Edit Draft
- Submit for Review
- Cancel Request
- View Details

### Forbidden Actions
- Review (QA_LEAD only)
- Assign (QA_LEAD only)
- Execute Tests

### Backend APIs
- `GET /test-requests?requesterId={userId}`
- `POST /test-requests`
- `PUT /test-requests/:id`
- `POST /test-requests/:id/submit`
- `POST /test-requests/:id/cancel`

### Frontend Route/Component
- Route: `/test-requests`
- Component: `TestRequestsPage.tsx`

---

## 2. Developer Bug Inbox (C02)

### Actor/Role
DEVELOPER

### Access Rule
Only see bugs assigned to self

### Visibility Rule
`assigneeId = currentUser.id AND applicationId = activeContext.applicationId`

### Records Shown
- Bugs assigned to the developer
- Excludes: CLOSED, REJECTED

### Required Filters
- Status
- Severity

### Available Actions
- View Details
- Add Comment
- Update Status (IN_PROGRESS, FIXED)
- Set Fixed Version
- Mark Ready for Retest

### Forbidden Actions
- Create Bug (QA only)
- Change Severity/Priority
- Assign
- Retest

### Backend APIs
- `GET /bugs?assigneeId={userId}`
- `PUT /bugs/:id/status`
- `PUT /bugs/:id/fix`
- `POST /bugs/:id/ready-for-retest`
- `POST /bugs/:id/comments`

### Frontend Route/Component
- Route: `/bugs`
- Component: `BugsPage.tsx`

---

## 3. QA Lead Test Request Queue (C03)

### Actor/Role
QA_LEAD

### Access Rule
All test requests in current application

### Visibility Rule
`applicationId = activeContext.applicationId`

### Records Shown
- All test requests
- Priority: SUBMITTED for review

### Required Filters
- Status
- Priority
- Requester
- Assignee
- Date Range

### Available Actions
- View Details
- Review (Accept/Reject)
- Assign to QA Specialist
- Cancel

### Backend APIs
- `GET /test-requests`
- `POST /test-requests/:id/review`
- `POST /test-requests/:id/assign`
- `POST /test-requests/:id/cancel`

### Frontend Route/Component
- Route: `/test-requests`
- Component: `TestRequestsPage.tsx`

---

## 4. BA Requirement Queue (C06)

### Actor/Role
BA

### Access Rule
Requirements in current application

### Visibility Rule
`applicationId = activeContext.applicationId`

### Records Shown
- All requirements
- Priority: DRAFT, IN_PROGRESS

### Required Filters
- Status
- Search

### Available Actions
- Create Requirement
- Edit Requirement
- Add Flow
- Complete
- View Details

### Forbidden Actions
- Approve (QA_LEAD only)

### Backend APIs
- `GET /requirements`
- `POST /requirements`
- `PUT /requirements/:id`
- `POST /requirements/:id/approve`
- `POST /flows`
- `PUT /flows/:id`

### Frontend Route/Component
- Route: `/requirements`
- Component: `RequirementsPage.tsx`

---

## 5. Security Reviewer Checklist Queue (C07)

### Actor/Role
SECURITY_REVIEWER

### Access Rule
Checklists assigned/in application

### Visibility Rule
`applicationId = activeContext.applicationId`

### Records Shown
- Security, Performance, Penetration checklists
- Priority: PENDING, IN_PROGRESS

### Required Filters
- Status
- Type

### Available Actions
- View Details
- Review Items (PASS/FAIL/PARTIAL)
- Add Notes
- Complete Checklist

### Backend APIs
- `GET /checklists`
- `PUT /checklists/:id/items/:itemId`
- `POST /checklists/:id/complete`

### Frontend Route/Component
- Route: `/checklists`
- Component: `ChecklistsPage.tsx`

---

## 6. Tech Lead Decision Queue (C08)

### Actor/Role
TECH_LEAD

### Access Rule
Releases pending decision

### Visibility Rule
`status = PENDING_DECISION AND applicationId = activeContext.applicationId`

### Records Shown
- Releases awaiting decision
- All releases for reference

### Required Filters
- Status

### Available Actions
- View Details
- View Quality Snapshot
- Approve
- Conditional Approve
- Reject
- Block
- Emergency Publish
- Final Publish

### Backend APIs
- `GET /releases`
- `POST /releases/:id/decide`
- `POST /releases/:id/publish`
- `POST /releases/:id/emergency`

### Frontend Route/Component
- Route: `/releases`
- Component: `ReleasesPage.tsx`

---

## 7. Test Run Execution (C12)

### Actor/Role
QA_LEAD, QA_SPECIALIST

### Access Rule
Test runs in current application

### Visibility Rule
`applicationId = activeContext.applicationId`

### Records Shown
- All test runs
- Priority: PENDING, IN_PROGRESS

### Required Filters
- Status
- Search

### Available Actions
- Create Test Run
- Execute (set result)
- Create Bug (from failed)
- Create Run Issue (from blocked)
- Finalize

### Backend APIs
- `POST /test-runs`
- `PUT /test-runs/:id/status`
- `POST /test-runs/:id/finalize`
- `POST /bugs` (from test run)
- `POST /run-issues` (from test run)

### Frontend Route/Component
- Route: `/test-runs`
- Component: `TestRunsPage.tsx`

---

## 8. Playwright Execution (C17)

### Actor/Role
QA_LEAD, QA_SPECIALIST

### Access Rule
QA Lead or QA Specialist with automated-test permission in the active context.

### Visibility Rule
`applicationId = activeContext.applicationId`

### Records Shown
- All Playwright runs
- Real-time status for RUNNING
- Queue/runner metadata, command, selected reporter, and generated report state
- Named Passed, Failed, Skipped, and Cancelled test result details when a report exists

### Required Filters
- Status
- Search

### Available Actions
- Start New Run
- Cancel Running
- View Details
- View Logs
- Select a test file from discovered CDE files and UTMS-managed Playwright files
- Enter manual file path when discovery has no result
- Configure Browser/Project, headed mode, workers, retries, max failures, trace, and reporter
- Preview and download HTML/JSON/JUnit report artifacts

### Related Cartable
- `/playwright-files` lists discovered and managed Playwright test files.
- Users with Playwright execution permission can create/edit Playwright test files.
- Created/edited files become selectable in the Playwright run form even when auto-discovery is disabled.

### Backend APIs
- `GET /playwright-runs`
- `POST /playwright-runs`
- `POST /playwright-runs/:id/cancel`
- `GET /playwright-runs/discover-files`
- `GET /playwright-test-files`
- `POST /playwright-test-files`
- `PUT /playwright-test-files/:id`
- `GET /playwright-test-folders`

### Frontend Route/Component
- Route: `/playwright`
- Component: `PlaywrightPage.tsx`

---

## 9. System Admin - Users (C19)

### Actor/Role
SYSTEM_ADMIN

### Access Rule
All users in system

### Visibility Rule
All users (system-wide)

### Records Shown
- All users
- Role assignments

### Required Filters
- Search (name, phone, email)

### Available Actions
- View Details
- View Role Assignments

### Backend APIs
- `GET /users`
- `GET /users/:id`

### Frontend Route/Component
- Route: `/users`
- Component: `UsersPage.tsx`

---

## Current Implementation Addendum

The current frontend/mock route inventory includes these additional cartables and admin views:

### Developer Board

- Route/page: `/developer-board` / `DeveloperBoardPage.tsx`
- Access: `DEVELOPER`
- Purpose: Trello-like friendly board for developer bug/status work.
- Notes: This board is an additional developer convenience layer and does not replace the formal Test Run/Bug cartable.

### Playwright Test Files

- Route/page: `/playwright-files` / `PlaywrightFilesPage.tsx`
- Access: `QA_LEAD`, `QA_SPECIALIST` with automated-test permission.
- Purpose: View discovered and UTMS-managed Playwright files, create managed files, and edit application/folder/file name/description/script.
- File rule: managed file names use `kebab-case.spec.ts`.
- Source roots: Front CDE URL, Back NodeJS/DataService CDE URL, and Gateway CDE URL from Application Back-office.
- Execution link: created/edited files are selectable from the Playwright run form.

### Reports

- Route/page: `/reports` / `ReportsPage.tsx`
- Access: all report-capable roles through the dashboard/report boundary and active scope.
- Purpose: operational, quality, traceability, version-history, Playwright, audit, user/role, attachment, and comment reports.
- Current exports: JSON, Excel-compatible table export, and mock PDF blob.
- Current automation UI: mock Schedule and Alert modals.

### System Admin Operations

- Route/page: `/admin-operations` / `AdminOperationsPage.tsx`
- Access: `SYSTEM_ADMIN`
- Purpose: command trace, outbox, operational observability, and admin unlock monitoring in the mock layer.

### Application Management

- Route/page: `/applications` / `ApplicationsPage.tsx`
- Access: `SYSTEM_ADMIN`
- Purpose: manage systems/applications and store the three CDE test roots used by Playwright discovery.

### Settings

- Route/page: `/settings` / `SettingsPage.tsx`
- Access: `SYSTEM_ADMIN`
- Purpose: configure mock Playwright runner settings, integration feature flags, CDE adapter settings, and FAVA adapter settings.

## 10. System Admin - Audit (C18)

### Actor/Role
SYSTEM_ADMIN

### Access Rule
All audit logs

### Visibility Rule
`applicationId = activeContext.applicationId` or all

### Records Shown
- All audit events
- Sorted by time descending

### Required Filters
- Search
- Application

### Available Actions
- View Details
- View Previous/New Values

### Backend APIs
- `GET /audit-logs`

### Frontend Route/Component
- Route: `/audit`
- Component: `AuditPage.tsx`

---

## Common Requirements

### All Cartables Must Support
1. Server-side pagination
2. Server-side sorting
3. Server-side filtering
4. Loading states
5. Empty states
6. Error handling
7. Role-based visibility
8. Action validation

### UI Requirements
1. RTL layout
2. Persian labels
3. Jalali date display
4. Status badges
5. Priority indicators
6. Responsive tables
7. Modal forms
8. Confirmation dialogs
