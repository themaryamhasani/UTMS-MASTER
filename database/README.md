# Database

Source-verified: 2026-08-10

مالکیت schema، migration و seed دیتابیس UTMS در `database/prisma` است. دیتابیس
Playwright Studio مستقل است و هیچ جدول، enum، relation یا seed اجرایی آن در schema
فعلی UTMS وجود ندارد.

## Commands

```bash
npm run db:generate
npm run db:migrate
npm run db:migrate:status
npm run db:seed
npm run db:verify
npm run db:verify:extraction
```

اتصال محلی پیش‌فرض:

```text
postgresql://postgres:1234@localhost:5432/UTMS?schema=public
```

`db:migrate` از `prisma migrate deploy` استفاده می‌کند. migration
`20260810000000_extract_playwright_studio` داده و ساختار محصول جداشده را حذف
می‌کند؛ به همین دلیل فقط پس از export و backup معتبر باید روی دیتابیس واقعی اعمال
شود. migrationهای قدیمی مرتبط با محصول جداشده عمداً در زنجیرهٔ تاریخچه باقی
مانده‌اند تا ساخت دیتابیس از صفر و ارتقای نصب‌های قدیمی قابل تکرار باشد؛ migration
نهایی آن ساختارها را حذف می‌کند.

`db:verify:extraction` با `ADMIN_DATABASE_URL` یک دیتابیس موقت می‌سازد، کل
زنجیره را deploy/seed می‌کند، نبود جدول و ستون محصول جداشده را می‌سنجد و دیتابیس
موقت را در پایان حذف می‌کند. این دستور فقط روی PostgreSQL توسعه/disposable اجرا شود.

## Runtime schema

- هویت، session، نقش و scope سامانه
- Application و workflow policy
- Test Request، Requirement، Flow، Test Case، Test Run، Bug، Retest و Run Issue
- Security Review و Checklist
- VersionHistory و انتشار
- Audit، Comment، Notification، Attachment، Command Trace و Outbox
- Online API Console و Reports

seed فعلی فقط workflow policy، application، identity/role، تنظیم FAVA و زیرساخت
API Console را ایجاد می‌کند.
