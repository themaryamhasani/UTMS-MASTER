# وضعیت پیاده‌سازی Context نقش و محدوده سامانه

تاریخ: ۱۴۰۵/۰۴/۲۵

## خلاصه تغییر

- Assignmentهای فعال یک کاربر که نقش یکسان دارند به یک Context کاری تبدیل می‌شوند؛ بنابراین یک نقش برای هر سامانه به‌صورت تکراری نمایش داده نمی‌شود.
- Context شامل `contextId`، تمام `assignmentIds[]` و تمام `applications[]` واقعی است. عنوان مصنوعی «چند سامانه» و شناسه ترکیبی سامانه حذف شده است.
- کاربر دارای چند نقش می‌تواند از Header یا Sidebar، بدون خروج از حساب، نقش فعال را تغییر دهد. پس از تغییر، مسیر به Dashboard برمی‌گردد و state مسیر قبلی با کلید `contextId` از نو ساخته می‌شود.
- موجودیت‌های مستقل به یک سامانه واقعی و صریح متصل می‌شوند. در Context سراسری (`APP`) یا چندسامانه‌ای، اولین سامانه دیگر به‌صورت پنهان انتخاب نمی‌شود.
- موجودیت‌های فرزند اجازه انتخاب آزاد سامانه ندارند و `applicationId` خود را از والد معتبر می‌گیرند.
- مسیر قدیمی `/test-runs` برای حفظ سازگاری به کارتابل یکپارچه `/test-runs-bugs` هدایت می‌شود.

## مدل Context در فرانت

منبع پیاده‌سازی `apps/web/src/stores/authStore.ts` است. Contextهای قابل انتخاب بر اساس `user + role` ساخته می‌شوند و اطلاعات زیر را دارند:

| فیلد | معنا |
| --- | --- |
| `contextId` | شناسه client-generated ساخته‌شده از کاربر، نقش و Assignmentهای فعال؛ UI آن را به‌عنوان کلید تعویض Context مصرف می‌کند |
| `assignmentId` | اولین Assignment برای سازگاری با قرارداد قبلی |
| `assignmentIds[]` | تمام Assignmentهای فعالی که در این نقش تجمیع شده‌اند |
| `application` | اولین سامانه واقعی برای سازگاری با مصرف‌کننده‌های قدیمی |
| `applications[]` | تمام سامانه‌های فعال و مجاز در این Context |
| `scopeApplicationIds[]` | شناسه سامانه‌هایی که query و mutation باید به آن‌ها محدود شوند |
| `scope` | `APP` برای همه سامانه‌های فعال یا `SYSTEMS` برای یک/چند سامانه مشخص |

قواعد ساخت و بازیابی Context:

1. کاربر غیرفعال وارد نمی‌شود و Assignment غیرفعال در Context شرکت نمی‌کند.
2. Assignmentهای هم‌نقش تجمیع می‌شوند؛ وجود حداقل یک Assignment با Scope برابر `APP`، Scope نهایی همان نقش را `APP` می‌کند.
3. برای `QA_SPECIALIST`، قابلیت تست خودکار فقط وقتی فعال است که هیچ Assignment تجمیع‌شده‌ای آن را غیرفعال نکرده باشد.
4. در login، refresh و hydration از storage، Context از Assignmentهای فعلی دوباره ساخته می‌شود؛ داده persistشده به‌عنوان مجوز معتبر پذیرفته نمی‌شود.
5. تعویض Context فقط با `contextId` موجود در فهرست بازسازی‌شده انجام می‌شود. در صورت حذف/غیرفعال‌شدن دسترسی، Context فعال پاک می‌شود.

## قواعد انتخاب سامانه در UI

`useDataScope` بین فیلتر خواندن و مقدار اولیه ساخت تفکیک ایجاد کرده است:

| نوع Context | فیلتر خواندن | مقدار اولیه فرم ساخت | رفتار کاربر |
| --- | --- | --- | --- |
| `SYSTEMS` تک‌سامانه‌ای | همان `applicationId` | همان سامانه | انتخاب از قبل مقداردهی می‌شود |
| `SYSTEMS` چندسامانه‌ای | آرایه سامانه‌های مجاز | خالی | انتخاب صریح سامانه الزامی است |
| `APP` | بدون فیلتر شناسه در mock | خالی | انتخاب صریح یک سامانه واقعی الزامی است |

