# استخراج کامل Playwright Studio از UTMS

تاریخ cutover کد: 2026-08-10

مخزن مستقل: <https://github.com/themaryamhasani/playwright-studio>

دو کارتابل «اجرای Playwright» و «مدیریت فایل‌های Playwright» همراه با CDE، صف،
worker، runner، artifact storage، مدل داده، authorization و مستندات تخصصی به یک
اپ مستقل منتقل شده‌اند. UTMS هیچ import، HTTP call یا credential مشترکی با اپ جدید ندارد.

## موارد خارج‌شده از UTMS

- route/page/menu و permission flag دو کارتابل
- APIهای `/api/cde/*`، `/api/playwright/*` و environment/mapping/file endpointها
- moduleهای CDE، CouchDB store، object store و queue
- `apps/worker` و `apps/playwright-runner`
- Redis، CouchDB و MinIO از Compose و launcher
- مدل‌ها، enumها، relationها، seedها و تنظیمات runner/CDE در Prisma
- گزارش‌ها، audit entityها و تنظیمات UI مختص قابلیت جداشده
- مستندات تخصصی که اکنون در `playwright-studio/docs` نگهداری می‌شوند

## مرز مالکیت

Playwright Studio پایگاه PostgreSQL، Redis، S3-compatible storage، auth/RBAC، API،
Web، Worker و Runner خودش را دارد. شناسه‌ها و کاربران legacy فقط در cutover offline
قابل import هستند؛ runtime integration یا dual-write وجود ندارد.

## ترتیب cutover داده

1. نوشتن و اجرای جدید در UTMS متوقف و jobهای فعال drain/cancel شوند.
2. از PostgreSQL، CouchDB و bucket قدیمی backup قابل بازیابی گرفته شود.
3. اسکریپت `migration:export` در مخزن جدید با دسترسی read-only اجرا شود.
4. import و artifact copy ابتدا dry-run و سپس روی دیتابیس/bucket خالی مقصد apply شوند.
5. count، hash، نمونه‌های spec/run/artifact و RBAC مقصد تطبیق داده شوند.
6. فقط پس از sign-off، migration `20260810000000_extract_playwright_studio` روی UTMS اجرا شود.

این migration destructive است. بدون archive معتبر اجرا نشود. rollback تا زمان
sign-off با بازگرداندن backupهای UTMS و مقصد و نگه‌داشتن UTMS در حالت read-only انجام می‌شود.

## مستندات مقصد

معماری، امنیت، API/data، عملیات، CDE، مهاجرت، راهبرد تست و ماتریس traceability در
مخزن مستقل زیر `docs/` نگهداری می‌شوند. تاریخچهٔ قدیمی همچنان از Git UTMS قابل
بازیابی است اما قرارداد جاری محسوب نمی‌شود.
