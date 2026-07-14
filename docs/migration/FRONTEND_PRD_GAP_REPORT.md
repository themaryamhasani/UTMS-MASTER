# گزارش تکمیل فازهای ۱۴ تا ۱۷ فرانت

تاریخ به‌روزرسانی: 2026-07-12

دامنه: تکمیل فرانت و mock مطابق PRD، با جداسازی مواردی که ذاتا بک‌اند، Worker، Storage یا Integration واقعی نیاز دارند.

## نتیجه اجرایی

فازهای ۱۴، ۱۵، ۱۶ و ۱۷ در فرانت انجام شدند. مغایرت‌های قبلی فرانت در حوزه `confirm()` مرورگر، گزارش Test Requests، استاندارد جدول‌ها، خروجی‌ها و فیلترهای گزارش بسته شده‌اند.

## وضعیت فازها

| فاز | وضعیت | خروجی |
|---|---|---|
| 14 | تکمیل شد | حذف `confirm()` مرورگر، اتصال Test Requests Report به read model اختصاصی، تفکیک خروجی‌های Reports. |
| 15 | تکمیل شد | `Table` مشترک با Column Chooser، فیلتر سریع و خروجی Excel/CSV؛ یکسان‌سازی page size در صفحات اصلی. |
| 16 | تکمیل شد | فیلترهای مشترک Reports، خروجی JSON/Excel/PDF mock، UI زمان‌بندی گزارش و Alert. |
| 17 | تکمیل شد | build موفق و به‌روزرسانی مستندات فرانت/mock. |

## تغییرات اصلی سورس

| حوزه | فایل‌ها | توضیح |
|---|---|---|
| Confirm داخلی | `src/pages/RequirementsPage.tsx` | حذف Flow از Modal داخلی استفاده می‌کند و `confirm()` مرورگر حذف شد. |
| گزارش Test Requests | `src/services/reportsApi.ts`, `src/pages/ReportsPage.tsx` | `getTestRequestReport` اضافه و کارت `test-requests` به آن متصل شد. |
| جدول مشترک | `src/components/ui/Table.tsx` | Column Chooser، فیلتر سریع و export داخلی اضافه شد. |
| Pagination | صفحات جدولی اصلی | `onLimitChange` و گزینه‌های ۱۰/۳۰/۷۰/۱۰۰ در صفحات اصلی فعال شد. |
| Reports UX | `src/pages/ReportsPage.tsx` | خروجی JSON/Excel/PDF mock، فیلترهای مشترک، Schedule و Alert mock اضافه شد. |
| Applications table | `src/pages/ApplicationsPage.tsx` | pagination محلی اضافه شد. |

## اعتبارسنجی

| بررسی | نتیجه |
|---|---|
| جست‌وجوی `confirm(` / `alert(` / `beforeunload` در `src` | موردی پیدا نشد. |
| build فرانت | `npm run build` موفق. |
| گزارش Test Requests | به `reportsApi.getTestRequestReport` متصل است. |
| Table features | `enableColumnChooser`, `enableClientFilter`, `enableExport` در `Table` مشترک فعال است. |

## موارد خارج از دامنه فرانت

این موارد برای شروع بک‌اند/Worker باقی می‌مانند و مغایرت فرانت محسوب نمی‌شوند:

1. اجرای واقعی Playwright در Runner/CI.
2. خواندن واقعی فایل‌ها از CDE با Adapter و Credential.
3. PDF server-side استاندارد.
4. Scheduled Report و Alert واقعی.
5. Audit Export واقعی.
6. Object Storage برای Artifact و Attachment.
7. تراکنش اتمیک VersionHistory و Lock/Audit/Notification در دیتابیس.
