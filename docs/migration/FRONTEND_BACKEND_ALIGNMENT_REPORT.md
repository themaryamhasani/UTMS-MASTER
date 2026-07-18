# گزارش هماهنگی فرانت و بک UTMS

تاریخ بررسی: 2026-07-18
وضعیت به‌روزرسانی: اتصال backend domain RPC برقرار است و تنظیمات UI دیگر وضعیت دامنه را به‌عنوان `Mock API (MVP)` نمایش نمی‌دهد.

## جمع‌بندی اجرایی

در بررسی اولیه، هماهنگی فرانت و بک کامل و سراسری نبود و فقط محدوده Online API Console به بک‌اند واقعی HTTP متصل بود. پس از اصلاح، سرویس‌های دامنه اصلی پشت route جدید `/api/domain/rpc` اجرا می‌شوند و فرانت از همان contractهای قبلی، اما از طریق backend، آن‌ها را مصرف می‌کند.

بنابراین وضعیت پروژه را باید «ترکیبی» در نظر گرفت:

| حوزه | وضعیت هماهنگی جدید | توضیح |
|---|---|---|
| Online API Console | هماهنگ با بک‌اند واقعی | `apiConsoleApi.ts` از `fetch` به `/api/api-console/*` استفاده می‌کند و بک‌اند همین routeها را در `api-console-server.cjs` پیاده‌سازی کرده است. |
| گزارش مصرف API | هماهنگ با بک‌اند واقعی | کارت `api-usage` در Reports از `apiConsoleApi.getApiUsageReport` و endpoint واقعی `/api/api-console/reports/api-usage` استفاده می‌کند. |
| گزارش‌های عمومی محصول | متصل به backend domain RPC | `reportsApi.ts` همچنان read model فعلی را نگه می‌دارد، اما در مرورگر از طریق `createDomainRpcProxy` روی backend اجرا می‌شود. |
| کارتابل‌ها و workflowهای تست | متصل به backend domain RPC | صفحات اصلی همان سرویس‌های `apps/web/src/services/api.ts` را مصرف می‌کنند، اما exportها در browser به `/api/domain/rpc` proxy می‌شوند. |
| احراز هویت و نقش‌ها | server-side در domain RPC برای منطق فعلی | ruleهای موجود در سرویس دامنه اکنون روی backend اجرا می‌شوند؛ hardening کامل auth/token همچنان مرحله production بعدی است. |
| persistence دامنه | backend runtime persistence | state دامنه در backend با `runtime/domain-rpc/utms-state.json` یا `UTMS_DOMAIN_STATE_FILE` ذخیره می‌شود. |

## شواهد اصلی

1. فایل `apps/web/src/services/api.ts` با توضیح `Local in-memory service implementation for frontend development` شروع می‌شود و تقریباً تمام APIهای دامنه UTMS را به‌صورت local state پیاده می‌کند.
2. فایل `apps/web/src/services/apiConsoleApi.ts` تنها کلاینت HTTP واقعی فرانت است؛ مقدار پایه آن از `VITE_API_CONSOLE_BASE_URL` یا `/api/api-console` خوانده می‌شود و با `fetch` به بک‌اند درخواست می‌فرستد.
3. بک‌اند فعلی در `apps/api/src/main.cjs` فقط `createServer` ماژول API Console را listen می‌کند و در `apps/api/src/main.ts` نیز فقط `apiConsoleModule` در health/application description دیده می‌شود.
4. ماژول API Console در `apps/api/src/modules/api-console/api-console.module.ts` فقط routeهای `/api/api-console` و `/api/reports` را اعلام کرده است.
5. `apps/web/vite.config.ts` فقط مسیرهای `/api/*` را به `VITE_DEV_API_PROXY_TARGET`، پیش‌فرض `http://localhost:4174`، proxy می‌کند. این برای API Console درست است، اما چون بیشتر سرویس‌های فرانت HTTP نیستند، باعث اتصال سایر ماژول‌ها به بک نمی‌شود.
6. `docs/api/REPORTS_API.md` صراحتاً می‌گوید report APIهای فعلی frontend/mock read model هستند و production باید backend read model/query endpoint جایگزین کند.
7. `tests/data/api-route-inventory.json` routeهای بک‌اند قابل تست را فقط برای API Console و health فهرست کرده است.

## نقاط هماهنگ

### 1. Online API Console

این بخش بهترین وضعیت هماهنگی را دارد:

- فرانت از `apiConsoleApi` برای routeهای `/api/api-console/*` استفاده می‌کند.
- بک‌اند routeهای متناظر مانند policy، environments، runners، collections، requests، curl parse، execute، export، documentation، share reviews، repository، references و usage report را پیاده کرده است.
- تست‌های integration/security/system همین routeها را هدف می‌گیرند.
- مستندات `docs/api/ONLINE_API_CONSOLE_IMPLEMENTATION.md` همین معماری را توضیح داده است.

