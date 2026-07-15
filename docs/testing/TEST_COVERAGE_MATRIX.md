# UTMS Test Coverage Matrix

Status is based on the executable suites in this checkout. `PASS` means the test was run successfully in the current validation pass; browser-engine rows requiring an uninstalled browser remain `PENDING-ENV`.

| Test ID | Requirement/source | Source file | Level/type | ISO 29119-4 technique | Role/scope | Project/browser | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| UTMS-SMOKE-STMT-001 | API health URL in `README.md` | `apps/api/.../api-console-server.cjs` | smoke/system | Statement Testing | N/A/N/A | smoke-Chromium | PASS |
| UTMS-AUTH-FUNC-002 | Authentication/context workflow | `apps/web/src/pages/LoginPage.tsx` | smoke/E2E | Requirements-based Testing | DEVELOPER/SYSTEMS | Chromium | PASS |
| UTMS-AUTH-STATE-002 | Refresh and logout | `apps/web/src/App.tsx`, `authStore.ts` | E2E | State Transition Testing | DEVELOPER/SYSTEMS | Chromium | PASS |
| UTMS-REQ-STATE-001 | Developer → QA request workflow | `apps/web/src/pages/TestRequestsPage.tsx` | E2E | State Transition Testing | DEVELOPER/SYSTEMS | Chromium | PASS |
| UTMS-RBAC-SEC-003 | Guarded route matrix | `apps/web/src/App.tsx`, `authStore.ts` | E2E/security | Decision Table Testing | SECURITY_REVIEWER/APP | Chromium | PASS |
| UTMS-API-INT-001 | Health/self-check contract | `api-console-server.cjs` | API integration | Requirements-based Testing | N/A/N/A | APIRequestContext | PASS |
| UTMS-API-INT-002 | Request lifecycle/export/archive | `api-console-server.cjs` | API integration | Data Flow Testing | DEVELOPER/SYSTEMS | APIRequestContext | PASS |
| UTMS-API-RND-003 | Deterministic collection data | `api-console-server.cjs` | API integration | Random Testing | QA_SPECIALIST/SYSTEMS | APIRequestContext | PASS |
| UTMS-RBAC-SEC-001/002 | Context validity and role matrix | `api-console-server.cjs` | security | Decision Table Testing | anonymous/all roles | APIRequestContext | PASS |
| UTMS-SCOPE-SEC-003 | Owner/application isolation | `api-console-server.cjs` | security | Branch Condition Combination Testing | DEVELOPER/QA_LEAD | APIRequestContext | PASS |
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
| UTMS-A11Y-CAUSE-001/002 | WCAG 2.2 AA critical surfaces | `LoginPage.tsx`, `App.tsx` | accessibility | Cause-Effect Graphing | anonymous/QA_LEAD | Chromium | EXECUTED |
| UTMS-COMP-SCN-001 | Browser/RTL navigation | `App.tsx`, `Sidebar.tsx` | compatibility | Scenario Testing | DEVELOPER/SYSTEMS | 3 engines | PENDING-ENV |
| UTMS-PERF-CTM-001 | API latency classification tree | API health route | performance | Classification Tree Method | DEVELOPER/SYSTEMS | Chromium/API | EXECUTED |
| UTMS-REL-COMB-001 | Reset/health repeatability | test reset route | reliability | Combinatorial Test Design | SYSTEM_ADMIN/APP | Chromium/API | EXECUTED |
| UTMS-REG-META-001 | Non-mutating export | collection export route | regression | Metamorphic Testing | DEVELOPER/SYSTEMS | Chromium/API | EXECUTED |
| UTMS-UAT-BRANCH-001 | Developer request entry | `TestRequestsPage.tsx` | UAT | Branch Testing | DEVELOPER/SYSTEMS | Chromium | EXECUTED |

The complete API route inventory is machine-readable at `tests/data/api-route-inventory.json`. Routes without a passing executable assertion are listed as gaps, not counted as covered.