کامپوننت مشترک `ApplicationSelect` برای نقش‌های عادی فقط سامانه‌های فعال و داخل Scope را نمایش می‌دهد. `SYSTEM_ADMIN` طبق سیاست فعلی UI همه سامانه‌های فعال را می‌بیند، حتی اگر Context او `SYSTEMS` باشد. در حالت بارگذاری، نبود سامانه یا شناسه ناشناخته، متن وضعیت به‌جای نمایش ID خام نشان داده می‌شود.

فرم‌های زیر با این قرارداد همگام شده‌اند:

- Test Request و Requirement برای ساخت به سامانه صریح نیاز دارند و در ویرایش اجازه تغییر سامانه موجودیت را نمی‌دهند.
- Test Case ابتدا سامانه را برای محدودکردن Requirement نشان می‌دهد، اما سامانه نهایی از Requirement معتبر مشتق می‌شود.
- Wizard اجرای تست با Test Request شروع می‌شود، سپس Requirementهای همان سامانه و Test Caseهای همان Requirement را بارگذاری می‌کند.
- Playwright Run ابتدا سامانه را می‌گیرد و فقط فایل‌ها، Test Requestها و Test Caseهای همان سامانه را می‌پذیرد. `manualPath=true` می‌تواند مسیر ثبت‌نشده را اجرا کند، اما اگر همان مسیر برای سامانه دیگری ثبت شده باشد باز هم mismatch رد می‌شود.
- API Collection و Import مجموعه Postman به سامانه صریح نیاز دارند؛ Import cURL باید Collection موجود را انتخاب کند.
- ستون سامانه فقط جایی نمایش داده می‌شود که Context بیش از یک سامانه قابل مشاهده دارد.

## زنجیره مالکیت `applicationId`

| موجودیت | منبع سامانه | قاعده یکپارچگی |
| --- | --- | --- |
| Test Request | انتخاب صریح کاربر | Requirementهای انتخابی باید هم‌سامانه باشند |
| Requirement مستقل | انتخاب صریح کاربر | در صورت اتصال به Test Request، سامانه از همان Request می‌آید |
| Test Case | Requirement | Flow باید متعلق به همان Requirement باشد |
| Test Run | Test Request | Requirement و Test Case باید با Request هم‌سامانه باشند |
| Bug | Test Run | تخصیص‌گیرنده باید Developer فعال همان سامانه باشد |
| Run Issue | Test Run | ساخت و resolve فقط داخل Scope Actor مجاز است |
| Playwright File/Run | انتخاب سامانه و فایل ثبت‌شده | فایل، Request و Test Caseهای لینک‌شده باید هم‌سامانه باشند |
| API Collection | انتخاب صریح کاربر | سامانه باید داخل Context فعال باشد |
| API Request | Collection | انتقال Request به Collection سامانه دیگر و تغییر مستقیم سامانه رد می‌شود |

## قیود سرویس mock مدیریت تست

در `apps/web/src/services/api.ts` که دامنه‌های اصلی تست را به‌صورت in-memory همراه IndexedDB/localStorage شبیه‌سازی می‌کند:

- `assertActorApplicationScope` وجود سامانه فعال و عضویت Actor در Scope آن را کنترل می‌کند.
- ساخت یا ویرایش Test Request، Requirement، Test Case، Test Run، Bug، Run Issue و Playwright داده cross-system را رد می‌کند.
- شناسه‌های Requirement تکراری حذف می‌شوند و شناسه مفقود یا خارج از سامانه پذیرفته نمی‌شود.
- Assignee درخواست تست باید `QA_SPECIALIST` یا `QA_LEAD` فعال همان سامانه باشد.
- ثبت یا بروزرسانی یک Role در مدیریت کاربران، Roleهای دیگر کاربر را غیرفعال نمی‌کند؛ Assignmentهای تکراری همان Role ادغام می‌شوند.

این خطاهای دامنه‌ای برای تشخیص نقض Scope استفاده می‌شوند: `APPLICATION_REQUIRED`، `APPLICATION_NOT_FOUND`، `APPLICATION_OUT_OF_SCOPE`، `SELECTED_REQUIREMENT_OUT_OF_SCOPE`، `TEST_REQUEST_OUT_OF_SCOPE`، `TEST_RUN_APPLICATION_MISMATCH`، `BUG_APPLICATION_MISMATCH`، `RUN_ISSUE_APPLICATION_MISMATCH` و `PLAYWRIGHT_APPLICATION_MISMATCH`.