ریسک باقی‌مانده در این بخش بیشتر از جنس نگهداری قرارداد است: route inventory موجود همه routeهای مستندشده را کامل پوشش نمی‌دهد؛ برای مثال routeهای repository version، references delete، executions و `/api/reports/api-usage` در مستندات آمده‌اند اما inventory خلاصه‌تر است.

### 2. تنظیمات dev proxy

فرانت در حالت توسعه `/api/*` را به API server روی port 4174 proxy می‌کند. این با `.env.example` و `.env.test.example` هماهنگ است:

- `VITE_API_CONSOLE_BASE_URL=/api/api-console`
- `VITE_DEV_API_PROXY_TARGET=http://localhost:4174`
- `API_CONSOLE_PORT=4174`

این بخش برای Online API Console کافی است.

## شکاف‌های اصلاح‌شده

### 1. بیشتر صفحات فرانت به بک واقعی وصل نبودند

صفحات زیر از `apps/web/src/services/api.ts` استفاده می‌کنند. این سرویس‌ها اکنون با `createDomainRpcProxy` در browser به `/api/domain/rpc` وصل شده‌اند و در backend اجرا می‌شوند:

- Dashboard
- Test Requests
- Requirements
- Test Cases
- Test Runs / Bugs
- Run Issues
- Checklists
- Releases
- Applications
- Users
- Settings
- Playwright files/runs
- Audit

نمونه‌ها:

- `DashboardPage.tsx` از `dashboardApi`, `testRequestApi`, `bugApi`, `checklistApi`, `releasePublishApi` استفاده می‌کند.
- `TestRequestsPage.tsx` از `testRequestApi`, `requirementApi`, `userApi`, `flowApi` استفاده می‌کند.
- `UsersPage.tsx` از `userApi` و `applicationApi` استفاده می‌کند.
- `SettingsPage.tsx` اطلاعات سیستم را با وضعیت فعلی monorepo نمایش می‌دهد: `React 19.2.6 + Vite 7.3.6`، `Domain RPC + API Console server`، TypeScript 5.9.3 و Playwright 1.55.0.

### 2. گزارش‌های عمومی backend contract نداشتند

`ReportsPage.tsx` برای 20 نوع گزارش عمومی از `reportsApi.ts` استفاده می‌کند. این سرویس از read model فعلی محاسبه می‌کند، اما اکنون از browser به backend domain RPC منتقل شده است.

گزارش `api-usage` همچنان از route اختصاصی API Console خوانده می‌شود.

اثر عملی جدید: گزارش‌ها دیگر browser-local نیستند، اما برای production نهایی بهتر است read modelها مستقیماً از دیتابیس/Prisma تغذیه شوند.

### 3. enforcement نقش و scope برای بیشتر دامنه‌ها server-side نبود

در فرانت، role/context در `authStore.ts` و helperهای دسترسی مثل `canAccessCartable`, `canPerformAction` و `canPerformWorkflowAction` اعمال می‌شود. برای API Console، context با header `x-utms-context` به بک ارسال می‌شود. برای دامنه‌های اصلی، ruleهای موجود در سرویس دامنه اکنون سمت backend اجرا می‌شوند.

اثر عملی جدید: کنترل‌ها دیگر فقط UI-level نیستند، اما auth واقعی production باید token/session معتبر و middleware مستقل داشته باشد.

### 4. مدل داده مشترک کامل نیست

پکیج `packages/contracts` فعلاً فقط pagination، role enum، api error و domain event را export می‌کند. انواع حجیم دامنه در `apps/web/src/types` قرار دارند و بک‌اند عمومی متناظر برای آن‌ها دیده نمی‌شود.

اثر عملی: بین فرانت و بک برای TestRequest، Requirement، TestCase، TestRun، Bug، ReleasePublish، Checklist و Attachment قرارداد TypeScript مشترک و قابل تست وجود ندارد.

### 5. دیتابیس و بک دامنه‌ای از هم جدا مانده‌اند

`database/prisma/schema.prisma` و seedهای دامنه‌ای وجود دارند، اما بک‌اند HTTP فعلی عمدتاً روی فایل‌های runtime API Console کار می‌کند. APIهای عمومی دامنه تست که فرانت لازم دارد هنوز به Prisma/DB وصل نشده‌اند.

اثر عملی: persistence فرانت و persistence بک یکی نیستند. داده‌هایی که کاربر در صفحات اصلی می‌بیند یا تغییر می‌دهد الزاماً در دیتابیس backend ذخیره نمی‌شوند.

