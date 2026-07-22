# UTMS System QA Checklist Audit

Source-verified: 2026-07-22

Audit status is aligned with the frontend after phases 14-17.

## Summary

| Area | Current status | Notes |
|---|---|---|
| Login and context selection | Implemented | Phone/password validation, context selection, persistence, logout modal. |
| Role-based access | Implemented | Sidebar and page rendering use `canAccessCartable`; automated tests are gated per QA Specialist assignment. |
| Operational forms | Implemented for primary flows | Main forms use inline validation and shared input rules. |
| Test Request validation | Implemented | Title, version, build and description rules are shared where updated. |
| Requirement Flow rule | Implemented | Create/activate paths require at least one Flow. |
| Test Case traceability | Implemented | Requirement and Flow are required; Test Request selector is not shown. |
| Test Run and Bug editing | Implemented | Runs and linked bugs can be edited before VersionHistory lock; attachments are supported in updated flow. |
| Developer Board | Implemented | Card workflow, drag/drop, "باگ نیست", and "بدون نیاز به اقدام". |
| VersionHistory publish flow | Implemented in transitional domain service | Single Primary Test Request, policy-driven decision owner, QA quality modal, risk checklist and lock behavior; RPC-backed but not yet Prisma-backed. |
| Playwright execution | Simulated in transitional domain service | File cartable, runner options, report artifacts, preview/download and named result lists; no product runner execution loop. |
| Reports | Implemented through reports RPC | 20 reports, Traceability, version change history, Test Requests read model, JSON/Excel/PDF mock export and Schedule/Alert mock UI; no PostgreSQL report repository. |
| Tables | Implemented in shared component | Quick filter, Column Chooser, Excel-compatible export, page size controls. |
| Confirmation UX | Implemented | `confirm()`, `alert()` and `beforeunload` are absent from `src`. |

## Passed Items

| ID | Requirement | Evidence |
|---|---|---|
| QA-01 | Role-specific cartables | `apps/web/src/stores/authStore.ts`, `apps/web/src/components/layout/Sidebar.tsx` |
| QA-02 | QA Specialist automated-test permission | `automatedTestsEnabled`, Playwright cartable gating |
| QA-03 | CDE roots in Application Back-office | `apps/web/src/pages/ApplicationsPage.tsx`, `apps/web/src/services/seedData.ts` |
| QA-04 | Version/Build input sanitation | `apps/web/src/utils/inputRules.ts`, `apps/web/src/utils/semver.ts` |
| QA-05 | Playwright report preview/download | `apps/web/src/pages/PlaywrightPage.tsx`, `apps/web/src/services/api.ts` |
| QA-06 | VersionHistory change report | `apps/web/src/pages/ReportsPage.tsx`, `apps/web/src/services/reportsApi.ts` |
| QA-07 | Management Traceability report | `apps/web/src/pages/ReportsPage.tsx`, `apps/web/src/services/reportsApi.ts` |
| QA-08 | Shared table hardening | `apps/web/src/components/ui/Table.tsx` |
| QA-09 | Browser confirm removal | `rg "confirm\\(|alert\\(|beforeunload" apps/web/src` returns no matches |

## Backend Follow-Up

| ID | Item | Required action |
|---|---|---|
| BE-01 | Real Playwright runner | Implement worker/CI execution and artifact storage. |
| BE-02 | Real CDE/FAVA adapters | Implement backend adapter workers and credential handling. |
| BE-03 | Real PDF/Scheduled/Alert | Implement report rendering, scheduler and notification delivery. |
| BE-04 | Real Audit Export | Implement backend export endpoint and permission checks. |

## Verification Notes

- `npm run build` completed successfully after phases 14-17.
- Most domain APIs persist through transitional API-process/file state; production validation and PostgreSQL transaction guarantees still need backend-owned repositories. Users, applications and workflow policies already use PostgreSQL adapters.
