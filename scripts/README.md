# Scripts

Source-verified: 2026-08-10

اسکریپت‌های دائمی در `scripts/` قرار دارند و باید از ریشهٔ مخزن اجرا شوند.

| Directory | Responsibility | Root commands |
| --- | --- | --- |
| `development` | اجرای هم‌زمان Web و API | `npm run dev:all` |
| `database` | Prisma generate/deploy/status/seed/verify | `npm run db:*` |
| `testing` | lifecycle تست isolated، اجرای suite و compatibility | `npm run test:*` |
| `verification` | format، lint، architecture و contract checks | `npm run verify` |

`dev:all` فقط پورت‌های `5173` و `4174` را preflight و دو process وب/API را
مدیریت می‌کند. سرویس‌های execution و storage اپ جداشده از این launcher حذف شده‌اند.
روی PowerShell در صورت محدودیت execution policy از `npm.cmd` استفاده کنید.
