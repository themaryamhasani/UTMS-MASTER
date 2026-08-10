# UTMS Reports API

Source-verified: 2026-08-10

read modelها در `apps/web/src/services/reportsApi.ts` قرار دارند و در backend mode
از `POST /api/domain/rpc` اجرا می‌شوند. گزارش محصول جداشده از این سرویس و UI حذف شده است.

## Report inventory

| UI key | Service |
| --- | --- |
| `overview` | `getSystemOverview` |
| `quality-health` | `getQualityHealth` |
| `product-quality` | `getProductQualityOverview` |
| `test-requests` | `getTestRequestReport` |
| `requirements` | `getRequirementReport` |
| `flow-coverage` | `getFlowCoverage` |
| `traceability` | `getTraceabilityReport` |
| `api-usage` | API Console usage report |
| `test-cases` | `getTestCaseReport` |
| `test-runs` | `getTestRunReport` |
| `open-bugs` | `getOpenBugsList` |
| `developer-performance` | `getDeveloperPerformance` |
| `developer-bugfix` | `getDeveloperBugFixReport` |
| `checklists` | `getChecklistReport` |
| `releases` | `getReleaseReport` |
| `emergency` | `getEmergencyPublishReport` |
| `attachments` | `getAttachmentReport` |
| `users-roles` | `getUsersRolesReport` |
| `audit` | `getAuditReport` |
| `comments` | `getCommentReport` |

scope سامانه برای گزارش‌های domain ارسال می‌شود و کارت‌ها در UI role-based هستند.
اعمال authorization نهایی باید در backend انجام شود. export فعلی JSON و CSV دارد؛
PDF server-side، scheduled execution، alert delivery و read model کامل PostgreSQL
هنوز کارهای production-hardening هستند.
