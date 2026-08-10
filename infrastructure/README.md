# Infrastructure

Source-verified: 2026-08-10

زیرساخت UTMS پس از extraction فقط شامل Web، API و PostgreSQL است. صف اجرا،
ذخیره‌سازی artifact و runner متعلق به مخزن مستقل Playwright Studio هستند و در
هیچ Compose یا Dockerfile این مخزن وجود ندارند.

## Compose

```bash
docker compose up --build
```

فایل‌های تخصصی:

- `infrastructure/compose/docker-compose.infrastructure.yml`: فقط PostgreSQL.
- `infrastructure/compose/docker-compose.development.yml`: PostgreSQL، API و Web.
- `infrastructure/compose/docker-compose.test.yml`: دیتابیس، API، Web و سرویس اجرای تست‌های QA.
- `infrastructure/compose/docker-compose.performance.yml`: دیتابیس، fixture پایین‌دستی، API، Web و k6.

پورت‌های پیش‌فرض stack اصلی: Web روی `5173`، API روی `4174` و PostgreSQL روی
`5432`. دادهٔ API Console در volume نام‌گذاری‌شده نگهداری می‌شود. secret و فایل
محیطی نباید commit شوند.

تصویرهای API و Web با Node.js 22 Alpine و کاربر non-root اجرا می‌شوند. وضعیت
مرزهای persistence در [Current Implementation](../docs/architecture/CURRENT_IMPLEMENTATION.md)
ثبت شده است.
