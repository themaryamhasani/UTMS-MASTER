# UTMS Test Case Catalog

The catalog is intentionally concise and points to executable Playwright specifications. Test IDs are stable and searchable in the source tree.

## Authentication, context, and RBAC

- `UTMS-AUTH-FUNC-002`: valid phone/password, context selection, RTL dashboard.
- `UTMS-AUTH-STATE-002`: refresh preserves authenticated context; explicit logout confirmation clears session.
- `UTMS-RBAC-SEC-003`: SECURITY_REVIEWER direct navigation to `/users` redirects to dashboard.
- `UTMS-RBAC-SEC-001`, `UTMS-RBAC-SEC-002`: malformed context denial and all eight role create rules.
- `UTMS-RBAC-MCDC-007`, `UTMS-RBAC-DT-008`, `UTMS-RBAC-BCC-009`: direct decision-function evidence.

## Test management workflow

- `UTMS-REQ-STATE-001`: DEVELOPER creates a draft request, refreshes, and submits it.
- `UTMS-UAT-BRANCH-001`: DEVELOPER can enter the request cartable and sees the create action.

## Online API Console

- `UTMS-API-INT-001`: health and self-check response contracts.
- `UTMS-API-INT-002`: collection/request creation, secret masking, export, and soft archive.
- `UTMS-API-RND-003`: seeded bounded collection generation and stable list results.
- `UTMS-API-SYS-001`, `UTMS-API-SYS-002`: API-to-UI persistence and export/archive data flow.
- `UTMS-REG-META-001`: collection export does not mutate active collection cardinality.

## Security and negative behavior

- `UTMS-RBAC-SEC-001/002`, `UTMS-SCOPE-SEC-003`: authentication, vertical/horizontal authorization, and scope isolation.
- `UTMS-SSRF-SEC-004`, `UTMS-SEC-ERR-013`: loopback/metadata/file destinations are blocked.
- `UTMS-API-BVA-005`: body-size maximum-plus-one is rejected with 413.
- `UTMS-RESET-SEC-006`: test-only reset is unavailable in production mode.

## ISO 29119-4 structural catalog

`tests/structural/decision-functions.spec.ts` executes boundary value, syntax, equivalence partition, decision, metamorphic, MCDC, decision table, branch condition combination, branch, data-flow, combinatorial, error-guessing, and deterministic random cases. The assertions import the source decision functions directly and are therefore not presented as browser-only coverage.

## Cross-cutting suites

- `UTMS-A11Y-CAUSE-001/002`: axe WCAG scans plus error association and RTL main landmark checks.
- `UTMS-COMP-SCN-001`: same navigation scenario under Chromium, Firefox, and WebKit projects.
- `UTMS-PERF-CTM-001`: ten samples with median/p90/p95/max/failure-rate JSON summary.
- `UTMS-REL-COMB-001`: five reset/health repetitions for bounded reliability evidence.

