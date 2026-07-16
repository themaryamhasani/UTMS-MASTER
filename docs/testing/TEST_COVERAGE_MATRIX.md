# UTMS Test Coverage Matrix

Status is based on the executable suites in this checkout. `PASS` means the test was run successfully in the current validation pass; browser-engine rows requiring an uninstalled browser remain `PENDING-ENV`.

| Test ID | Requirement/source | Source file | Level/type | ISO 29119-4 technique | Role/scope | Project/browser | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| UTMS-SMOKE-STMT-001 | API health URL in `README.md` | `apps/api/.../api-console-server.cjs` | smoke/system | Statement Testing | N/A/N/A | smoke-Chromium | PASS |
| UTMS-AUTH-FUNC-002 | Authentication/context workflow | `apps/web/src/pages/LoginPage.tsx` | smoke/E2E | Requirements-based Testing | DEVELOPER/SYSTEMS | Chromium | PASS |
| UTMS-AUTH-STATE-002 | Refresh and logout | `apps/web/src/App.tsx`, `authStore.ts` | E2E | State Transition Testing | DEVELOPER/SYSTEMS | Chromium | PASS |
| UTMS-AUTH-CONTEXT-020 | Grouped same-role contexts and in-session Role switch | `authStore.ts`, `ContextSwitcher.tsx` | E2E | State Transition Testing | DEVELOPER,BA/SYSTEMS | Chromium | PASS |
| UTMS-REQ-STATE-001 | Developer → QA request workflow | `apps/web/src/pages/TestRequestsPage.tsx` | E2E | State Transition Testing | DEVELOPER/SYSTEMS | Chromium | PASS |
| UTMS-REQUEST-SCOPE-021 | Explicit Application and Requirement filtering | `TestRequestsPage.tsx`, `ApplicationSelect.tsx` | E2E | Data Flow Testing | DEVELOPER/SYSTEMS | Chromium | PASS |
| UTMS-TC-SCOPE-017 | Requirement Application identity in Test Case form | `TestCasesPage.tsx` | E2E | Data Flow Testing | QA_LEAD/SYSTEMS | Chromium | PASS |
| UTMS-RUN-SCOPE-018/019 | Request → Requirement → Test Case cascade | `TestRunsBugsPage.tsx` | E2E/security-functional | State Transition + Data Flow Testing | QA_LEAD,QA_SPECIALIST/SYSTEMS | Chromium | PASS |
| UTMS-RBAC-SEC-003 | Guarded route matrix | `apps/web/src/App.tsx`, `authStore.ts` | E2E/security | Decision Table Testing | SECURITY_REVIEWER/APP | Chromium | PASS |
| UTMS-API-INT-001 | Health/self-check contract | `api-console-server.cjs` | API integration | Requirements-based Testing | N/A/N/A | APIRequestContext | PASS |
| UTMS-API-INT-002 | Request lifecycle/export/archive | `api-console-server.cjs` | API integration | Data Flow Testing | DEVELOPER/SYSTEMS | APIRequestContext | PASS |
| UTMS-API-RND-003 | Deterministic collection data | `api-console-server.cjs` | API integration | Random Testing | QA_SPECIALIST/SYSTEMS | APIRequestContext | PASS |
| UTMS-RBAC-SEC-001/002 | Context validity and role matrix | `api-console-server.cjs` | security | Decision Table Testing | anonymous/all roles | APIRequestContext | PASS |
| UTMS-SCOPE-SEC-003 | Owner/application isolation | `api-console-server.cjs` | security | Branch Condition Combination Testing | DEVELOPER/QA_LEAD | APIRequestContext | PASS |
| UTMS-API-SCOPE-003 | Collection scope and Request Application anti-spoofing | `api-console-server.cjs` | system/security-negative | Authorization Testing | DEVELOPER/SYSTEMS | APIRequestContext | PASS |
| UTMS-SSRF-SEC-004 | Destination policy | `api-console-server.cjs` | security | Error Guessing | DEVELOPER/SYSTEMS | APIRequestContext | PASS |
| UTMS-API-BVA-005 | 2 MiB request-body boundary | `api-console-server.cjs` | negative/boundary | Boundary Value Analysis | DEVELOPER/SYSTEMS | APIRequestContext | PASS |
| UTMS-RESET-SEC-006 | Reset unavailable outside test | `api-console-server.cjs` | security | Branch Condition Testing | anonymous/N/A | APIRequestContext | PASS |
| UTMS-REQ-BVA-001 | Text length boundary | `apps/web/src/utils/inputRules.ts` | structural/boundary | Boundary Value Analysis | DEVELOPER/SYSTEMS | structural | PASS |
| UTMS-REQ-SYN-002 | SemVer grammar | `apps/web/src/utils/semver.ts` | structural/data | Syntax Testing | DEVELOPER/SYSTEMS | structural | PASS |
| UTMS-REQ-EP-003 | Title partitions | `apps/web/src/utils/inputRules.ts` | structural/negative | Equivalence Partitioning | DEVELOPER/SYSTEMS | structural | PASS |
| UTMS-API-SYN-005 | cURL dialect grammar | `api-console-server.cjs` | structural/data | Syntax Testing | QA_SPECIALIST/SYSTEMS | structural | PASS |
| UTMS-API-META-006 | Header-order invariant | cURL parser | regression | Metamorphic Testing | QA_SPECIALIST/SYSTEMS | structural | PASS |
| UTMS-RBAC-MCDC-007 | Automated-test decision conditions | `apps/web/src/stores/authStore.ts` | structural/security | MCDC | QA_SPECIALIST/SYSTEMS | structural | PASS |
| UTMS-RBAC-DT-008 / UTMS-API-BCC-009 | Role/action policies | `authStore.ts`, API policy | structural/security | Decision + Branch Condition Combination | all roles | structural | PASS |
| UTMS-REL-BRANCH-010 | Workflow policy branches | `workflowPolicyStore.ts` | structural/UAT | Branch Testing | QA_LEAD/TECH_LEAD | structural | PASS |
| UTMS-SCOPE-DATA-011 | APP vs SYSTEMS query scope | `authStore.ts` | structural/data | Data Flow Testing | QA_LEAD | structural | PASS |
| UTMS-RUN-SCOPE-015/016 | Execution cascade and cross-Application rejection | `testManagementScope.ts` | structural/data-negative | Data Flow + Decision Testing | QA_LEAD,QA_SPECIALIST/SYSTEMS | structural | PASS |
| UTMS-A11Y-CAUSE-001/002 | WCAG 2.2 AA critical surfaces | `LoginPage.tsx`, `App.tsx` | accessibility | Cause-Effect Graphing | anonymous/QA_LEAD | Chromium | EXECUTED |
| UTMS-A11Y-THEME-001/002 | Persistent theme and authenticated night surfaces | `ThemeProvider.tsx`, `ThemeToggle.tsx`, `index.css` | accessibility/E2E | State Transition + Interface Testing | anonymous,DEVELOPER | Chromium | PASS |
| UTMS-A11Y-THEME-003 | Night theme across all 21 cartable routes | application route matrix | accessibility/E2E | Route Matrix Testing | SYSTEM_ADMIN/APP | Chromium | PASS |
| UTMS-COMP-SCN-001 | Browser/RTL navigation | `App.tsx`, `Sidebar.tsx` | compatibility | Scenario Testing | DEVELOPER/SYSTEMS | 3 engines | PENDING-ENV |
| UTMS-COMP-THEME-003 | Theme preference, persistence and narrow layout | `ThemeProvider.tsx`, `ThemeToggle.tsx` | compatibility | Browser Compatibility Testing | anonymous/N/A | Chromium desktop/mobile | PASS |
| UTMS-COMP-THEME-003 | Cross-engine theme behavior | same as above | compatibility | Browser Compatibility Testing | anonymous/N/A | Firefox/WebKit | PENDING-ENV |
| UTMS-PERF-CTM-001 | API latency classification tree | API health route | performance | Classification Tree Method | DEVELOPER/SYSTEMS | Chromium/API | EXECUTED |
| UTMS-REL-COMB-001 | Reset/health repeatability | test reset route | reliability | Combinatorial Test Design | SYSTEM_ADMIN/APP | Chromium/API | EXECUTED |
| UTMS-REG-META-001 | Non-mutating export | collection export route | regression | Metamorphic Testing | DEVELOPER/SYSTEMS | Chromium/API | EXECUTED |
| UTMS-UAT-BRANCH-001 | Developer request entry | `TestRequestsPage.tsx` | UAT | Branch Testing | DEVELOPER/SYSTEMS | Chromium | EXECUTED |

The complete API route inventory is machine-readable at `tests/data/api-route-inventory.json`. Routes without a passing executable assertion are listed as gaps, not counted as covered.

## Current validation evidence

Validated on 2026-07-16:

- `npm.cmd run build:web`: passed.
- `UTMS-RUN-SCOPE-015/016`: 2 structural tests passed.
- `tests/e2e/test-management-scope.e2e.spec.ts`: 5 tests passed.
- `UTMS-API-SCOPE-003`: passed against a fresh isolated API process on port 4274. A prior attempt on the default port reached a stale already-running server, so the isolated run is the evidence used here.
- Theme accessibility suites: 3 tests passed, including the 21-route night-mode matrix.
- `npm.cmd run test:compatibility`: 8 Chromium desktop/mobile tests passed; Firefox and WebKit binaries were unavailable and remain `GAP-ENGINE-001` / `PENDING-ENV`.

