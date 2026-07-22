# پیاده‌سازی حالت روشن/شب و دسترس‌پذیری

تاریخ: ۱۴۰۵/۰۴/۲۵

بازبینی مسیرهای source: 2026-07-22

## رفتار کاربر

- کنترل «تغییر حالت نمایش» در صفحه ورود، Header موبایل و Sidebar دسکتاپ در دسترس است.
- انتخاب کاربر با کلید `utms-theme` در `localStorage` ذخیره و پس از refresh حفظ می‌شود.
- اگر انتخاب ذخیره‌شده وجود نداشته باشد، مقدار `prefers-color-scheme` سیستم‌عامل مبنا قرار می‌گیرد و تغییر preference سیستم نیز دنبال می‌شود.
- تغییر storage در tab دیگر، theme tab جاری را همگام می‌کند.
- حالت روشن و شب در viewportهای باریک بدون overflow افقی پشتیبانی می‌شوند.

## معماری اجرا

اسکریپت کوتاه `apps/web/index.html` پیش از mount شدن React، theme اولیه را روی عنصر `html` اعمال می‌کند تا پرش روشن/تیره در شروع صفحه کاهش یابد. سپس `ThemeProvider` منبع state زمان اجرا است.

هر بار اعمال theme این موارد همگام می‌شوند:

| سطح | مقدار روشن | مقدار شب |
| --- | --- | --- |
| `html[data-theme]` | `light` | `dark` |
| کلاس root | بدون `dark` | دارای `dark` |
| CSS `color-scheme` | `light` | `dark` |
| `meta[name="theme-color"]` | `#f8fafc` | `#070d19` |

فایل‌های اصلی:

- `apps/web/src/components/theme/ThemeProvider.tsx`: انتخاب اولیه، persistence، تغییر theme و همگام‌سازی system/storage.
- `apps/web/src/components/theme/ThemeToggle.tsx`: کنترل مشترک با target حداقل ۴۴×۴۴ پیکسل و state قابل تشخیص با `aria-pressed`.
- `apps/web/src/index.css`: tokenها و overrideهای روشن/شب برای layout، فرم، جدول، modal، badge، toast، code block و نمودارها.
- `apps/web/src/main.tsx`: قراردادن کل برنامه داخل `ThemeProvider`.

پیش‌نمایش HTML پاسخ API عمداً با کلاس `theme-light-preview` مستقل از theme سامانه نگه داشته می‌شود. Toggleهای Settings با thumb ثابت و قابل دسترس بازطراحی شده‌اند؛ سایر سوییچ‌های Playwright و فرم‌ها همچنان از کلاس `theme-switch-thumb` استفاده می‌کنند تا در حالت شب قابل رؤیت بمانند.

## اصلاحات دسترس‌پذیری مرتبط

- اسکن Axe از tagهای `wcag2a`، `wcag2aa`، `wcag21aa` و `wcag22aa` استفاده می‌کند.
- کنترل theme با Space و Enter فعال می‌شود و وضعیت آن از طریق `aria-pressed` در دسترس فناوری کمکی است.
- سوییچ‌های Settings دارای `role="switch"`، `aria-checked` و نام قابل دسترس هستند.
- فیلترهای وضعیت در صفحات Release و Playwright نام قابل دسترس صریح دارند.
- Sidebar بسته در موبایل از tree دسترس‌پذیری خارج می‌شود و تنها کنترل theme قابل مشاهده در Header باقی می‌ماند.
- نام سامانه ناشناخته به‌جای نمایش شناسه داخلی با متن «سامانه نامشخص» ارائه می‌شود.

## پوشش تست قابل ردیابی

| Test ID | پروژه | رفتار تحت پوشش |
| --- | --- | --- |
| `UTMS-A11Y-THEME-001` | accessibility-Chromium | انتخاب با keyboard، persistence، preference سیستم، target size، contrast و mobile overflow |
| `UTMS-A11Y-THEME-002` | accessibility-Chromium | Dashboard و modal احراز هویت‌شده در حالت شب |
| `UTMS-A11Y-THEME-003` | accessibility-Chromium | ماتریس تمام ۲۱ مسیر کارتابل و نبود یافته serious/critical در Axe |
| `UTMS-COMP-THEME-003` | compatibility | preference، persistence و layout باریک در پروژه‌های مرورگر نصب‌شده |

وضعیت اجرای جاری و محدودیت browser binaryها در [ماتریس پوشش تست](../testing/TEST_COVERAGE_MATRIX.md) و [فاصله‌های شناخته‌شده](../testing/KNOWN_TEST_GAPS.md) ثبت می‌شود.

## مرز ادعا

تست خودکار Axe و بررسی contrast/target size، جایگزین ارزیابی دستی با screen reader، بزرگ‌نمایی، high-contrast mode یا کاربران واقعی نیست. پشتیبانی Firefox و WebKit فقط وقتی قابل تأیید است که binary پین‌شده آن‌ها نصب و پروژه compatibility با موفقیت اجرا شده باشد.

اسکریپت bootstrap در `apps/web/index.html` به‌صورت inline اجرا می‌شود. در deployment دارای CSP سخت‌گیرانه باید برای آن nonce/hash معتبر تعریف شود یا منطق به asset خارجی مجاز منتقل شود؛ تنظیم فعلی به‌تنهایی اثبات‌کننده انطباق با CSP تولیدی نیست.
