# Current Implementation

Source-verified: 2026-08-10

این سند وضعیت اجرایی checkout فعلی را توصیف می‌کند. قابلیت‌های ویرایش فایل تست
Playwright، مرور CDE و اجرای خودکار به محصول مستقل
[Playwright Studio](https://github.com/themaryamhasani/playwright-studio) منتقل شده‌اند؛
UTMS هیچ route، service، queue، runner، storage credential یا جدول runtime برای آن‌ها ندارد.

## Runtime topology

| Runtime | Entry point | Responsibility |
| --- | --- | --- |
| Web | `apps/web/src/main.tsx` | React/Vite UI، route guard، cartableها، reports و API Console |
| API | `apps/api/src/main.cjs` | health، auth session، domain/report RPC و Online API Console |
| PostgreSQL | `database/prisma/schema.prisma` | هویت، scope و domain schema فعلی UTMS |

stack اصلی فقط PostgreSQL، API و Web را اجرا می‌کند. پورت‌ها به‌ترتیب `5432`،
`4174` و `5173` هستند.

## Web routes

routeهای فعال شامل dashboard، test requests، requirements/flows، test cases،
test runs/bugs، developer board، run issues، checklists، security review، releases،
reports، API Console، users، applications، admin operations، audit و settings است.
routeهای محصول جداشده حذف شده‌اند و مسیر ناشناخته صفحهٔ 404 داخلی را نشان می‌دهد.

## HTTP surfaces

- `GET /api/health`
- `GET /api/domain/health` و `GET /api/domain/services`
- `POST /api/domain/rpc`
- `/api/api-console/*`
- `/api/reports/*`
- `/api/auth/*`

هیچ endpoint مربوط به CDE، مدیریت فایل Playwright یا اجرای Playwright در API وجود ندارد.

## Persistence boundary

Users، applications، workflow policies و test-management bridge از PostgreSQL
استفاده می‌کنند. بخشی از domain RPC هنوز transitional و file-backed است و
Online API Console نیز زیر `API_CONSOLE_DATA_DIR` ذخیره می‌شود. این محدودیت مستقل
از Playwright Studio است و در برنامهٔ تکمیل backend UTMS پیگیری می‌شود.

## Development

```bash
npm ci
npm run db:migrate
npm run db:seed
npm run dev:all
```

`dev:all` فقط Web و API را اجرا می‌کند. برای stack کانتینری از `docker compose up
--build` استفاده کنید.

## Verification

`npm run verify` شامل format، lint، architecture، typecheck، unit/contract و build
است. تست‌های مرورگر UTMS همچنان با Playwright Test به‌عنوان ابزار QA اجرا می‌شوند؛
این وابستگی توسعه‌ای، قابلیت محصول Playwright Studio نیست. راهنما در
[Automated Test Strategy](../testing/AUTOMATED_TEST_STRATEGY.md) قرار دارد.

## Extraction safety

migration حذف جداول قدیمی destructive است و بدون export/backup نباید روی دیتابیس
واقعی اجرا شود. جزئیات، rollback و مرز مالکیت در
[Playwright Studio Extraction](../migration/PLAYWRIGHT_STUDIO_EXTRACTION.md) آمده است.
