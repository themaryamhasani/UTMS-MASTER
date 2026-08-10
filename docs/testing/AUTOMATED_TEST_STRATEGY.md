# UTMS Automated Test Strategy

Source-verified: 2026-08-10

Playwright Test در این مخزن فقط ابزار QA برای آزمون خود UTMS است و با محصول مستقل
Playwright Studio یا runner آن ارتباط runtime ندارد.

## Layers

| Layer | Location | Command |
| --- | --- | --- |
| Unit | workspace test files | `npm run test:unit` |
| Contract | API/contracts | `npm run test:contract` |
| Structural | `tests/structural` | `npm run test:structural` |
| Integration | `apps/api/test/integration` | `npm run test:integration` |
| Browser E2E/System | `tests/e2e`, `tests/system` | `npm run test:e2e`, `npm run test:system` |
| Security/accessibility | dedicated projects | `npm run test:security`, `npm run test:accessibility` |
| Performance | k6 and bounded browser samples | `npm run perf:*`, `npm run test:performance` |

suiteها deterministic هستند، از timeout تصادفی استفاده نمی‌کنند و evidence را
زیر `artifacts/tests` می‌نویسند. stack تست isolated فقط PostgreSQL، API و Web دارد؛
تصویر `mcr.microsoft.com/playwright` runner تست QA است، نه سرویس محصول.

```bash
npm ci
npx playwright install chromium firefox webkit
npm run verify
npm run test:all
```

محدودیت‌های محیطی و پوشش‌های باقی‌مانده در [Known Test Gaps](KNOWN_TEST_GAPS.md)
ثبت می‌شوند.