## ماتریس هماهنگی ماژول‌ها

| ماژول فرانت | سرویس مصرفی | بک‌اند متناظر | وضعیت جدید |
|---|---|---|---|
| Online API Console | `apiConsoleApi.ts` | `api-console-server.cjs` | هماهنگ |
| Reports / API usage | `apiConsoleApi.getApiUsageReport` | `/api/api-console/reports/api-usage` | هماهنگ |
| Reports / سایر گزارش‌ها | `reportsApi.ts` | `/api/domain/rpc` | هماهنگ با backend RPC |
| Test Requests | `testRequestApi` در `api.ts` | `/api/domain/rpc` | هماهنگ با backend RPC |
| Requirements / Flows | `requirementApi`, `flowApi` در `api.ts` | `/api/domain/rpc` | هماهنگ با backend RPC |
| Test Cases | `testCaseApi` در `api.ts` | `/api/domain/rpc` | هماهنگ با backend RPC |
| Test Runs / Bugs / Retest | `testRunApi`, `bugApi`, `retestTaskApi` | `/api/domain/rpc` | هماهنگ با backend RPC |
| Releases / VersionHistory | `releasePublishApi` / `versionHistoryApi` | `/api/domain/rpc` | هماهنگ با backend RPC |
| Users / Applications | `userApi`, `applicationApi` | `/api/domain/rpc` | هماهنگ با backend RPC |
| Settings / Workflow policy | `systemSettingsApi`, `workflowPolicyApi` | `/api/domain/rpc` | هماهنگ با backend RPC |
| Attachment | `attachmentApi` | `/api/domain/rpc` | هماهنگ با backend RPC |
| Audit / Comments / Notifications | `auditLogApi`, `commentApi`, `notificationApi` | `/api/domain/rpc` | هماهنگ با backend RPC |

## ریسک‌های production باقی‌مانده

1. persistence فعلی backend runtime-file است؛ برای production نهایی باید به Prisma/PostgreSQL منتقل شود.
2. auth واقعی هنوز middleware token/session مستقل برای `/api/domain/rpc` ندارد و به contract آرگومان‌های فعلی سرویس متکی است.
3. قراردادهای DTO مشترک کافی نیستند؛ تغییر در typeهای فرانت می‌تواند بدون شکست تست backend انجام شود.
4. تست‌های API موجود هنوز باید برای سناریوهای دامنه‌ای گسترده‌تر شوند.

## پیشنهاد مسیر اصلاح

1. اولویت 1: تعریف قرارداد backend برای دامنه‌های اصلی
   - `TestRequest`
   - `Requirement`
   - `Flow`
   - `TestCase`
   - `TestRun`
   - `Bug`
   - `ReleasePublish / VersionHistory`
   - `User / Application / RoleAssignment`

2. اولویت 2: انتقال سرویس‌های فرانت از `api.ts` به HTTP client
   - برای هر namespace فعلی، endpoint متناظر بسازید.
   - امضای متدهای فعلی حفظ شود تا تغییر صفحات کم‌ریسک‌تر باشد.
   - خطاها، pagination، idempotency و correlation id در یک client مشترک پیاده شود.

3. اولویت 3: ایجاد contract tests برای هر route دامنه‌ای
   - route inventory باید از API واقعی تولید یا حداقل با تست sync شود.
   - هر صفحه مهم حداقل یک تست contract برای list/create/update/transition داشته باشد.

4. اولویت 4: مهاجرت گزارش‌ها به backend read models
   - گزارش‌های فعلی `reportsApi.ts` به‌عنوان specification اولیه قابل استفاده‌اند.
   - محاسبه reportها باید از DB/read model بک انجام شود، نه mock arrays فرانت.

5. اولویت 5: جداسازی رسمی Mock mode از Production mode
   - تا وقتی migration کامل نشده، `api.ts` باید صریحاً پشت flag محیطی یا adapter interface قرار گیرد.
   - UI بهتر است در production اگر endpoint واقعی موجود نیست، وضعیت unsupported نشان دهد.

## نتیجه نهایی

وضعیت هماهنگی فعلی پس از اصلاح: **سراسری از مسیر backend RPC، با persistence runtime-file**.

فرانت برای تجربه کامل UTMS اکنون فقط browser-local نیست. Online API Console routeهای اختصاصی خود را دارد و ماژول‌های دامنه اصلی از `/api/domain/rpc` عبور می‌کنند. برای production readiness نهایی، مرحله بعدی مهاجرت همین backend RPC از runtime-file/read-model فعلی به endpointهای REST/command واقعی، DTO مشترک، Prisma persistence و middleware auth مستقل است.
