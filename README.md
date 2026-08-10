# UTMS

UTMS یک سامانهٔ مدیریت تست فارسی و RTL در قالب npm workspaces است. قابلیت‌های
مدیریت فایل و اجرای Playwright به‌صورت کامل به مخزن مستقل
[Playwright Studio](https://github.com/themaryamhasani/playwright-studio) منتقل
شده‌اند. شرح مرز مالکیت و cutover در
[Extraction Guide](docs/migration/PLAYWRIGHT_STUDIO_EXTRACTION.md) است.

## Workspaces

- `apps/web` — React/Vite frontend
- `apps/api` — auth، domain/report RPC و Online API Console
- `packages/contracts` — قراردادهای مشترک
- `packages/shared` — utilityهای مستقل از framework
- `packages/config` — قراردادهای configuration
- `packages/test-support` — fixture و builder تست

## Prerequisites

- Node.js 22 و npm
- PostgreSQL 16 یا Docker Compose
- browser binaryها فقط برای اجرای suiteهای مرورگر QA

## Quick start

```bash
npm ci
npm run db:migrate
npm run db:seed
npm run dev:all
```

Web روی `http://localhost:5173` و API روی `http://localhost:4174` اجرا می‌شوند.
`dev:all` فقط همین دو process را اجرا می‌کند.

## Verification

```bash
npm run backend:self-check
npm run db:verify
npm run verify
npm run test:all
```

Playwright Test در این مخزن صرفاً ابزار تست UTMS است و runtime integration با
Playwright Studio نیست. راهنما: [Automated Test Strategy](docs/testing/AUTOMATED_TEST_STRATEGY.md).

## Docker

```bash
docker compose up --build
docker compose down
```

stack اصلی فقط PostgreSQL، API و Web را اجرا می‌کند. حذف volumeها با
`docker compose down -v` destructive است و فقط برای reset صریح محیط محلی استفاده شود.

## Documentation

- [Documentation index](docs/INDEX.md)
- [Current implementation](docs/architecture/CURRENT_IMPLEMENTATION.md)
- [Current system guide](docs/workflows/CURRENT_SYSTEM_GUIDE_FA.md)
- [Database](database/README.md)
- [Infrastructure](infrastructure/README.md)
- [Known test gaps](docs/testing/KNOWN_TEST_GAPS.md)

خروجی‌های runtime و generated فقط زیر مسیرهای ignored مانند `runtime/`،
`artifacts/`، `test-results/` و `dist/` قرار می‌گیرند.