نکته امنیتی: `assertActorApplicationScope` در mock همه Assignmentهای فعال Actor را بررسی می‌کند، نه صرفاً Context انتخاب‌شده Session. این رفتار برای یکپارچگی داده محلی مفید است، اما enforcement دقیق Context فعال یا مرز امنیتی production نیست.

## قیود backend اجرایی Online API Console

در `apps/api/src/modules/api-console/infrastructure/http/api-console-server.cjs`:

- ساخت Collection بدون یک `applicationId` واقعی با پاسخ ۴۲۲ رد می‌شود؛ `ALL`، مقدار خالی و شناسه ترکیبی معتبر نیست.
- سامانه Collection باید در `scopeApplicationIds` Context فعال باشد؛ دسترسی خارج از Scope پاسخ ۴۰۳ می‌گیرد.
- list/read/update فقط Collection و Request داخل Scope فعال و متعلق به کاربر را برمی‌گرداند.
- سامانه Request از Collection مشتق می‌شود؛ جعل `applicationId`، انتقال بین دو سامانه یا تغییر مستقیم سامانه پاسخ ۴۲۲ می‌گیرد.

جزئیات قرارداد و مسیرها در [مستند Online API Console](../api/ONLINE_API_CONSOLE_IMPLEMENTATION.md) نگهداری می‌شود.

## پوشش تست قابل ردیابی

| Test ID | سطح | رفتار تحت پوشش |
| --- | --- | --- |
| `UTMS-AUTH-CONTEXT-020` | E2E | تجمیع نقش تکراری و تعویض نقش بدون logout |
| `UTMS-REQUEST-SCOPE-021` | E2E | الزام انتخاب سامانه و فیلتر Requirementهای Test Request |
| `UTMS-TC-SCOPE-017` | E2E | نمایش هویت سامانه Requirement در ساخت Test Case |
| `UTMS-RUN-SCOPE-018/019` | E2E | زنجیره Request → Requirement → Test Case برای QA Lead/Specialist |
| `UTMS-RUN-SCOPE-015/016` | Structural | فیلتر زنجیره اجرا و رد ارتباط cross-system |
| `UTMS-API-SCOPE-003` | System | رد ساخت Collection خارج از Scope و جعل سامانه Request |

وضعیت اجرای جاری این تست‌ها در [ماتریس پوشش تست](../testing/TEST_COVERAGE_MATRIX.md) ثبت می‌شود.

## محدودیت backend تولیدی

این checkout برای Test Request، Requirement، Test Case، Test Run، Bug، Run Issue و مدیریت Session ماژول backend پایدار ندارد؛ این دامنه‌ها فعلاً در سرویس فرانت و IndexedDB/localStorage هستند. Prisma نیز model و migration اجرایی این دامنه را ندارد. بنابراین قیود `apps/web/src/services/api.ts` جایگزین backend PostgreSQL تولیدی نیستند.

برای تکمیل backend تولیدی باید این قراردادها ساخته شوند:

1. `GET /api/auth/contexts` برای دریافت Assignmentهای فعال همراه نام واقعی سامانه‌ها.
2. `POST /api/auth/context/switch` با ورودی Context ID امضاشده یا شناسه Assignment؛ سرور باید مالکیت و فعال‌بودن آن را بررسی و token/session را rotate کند.
3. endpointهای دامنه تست با FKهای سامانه و کنترل Scope سمت سرور.
4. استخراج `applicationId` موجودیت‌های فرزند از Parent و رد ارتباط cross-system با پاسخ ۴۲۲ یا ۴۰۳.
5. migration برای تجمیع Assignmentهای تکراری `user + role` و نگهداری چند سامانه در جدول واسط.

تا زمان ایجاد این ماژول‌ها، Context فرانت برای UX و سرویس mock برای رفتار محلی معتبر است، اما مرجع امنیت production محسوب نمی‌شود. همچنین `x-utms-context` در Online API Console یک adapter توسعه‌ای است و باید در production با session/JWT امضاشده جایگزین شود.
