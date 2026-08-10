# Dependency Inventory

Source-verified: 2026-08-10

## Root

- Runtime: `@prisma/client` و `@prisma/adapter-pg` نسخهٔ `7.9.1`، و `pg`.
- Development: Prisma CLI، TypeScript، Node types، Playwright Test، Axe و c8.
- Playwright Test فقط harness آزمون UTMS است و وابستگی runtime محصول جداشده نیست.

## Applications

- `apps/web`: React 19، React Router، TanStack Query، Zustand، Lucide، date-fns،
  uuid، Tailwind و Vite.
- `apps/api`: `argon2` برای password hashing و `pg` برای اتصال PostgreSQL؛ بخش
  transitional Domain RPC هنوز با esbuild بخشی از serviceهای frontend را bundle می‌کند.

## Shared packages

`@utms/contracts`، `@utms/config` و `@utms/test-support` dependency تولیدی ندارند.
`@utms/shared` utilityهای مستقل و Prisma client مشترک را ارائه می‌کند.

## Runtime images

- PostgreSQL `16-alpine`
- Node `22-alpine` برای API/Web
- تصویر Playwright فقط در stack تست QA
- k6 فقط در stack performance

Redis، CouchDB، MinIO، BullMQ و SDKهای S3 از dependency و runtime UTMS حذف شده‌اند.
مالک آن‌ها در صورت نیاز Playwright Studio است.

نسخه‌های نهایی را همیشه از `package.json` و `package-lock.json` بخوانید. Prisma CLI
و Client باید سازگار بمانند و dependency تولیدی جدید فقط در workspace مالک افزوده شود.
