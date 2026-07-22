# UTMS - سند جامع نیازمندی محصول

> وضعیت: مبنای نیازمندی و طراحی محصول. این سند شامل دامنه نهایی و Production-grade است و به معنی پیاده‌سازی کامل همه موارد در checkout فعلی نیست. برای وضعیت واقعی source، routeها و persistence به [Current Implementation](../architecture/CURRENT_IMPLEMENTATION.md) مراجعه کنید. بازبینی مرز پیاده‌سازی: 2026-07-22.

UTMS
سامانه یکپارچه مدیریت کیفیت تست و انتشار
سند جامع تحلیل کسب‌وکار، نیازمندی‌ها، معماری و فرایندهای اجرایی
نسخه نهایی تجمیعی - سامانه کامل سازمانی (بدون محدودیت MVP)
وضعیت سند: مبنای طراحی محصول، UX، Backend، Frontend، Database، API، QA، Security و DevOps
شناسنامه سند
مقدار عنوان
UTMS - Unified Test Quality & Release Management System نام سامانه
تحلیل جامع کسب‌وکار و معماری راهکار نوع سند
نهایی تجمیعی نسخه
فارسی، راست‌به‌چپ زبان و جهت
سامانه واقعی Production-grade؛ همه قابلیت‌های مصوب در محدوده اجرا دامنه
Product، UX، Frontend، Backend، Database، API، QA، Security، DevOps و ذی‌نفعان مخاطبان
VersionHistory؛ عنوان UI: «تصمیم و ثبت انتشار» و دکمه «انتشار جدید» مدل انتشار
مدل پیش‌فرض: QA Lead اعلام نظر و Tech Lead تصمیم نهایی؛ قابل تغییر با WorkflowPolicy سامانه تفکیک مسئولیت انتشار

تاریخچه تصمیمات قطعی
تصمیم قطعی موضوع
سامانه کامل و جامع است؛ هیچ قابلیت مصوبی به MVP یا فاز مبهم موکول نمی‌شود. محدوده محصول
Playwright واقعی از پنل و از طریق Runner/Command کنترل‌شده اجرا می‌شود. تست خودکار
موجودیت انتشار VersionHistory است و Release مستقل ایجاد نمی‌شود. انتشار
فرم انتشار روی Primary Test Request قرار می‌گیرد و کل چرخه و شواهد مرتبط را نمایش می‌دهد. تجمیع داده انتشار
QA Lead نظر کیفی و توضیح را ثبت می‌کند؛ تصمیم نهایی براساس WorkflowPolicy هر Application می‌تواند با Tech Lead/سرپرست فنی یا QA Lead سرپرست باشد. تفکیک وظایف
اختیار ایجاد، اعلام نظر، تصمیم و پذیرش ریسک VersionHistory قابلیت‌محور است و به نقش ثابت Hard-code نمی‌شود. ماژولار بودن انتشار
Context فعال شامل Role + ScopeType + Scope است؛ نقش‌ها در Session با هم Union نمی‌شوند. دسترسی
Scope کل اپ و Scope چندسامانه‌ای هر دو پشتیبانی می‌شوند. دامنه دسترسی
Requirement و Test Case تأیید جداگانه ندارند؛ Completeness محاسباتی و Active Toggle دارند. چرخه داده پایه تست
CDE و فاوا دارای Adapter کامل هستند، ولی تا دریافت Contract/Credential با Feature Flag غیرفعال می‌مانند. Integration
Emergency مسیر مستقل نیست؛ Tag محاسباتی ناشی از Bug بحرانی حل‌نشده است. انتشار اضطراری
حذف رکوردهای کلیدی منطقی/Archive است؛ Snapshot، Revision و Audit حذف‌ناپذیرند. Retention

فهرست مطالب
• ۱. خلاصه مدیریتی
• ۲. معرفی، دامنه و اهداف کسب‌وکار
• ۳. کاربران، نقش‌ها و مدل دسترسی
• ۴. الزامات عملکردی و ماژول‌ها
• ۵. گردش‌کارها و ماشین‌های وضعیت
• ۶. مدل انتشار مبتنی بر VersionHistory
• ۷. گزارش‌ها و داشبوردها
• ۸. مدل داده مفهومی
• ۹. معماری منطقی، اجرایی و استقرار
• ۱۰. سامانه‌های بیرونی و Integration
• ۱۱. امنیت، کارایی، مقیاس‌پذیری و عملیات
• ۱۲. الزامات UI/UX و استانداردهای عمومی
• ۱۳. قواعد کسب‌وکار و معیارهای پذیرش
• ۱۴. محدودیت‌ها، Retention و تصمیمات نهایی
• پیوست‌ها: وضعیت‌ها، تکنیک‌های طراحی تست، ماتریس دسترسی و نمودارها
۱. خلاصه مدیریتی
UTMS یک پلتفرم وب‌محور سازمانی برای مدیریت یکپارچه چرخه کیفیت نرم‌افزار است. این سامانه از ثبت درخواست تست توسط توسعه‌دهنده آغاز می‌شود و مدیریت نیازمندی و جریان، طراحی تست‌کیس، اجرای تست، ثبت چند باگ از یک اجرای ناموفق، مدیریت مشکلات اجرا، رفع و بازآزمون، چک‌لیست امنیتی در سطح تست‌کیس، اجرای واقعی Playwright، ثبت شواهد، اعلام نظر کیفیت و تصمیم نهایی انتشار را در یک زنجیره قابل ردیابی پوشش می‌دهد.
محور اصلی طراحی، تبدیل کنترل‌های پراکنده و دستی به Workflow نقش‌محور، قابل ممیزی، قابل گزارش و قابل تصمیم‌گیری است. هر داده عملیاتی به Application، درخواست تست، نقش فعال و محدوده دسترسی متصل می‌شود. تمام عملیات حساس با Correlation ID و Audit append-only ثبت می‌شوند و فرم تصمیم انتشار تصویر کامل و لحظه‌ای چرخه درخواست را در اختیار QA Lead و مالک تصمیم نهایی WorkflowPolicy قرار می‌دهد.
در این مدل موجودیت مستقل Release حذف شده است. VersionHistory موجودیت فنی چرخه نسخه و انتشار است و در رابط کاربری تحت عنوان «تصمیم و ثبت انتشار» نمایش داده می‌شود. هر VersionHistory الزاماً به یک Primary Test Request متصل است و در UX فعلی فقط یک درخواست تست برای انتشار انتخاب می‌شود. مفهوم Related Test Request در فرم کاربری حذف شده و داده‌ها، آمار، شواهد و تصمیم روی همان درخواست اصلی تجمیع می‌شوند تا کارتابل درخواست‌ها منبع عملیاتی واحد باقی بماند.

شکل ۱ - نمودار زمینه سامانه
این نمودار مرز UTMS، کاربران سازمانی و وابستگی‌های بیرونی را نشان می‌دهد. اتصال CDE و فاوا از طریق Adapter و Feature Flag کنترل می‌شود و Playwright، فایل‌ها و اعلان‌ها اجزای عملیاتی واقعی هستند.
۲. معرفی، دامنه و اهداف کسب‌وکار
۲-۱. معرفی سامانه
UTMS یک سامانه تک‌صفحه‌ای فارسی، راست‌به‌چپ و چندسامانه‌ای است که برای استفاده سازمانی و داده‌های حجیم طراحی می‌شود. تاریخ‌ها در UI شمسی نمایش داده می‌شوند، اما در پایگاه داده با UTC و تقویم Gregorian ذخیره می‌گردند. تمام لیبل‌ها و وضعیت‌های قابل مشاهده برای کاربر فارسی هستند و نام‌های انگلیسی فقط در قراردادهای فنی، Enumها و APIها استفاده می‌شوند.
۲-۲. محدوده کامل محصول
• مدیریت کاربران، استعلام کدملی، نقش‌ها، تخصیص کل اپ یا چند سامانه، رمز عبور و غیرفعال‌سازی.
• مدیریت CRUD سامانه‌ها و داده‌های پایه.
• کارتابل‌های نقش‌محور برای Developer، QA Lead، QA Specialist، BA، Security Reviewer، Tech Lead، Product Owner و System Admin.
• چرخه کامل Test Request، Requirement، Flow، Test Case، Test Run، Bug، Run Issue و Retest Task.
• مدیریت Attachment واقعی در Object Storage با اعتبارسنجی، اسکن امنیتی، کنترل دسترسی و Retention.
• اجرای واقعی Playwright با Discovery، مسیر دستی، Queue، Runner، Log و Artifact.
• کارتابل ساخت فایل تست Playwright برای ایجاد فایل اسکریپت جدید در پوشه‌های خوانده‌شده از ریشه‌های CDE همان سامانه.
• چک‌لیست Security/Performance/Penetration در سطح هر Test Case با Template مدیریتی و Revision.
• VersionHistory، اعلام نظر QA، تصمیم انتشار مبتنی بر WorkflowPolicy، Snapshot اتمیک، Emergency Tag، Lock و Unlock ممیزی‌شده.
• گزارش‌های مدیریتی و عملیاتی، Drill-down، فیلتر، Pagination، Excel/PDF و گزارش زمان‌بندی‌شده.
• Audit، Notification، SLA، Health Check، Observability، Archive و Retention.
۲-۳. اهداف کسب‌وکار
شرح شناسه
حذف فرایندهای اکسل‌محور و فرم‌های پراکنده و تبدیل آن‌ها به Workflow واحد. BG-01
ایجاد Traceability از درخواست تست تا تصمیم انتشار و تمام شواهد میانی. BG-02
کاهش ورود دستی با Auto-fill، داده مرحله قبل، Snapshot و اعتبارسنجی. BG-03
تفکیک مسئولیت QA، توسعه، تحلیل، امنیت، مدیریت فنی و راهبری سیستم. BG-04
جلوگیری از Bug مستقل و اتصال همه باگ‌ها به Test Run ناموفق. BG-05
ایجاد تصمیم انتشار مبتنی بر داده زنده، Revision و Snapshot غیرقابل‌تغییر. BG-06
کاهش زمان چرخه، شناسایی گلوگاه و کنترل SLA. BG-07
پشتیبانی از چند سامانه و نقش‌های متفاوت بدون Union دسترسی در Session. BG-08
قابل ممیزی کردن تغییرات، قفل‌ها، Unlockها و تصمیم‌های پرریسک. BG-09
ایجاد معماری قابل مقیاس و قابل اتصال به CDE، فاوا و Runnerهای مستقل. BG-10

۲-۴. شاخص‌های موفقیت
• هیچ VersionHistory بدون یک Primary Test Request ایجاد نشود و در UI انتشار فقط همان یک درخواست قابل انتخاب باشد.
• هیچ Test Request بدون حداقل یک نیازمندی موجود یا «سایر» قابل ارسال نباشد.
• هیچ Test Case روی Requirement غیرفعال یا ناقص ایجاد/فعال نشود.
• هیچ Bug مستقل از Test Run ناموفق ثبت نشود؛ یک Run می‌تواند چند Bug داشته باشد.
• کلیک Developer روی «رفع شد» Task بازآزمون و رگرسیون و اعلان QA را به‌صورت سیستمی ایجاد کند.
• هیچ تصمیم نهایی بدون اعلام نظر QA، اطلاعات اجباری، Snapshot، Lock، Notification و Audit ثبت نشود.
• Emergency Tag از داده‌های Primary Test Request و باگ‌های متصل به آن به‌صورت خودکار محاسبه و به‌روزرسانی شود.
• ورودی‌های عنوان درخواست، شماره نسخه، شماره بیلد و توضیحات در تمام فرم‌های مربوط Validation یکسان و خطای inline داشته باشند.
• هر Requirement بدون حداقل یک Flow قابل ایجاد/فعال‌سازی نباشد.
• تمام جداول دارای فیلتر، Pagination و خروجی Excel باشند.
• تمام عملیات حساس و ویرایش درخواست ارسال‌شده در تب تاریخچه قابل مشاهده باشد.

شکل ۲ - نمودار C4 Container
اجزای اجرایی اصلی شامل Web Client، Modular Monolith API، Worker، Playwright Runner، پایگاه داده، Cache، Queue، Object Storage و Integration Adapterها هستند.
۳. کاربران، نقش‌ها و مدل دسترسی
۳-۱. نقش‌های هدف
اختیارات و محدودیت اصلی نقش
مدیریت کاربران، نقش‌ها، سامانه‌ها، قالب چک‌لیست، تنظیمات، Audit، Storage و Unlock کنترل‌شده. در Scope کل اپ همه سامانه‌ها را می‌بیند؛ در Scope سامانه فقط داده همان سامانه‌ها را مشاهده می‌کند. تنظیمات حساس فقط برای Admin کل اپ. System Admin
ثبت و ویرایش تمام اطلاعات درخواست در پیش‌نویس و ارسال‌شده، مشاهده نیازمندی‌ها، مشاهده تست‌کیس، رفع باگ‌های تخصیصی، ثبت Fixed Version، استفاده از برد توسعه شبیه Trello و ارسال سیستمی برای بازآزمون/رگرسیون یا ثبت «بدون نیاز به اقدام». Developer
بررسی کامل درخواست، پذیرش/رد/لغو، انتخاب یا ویرایش Tester پس از پذیرش، مدیریت Requirement و Flow، همه اختیارات QA Specialist، اعلام نظر کیفیت، مشاهده گزارش‌های QA و کنترل آمادگی انتشار. QA Lead
طراحی و مدیریت تست‌کیس، اجرای Wizard تست و باگ، ثبت چند Bug، تخصیص Developer، اجرای Retest/Regression، Run Issue و Playwright در محدوده ارجاع. QA Specialist
ایجاد و ویرایش Requirement و Flow، ثبت ابهام در همان ساختار و مشاهده پوشش. تأیید جداگانه وجود ندارد. BA
مشاهده فهرست Test Caseها، تکمیل اختیاری Checklist برای هر Test Case، Attachment و Revision تا قبل از تصمیم نهایی. Security Reviewer
مشاهده Read-only نیازمندی، تست‌کیس، اجرا، باگ و کارتابل انتشار؛ مشاهده کل شواهد فرم انتشار و اتخاذ تصمیم نهایی انتشار/عدم انتشار/بازآزمون در صورت مالک بودن Capability تصمیم. Tech Lead / سرپرست فنی
مشاهده گزارش‌های مدیریتی، Traceability، گزارش تغییرات نسخه و جزئیات مجاز، ثبت Comment append-only؛ بدون Sign-off و بدون تغییر داده عملیاتی. Product Owner

۳-۲. مدیریت کاربر و تخصیص نقش
• System Admin کدملی را وارد می‌کند؛ سامانه از پایگاه داده/سرویس منابع انسانی استعلام کرده و نام و شماره تلفن را Auto-fill می‌کند.
• برای هر Assignment، Role و سطح نقش انتخاب می‌شود: «کل اپ» یا «سامانه».
• در سطح کل اپ، نقش در همه سامانه‌ها اعمال می‌شود و داده‌ها در کارتابل ابتدا به تفکیک سامانه سازمان‌دهی می‌شوند.
• در سطح سامانه، فهرست سامانه‌ها Multi-select است و کاربر فقط داده سامانه‌های منتخب را می‌بیند.
• برای Assignment با نقش QA Specialist، گزینه «نمایش کارتابل‌های تست خودکار و اجازه اجرای Playwright» به‌صورت مستقل ثبت می‌شود. اگر این گزینه غیرفعال باشد، کارشناس تست کارتابل Playwright را نمی‌بیند و اجازه ایجاد اجرای جدید Playwright ندارد؛ سایر اختیارات QA Specialist طبق Scope باقی می‌ماند.
• یک کاربر می‌تواند چند Assignment و چند Role داشته باشد. Assignmentهای فعال هم‌نقش در یک Context تجمیع می‌شوند، اما در هر لحظه فقط یک Context/Role فعال است و مجوز Roleهای مختلف با هم Union نمی‌شود.
• رمز اولیه با سیاست امنیتی ایجاد و در اولین ورود الزاماً تغییر می‌کند؛ ذخیره رمز فقط به‌صورت Hash امن است.
• برای آزمون پذیرش، Mock/Test User برای هر Role، هر Scope Type و سامانه‌های نمونه فراهم می‌شود؛ این داده‌ها از Production جدا هستند.
۳-۳. Active Context
Active Context هدف ساختار فنی زیر را دارد: ContextId + Role + ScopeType + ScopeApplicationIds + AssignmentIds. برای سازگاری، `AssignmentId` و اولین Application نیز می‌توانند در response حضور داشته باشند، اما منبع کامل Scope آرایه‌ها هستند. ScopeType برابر APP یا SYSTEMS است. APP به معنی دسترسی به همه Applicationهای فعال است و SYSTEMS شامل یک یا چند ApplicationId مجاز است. در معماری production، Claims معتبر Context باید از token/session امضاشده سرور استخراج و در هر API، Query، Report، Download و Mutation enforce شود.

شکل ۳ - مدل RBAC چندسامانه‌ای و Active Context
این مدل از Union شدن Roleهای متفاوت جلوگیری می‌کند و هم‌زمان تجمیع Assignmentهای هم‌نقش، دامنه کل اپ و دامنه چندسامانه‌ای را پوشش می‌دهد. تصویر فعلی شکل ۳ مدل تک-Assignment قدیمی را نشان می‌دهد؛ تا بازتولید تصویر، [سند Context و Scope](../migration/SYSTEM_CONTEXT_AND_APPLICATION_SCOPE.md) مرجع به‌روز این بخش است.

شکل ۴ - جریان ورود و انتخاب Context
پس از احراز هویت، Assignmentهای فعال بارگذاری و Assignmentهای هم‌نقش به Contextهای قابل انتخاب تبدیل می‌شوند. کاربر می‌تواند Context را در ورود یا داخل Session تغییر دهد؛ پس از تغییر، مجوزها، منو، Scope داده و state مسیر بر اساس Context جدید بازسازی می‌شوند. تصویر فعلی شکل ۴ جریان قدیمی را نشان می‌دهد و تا بازتولید، سند Context بالا مرجع رفتار جاری است.
۴. الزامات عملکردی و ماژول‌ها
۴-۱. مدیریت سامانه‌ها و داده‌های پایه
• ایجاد، مشاهده، ویرایش، غیرفعال‌سازی و حذف منطقی Application توسط System Admin مجاز.
• Application غیرفعال در انتخاب‌های عملیاتی جدید نمایش داده نمی‌شود ولی در تاریخچه و گزارش باقی می‌ماند.
• تعریف Environment، Priority، Risk، Severity، Test Type، Quality Attribute، Change Level و SLA به‌عنوان داده پایه قابل تنظیم.
• در فرم ایجاد/ویرایش Application در Back-office، سه آدرس CDE برای ریشه فایل‌های تست ثبت می‌شود: آدرس Front سامانه، آدرس Back NodeJS/DataService و آدرس Gateway. نمونه الگوی فعلی CDE: `https://cde.edus.ir/front/directory/medu-community%3EApp` برای Front، `https://cde.edus.ir/dservice/directory/medu-community%3EApp` برای Back NodeJS/DataService و `https://cde.edus.ir/back/medu-ai/medu-community%3E?return=/workspace/medu-ai` برای Gateway. Discovery فایل‌های تست Playwright باید از همین سه ریشه برای همان سامانه انجام شود.
• در کارتابل‌های System Admin کل اپ، ستون «سامانه» برای درخواست، نیازمندی، تست‌کیس، اجرا، باگ، Run Issue، Playwright، VersionHistory، Checklist Review و Audit نمایش داده می‌شود.
۴-۲. مدیریت درخواست تست
• Developer درخواست را در وضعیت پیش‌نویس ایجاد می‌کند و می‌تواند در وضعیت پیش‌نویس و ارسال‌شده تمام فیلدها را ویرایش کند.
• هر ویرایش درخواست ارسال‌شده با Before/After، کاربر، زمان و دلیل در تب تاریخچه ثبت می‌شود.
• فیلدهای اصلی: عنوان، توضیحات، نسخه، شماره بیلد، محیط، اولویت، سطح ریسک، آدرس سامانه، نوع درخواست/هدف تست به‌صورت Multi-select، نیازمندی‌های مرتبط و پیوست.
• عنوان درخواست نباید با فاصله شروع شود و کاراکتر Backtick (`) در هیچ حالت تایپ یا Paste مجاز نیست؛ خطا باید زیر همان ورودی نمایش داده و ورودی قرمز شود.
• شماره نسخه در تمام فرم‌ها باید SemVer معتبر باشد و فقط کاراکترهای انگلیسی مجاز نسخه مانند عدد، حروف انگلیسی، نقطه، خط تیره و علامت + را بپذیرد؛ ورود حروف فارسی مجاز نیست.
• شماره بیلد در تمام فرم‌ها می‌تواند ترکیب حروف، عدد و کاراکترهای چاپ‌پذیر انگلیسی باشد، اما حروف فارسی و کاراکترهای غیر ASCII را نپذیرد.
• تمام ورودی‌های توضیحات در فرم‌های عملیاتی حداکثر ۷۰۰ کاراکتر دارند و Counter شمارش کاراکتر باید کنار همان فیلد نمایش داده شود.
• نوع درخواست/هدف تست شامل تست اولیه، بازآزمون + رگرسیون، تست دود، پذیرش کاربر و تست اکتشافی است.
• انتخاب حداقل یک Requirement اجباری و Multi-select است. گزینه «سایر» امکان ایجاد یک یا چند Requirement جدید را در همان فرم فراهم می‌کند.
• Requirement انتخاب‌شده یا Requirement جدید باید حداقل یک Flow داشته باشد؛ برای Requirement جدید، ثبت حداقل یک Flow با عنوان و توضیح در همان فرایند اجباری است.
• پس از پذیرش درخواست توسط QA Lead، انتخاب Tester در Modal بعدی انجام می‌شود و QA Lead می‌تواند Tester را بعداً ویرایش کند.
• پس از پذیرش درخواست توسط QA Lead، Requirementهای جدید به‌صورت فعال وارد کارتابل نیازمندی می‌شوند.
• درخواست Draft برای هیچ نقش دیگری نمایش داده نمی‌شود. درخواست لغوشده در کارتابل QA Lead و QA Specialist نمایش داده نمی‌شود و فقط با فیلتر تاریخچه/ممیزی قابل دسترسی است.
• عملیات مشاهده برای Developer و بررسی برای QA باید تمام داده‌های ثبت‌شده، Requirementها و Flowها را به‌صورت Accordion نمایش دهد.
• فرم ایجاد جدید باید State قبلی را پاک کند؛ هیچ گزینه‌ای از درخواست قبلی به‌صورت ناخواسته باقی نماند.
• رفع خطای از دست رفتن Focus ورودی‌ها پس از ورود هر کاراکتر جزء معیار پذیرش UI است.

شکل ۵ - فعالیت درخواست تست و نیازمندی جدید
Requirementهای «سایر» ابتدا در محدوده درخواست نگهداری می‌شوند و پس از پذیرش QA Lead به Requirement فعال تبدیل می‌شوند.

شکل ۶ - ماشین وضعیت درخواست تست
وضعیت انتشار نهایی روی همان Primary Test Request منعکس می‌شود و شواهد مرتبط با همان درخواست در فرم انتشار و گزارش‌ها قابل مشاهده باقی می‌مانند.
۴-۳. مدیریت نیازمندی و جریان
• Requirement توسط BA یا QA Lead ایجاد و ویرایش می‌شود و تأیید نقش دیگری لازم ندارد؛ اگر Requirement از مسیر درخواست Developer ایجاد شود نیز ثبت حداقل یک Flow اجباری است.
• وضعیت «کامل/ناقص» محاسباتی است و از تکمیل عنوان، شرح، معیار پذیرش، سناریو/Flow، ریسک و سایر فیلدهای اجباری به دست می‌آید.
• Active Toggle مستقل از Completeness است. Requirement ناقص، بدون Flow یا غیرفعال برای ایجاد Test Case قابل انتخاب نیست.
• فعال‌سازی Requirement فقط زمانی مجاز است که حداقل یک Flow ثبت‌شده داشته باشد؛ در غیر این صورت پیام خطای inline/Toast نمایش داده می‌شود و وضعیت تغییر نمی‌کند.
• Requirement غیرفعال برای نقش‌های عملیاتی مخفی است و فقط QA Lead و System Admin کل اپ آن را می‌بینند؛ Admin صرفاً مدیریتی/ممیزی.
• Developer کارتابل Requirement را Read-only می‌بیند و اجازه فعال/غیرفعال‌سازی ندارد.
• در همان فرم ایجاد/ویرایش Requirement امکان افزودن، ویرایش و حذف منطقی چند Flow وجود دارد و فرم ایجاد با یک Flow خالی پیش‌فرض شروع می‌شود.
• حذف Requirement/Flow باید واقعاً در Backend اعمال شود و پیام موفقیت فقط پس از Commit معتبر نمایش داده شود.
• در هر محل انتخاب Requirement، جزئیات Requirement و تمام Flowهای مرتبط در Accordion نمایش داده می‌شوند.

شکل ۷ - گردش‌کار Requirement و Flow
Completeness محاسباتی و Active Toggle دو مفهوم مستقل هستند و تأیید دستی حذف شده است.
۴-۴. طراحی و مدیریت Test Case
فیلدهای اجباری Test Case: عنوان، نیازمندی، جریان، سناریو، پیش‌شرط‌ها، داده تست، مراحل، نتیجه مورد انتظار، نوع تست، تکنیک طراحی تست، اولویت، سطح ریسک، ویژگی کیفی، کاندید خودکارسازی، کاندید رگرسیون.
• ورودی انتخاب Test Request در فرم Test Case حذف شده است؛ هر Test Case الزاماً به یک Requirement و یک Flow متعلق به همان Requirement متصل می‌شود.
• وجود Test Request روی Requirement انتخاب‌شده برای تعریف Test Case الزامی نیست؛ اگر ارتباط درخواست قابل استنتاج باشد فقط برای Traceability نگهداری می‌شود و شرط ایجاد نیست.
• Test Case تأیید جداگانه یا Draft دستی ندارد؛ Completeness به‌صورت محاسباتی تعیین می‌شود.
• Active Toggle تعیین می‌کند Test Case قابل اجراست یا خیر. Test Case ناقص حتی با Toggle روشن قابل اجرا نیست.
• QA Lead و QA Specialist امکان ایجاد، مشاهده، ویرایش همه فیلدها، Archive و حذف منطقی Test Case را تا قبل از تصمیم نهایی دارند.
• هنگام انتخاب Requirement، Accordion جزئیات Requirement و Flowهای آن نمایش داده می‌شود.
• Tech Lead و Developer Test Case را Read-only مشاهده می‌کنند.
• تغییر Test Case استفاده‌شده در Run نهایی باید Versioning یا Audit کامل داشته باشد.

شکل ۸ - گردش‌کار طراحی Test Case
Ready بودن Test Case از کامل‌بودن فیلدها و فعال بودن Toggle به‌صورت محاسباتی حاصل می‌شود.
۴-۵. Wizard اجرای تست و ثبت باگ
با کلیک روی «اجرای جدید»، یک Wizard دو مرحله‌ای باز می‌شود. فرم مشاهده جزئیات اجرای تست نیز با همین ساختار و UX خوانا نمایش داده می‌شود؛ مرحله دوم به باگ‌های مرتبط اختصاص دارد.
الزام مرحله
انتخاب Test Request اجباری؛ انتخاب Test Case؛ نمایش Accordion Requirement/Flow؛ نسخه؛ شماره بیلد؛ نتیجه؛ اهداف اجرا به‌صورت Multi-select؛ انتخاب Run قبلی در Retest/Regression؛ Accordion اطلاعات Run قبلی؛ Actual Result؛ Attachment. مرحله ۱ - اجرای تست
در نتیجه ناموفق، افزودن یک یا چند Bug؛ عنوان و شرح؛ Severity؛ Priority؛ Developer همان سامانه؛ URL صفحه/مسیر خطا؛ Attachment عکس/ویدئو/PDF/Log؛ مشاهده و دانلود فایل‌ها. مرحله ۲ - ثبت باگ

• Assignee باگ از Developerهای فعال همان Application و Scope انتخاب می‌شود.
• گزینه‌های «لینک ابزار بیرونی» و «شناسه ابزار بیرونی» از UI حذف می‌شوند؛ فیلد «لینک بخش خطا» URL داخل سامانه تحت تست است.
• QA Lead و QA Specialist تا قبل از ثبت نسخه انتشار/تصمیم نهایی می‌توانند تمام ورودی‌های Run را ویرایش کنند؛ نسخه، شماره بیلد، درخواست تست، تست‌کیس، نتیجه، اهداف اجرا، Run قبلی، Actual Result و پیوست‌ها باید در حالت Edit قابل تغییر باشند.
• در ویرایش اجرای تست، باگ‌های ثبت‌شده همان اجرا قابل مشاهده، افزودن، حذف و ویرایش هستند و فیلدهای فرم ویرایش با فرم افزودن باگ یکسان است.
• هر فرمی که Upload پیوست در حالت ایجاد دارد، در حالت ویرایش نیز باید همان امکان Upload/مشاهده پیوست را ارائه کند.
• پس از تصمیم نهایی، ویرایش فقط با Unlock توسط System Admin، دلیل اجباری و Audit مجاز است.
• اگر Fail ناشی از Environment باشد، ثبت Bug اختیاری است و Reason/Comment اجباری خواهد بود.
• Blocked منجر به Run Issue می‌شود و Bug محسوب نمی‌گردد.

شکل ۹ - Wizard اجرای تست و ثبت چند باگ
مرحله دوم فقط در نتیجه ناموفق فعال می‌شود و رابطه TestRun به Bug یک‌به‌چند است.
۴-۶. رفع باگ، Task بازآزمون و رگرسیون
• Developer فقط باگ‌های تخصیص‌یافته خود را مشاهده و وضعیت‌های مجاز، Comment و Fixed Version را ویرایش می‌کند.
• برای Developer یک برد توسعه شبیه Trello وجود دارد که ستون‌های «برای انجام»، «در حال رفع»، «آماده تست»، «نیازمند اقدام مجدد» و «بدون نیاز به اقدام» را نمایش می‌دهد.
• در برد توسعه، Drag & Drop روی کل کارت باگ انجام می‌شود؛ هنگام Drag کارت انتخاب‌شده باید حالت بصری فعال، سایه، بزرگ/کوچک‌شدن ملایم و چرخش جزئی داشته باشد و کاربر بتواند آن را روی ستون مقصد رها کند.
• وضعیت «بدون نیاز به اقدام» در هر وضعیت عملیاتی باگ برای Developer قابل انتخاب است و دلیل آن اجباری ثبت می‌شود. این وضعیت در گزارش‌های باگ باز، مانند وضعیت بسته/ردشده غیرمسدودکننده محاسبه می‌شود.
• گزینه «باگ نیست» نیز برای Developer در گردش‌کار و برد توسعه قابل انتخاب است و با دلیل اجباری به وضعیت ردشده تبدیل می‌شود.
• اگر هنگام تعریف Bug، Developer تخصیص داده شده باشد، مرحله ارجاع جداگانه و انتخاب Developer دیگر نمایش داده نمی‌شود و باگ مستقیم وارد وضعیت تخصیص‌یافته/مرحله بعدی می‌شود.
• با کلیک روی «رفع شد»، Backend به‌صورت اتمیک وضعیت باگ را به «ارسال برای تست مجدد و رگرسیون» تغییر می‌دهد.
• سیستم RetestTask/Queue Item برای QA مسئول ایجاد می‌کند و Notification ارسال می‌شود.
• Test Run جدید هنگام شروع کار توسط QA ساخته می‌شود؛ ایجاد Task به معنی ایجاد Run خالی نیست.
• QA از داخل Task می‌تواند Wizard اجرا را با هدف‌های Retest و Regression و Run قبلی پیش‌پرشده باز کند.
• نتیجه موفق باگ را می‌بندد؛ نتیجه ناموفق باگ را به Reopened/Retest Failed برمی‌گرداند.
• در مشاهده جزئیات Bug، فایل‌های پیوست‌شده باید با UX قابل فهم شامل نام فایل، نوع، اندازه، زمان بارگذاری، وضعیت و لینک مشاهده/دانلود نمایش داده شوند.

شکل ۱۰ - ماشین وضعیت Bug
حالت «ارسال برای تست مجدد و رگرسیون» نقطه تحویل کنترل‌شده از Developer به QA و منشأ ایجاد Task است. وضعیت «بدون نیاز به اقدام» خروج کنترل‌شده Developer برای مواردی است که نیاز به تغییر توسعه ندارد و باید با دلیل قابل ممیزی ثبت شود.
۴-۷. Run Issue
Run Issue موجودیتی مستقل برای موانع Environment، Access، Data و Dependency است. الزاماً به Developer تخصیص نمی‌یابد و QA Lead مسئول پیگیری یا نقش مناسب را تعیین می‌کند. Resolve شدن Run Issue اجرای مجدد را مجاز می‌کند و تمام تغییرات Audit می‌شوند.

شکل ۱۱ - جریان Run Issue
Run Issue جایگزین ثبت Bug برای موانع غیرمحصولی است و پس از رفع مانع به اجرای مجدد منتهی می‌شود.
۴-۸. Attachment و Artifact
• Evidence مستقل وجود ندارد و Attachment سازوکار واحد شواهد است.
• انواع: تصویر، Log، ویدئو، گزارش، Trace، سند و سایر.
• وضعیت‌ها: بارگذاری‌شده، معتبر، نامعتبر و حذف‌شده منطقی.
• فایل در Object Storage و Metadata شامل Entity، Application، نوع، اندازه، Hash، MIME، مالک، وضعیت و سطح دسترسی در Database ذخیره می‌شود.
• محدودیت حجم، تعداد، پسوند، MIME و اسکن Malware قابل تنظیم است.
• فایل‌های مجاز در UI قابل مشاهده/پیش‌نمایش/دانلود هستند و Download نیز Scope-aware و Audit‌شده است.
• در فرم‌های View/Edit، پیوست‌ها باید به‌صورت لیست کاربرپسند و قابل اقدام نمایش داده شوند و کاربر مجاز بتواند پیوست جدید اضافه کند.
• حذف فیزیکی ممنوع است و Retention/Legal Hold باید رعایت شود.

شکل ۱۲ - چرخه عمر Attachment
از Upload تا Validation، استفاده، Lock، حذف منطقی و Archive همه مراحل Audit می‌شوند.
۴-۹. Playwright واقعی
• QA Lead و QA Specialist دارای مجوز تست خودکار در محدوده ارجاع می‌توانند اجرای جدید ایجاد کنند.
• انتخاب Application، Environment، Test Request و Test Caseهای مرتبط پشتیبانی می‌شود.
• Discovery واقعی Test Repository انجام می‌شود و برای هر Application ابتدا ریشه‌های CDE ثبت‌شده در Back-office شامل Front، Back NodeJS/DataService و Gateway خوانده می‌شوند؛ در صورت نبود Discovery، مسیر دستی مجاز است.
• فایل‌هایی که در کارتابل «فایل تست Playwright» ساخته یا ویرایش می‌شوند باید در فرم اجرای جدید همان Scope در یک لیست انتخاب ساده و واکنش‌گرا قابل انتخاب باشند و حتی در صورت غیرفعال بودن Auto Discovery نیز برای اجرا در دسترس باشند.
• در فرم اجرای جدید، تنظیمات Playwright باید به‌صورت کاربرپسند و بدون نیاز به نوشتن command خام ارائه شود: Browser/Project چندانتخابی برای Chromium/Firefox/WebKit، حالت Headed، تعداد Worker، Retry، Max Failures، Trace و Reporter. سامانه باید همین انتخاب‌ها را به optionهای استاندارد Playwright مثل `--project=chromium`، `--headed`، `--workers=2`، `--retries=2`، `--max-failures=3`، `--trace=retain-on-failure` و `--reporter=html` تبدیل کند.
• انتخاب Reporter باید عملیاتی باشد: اگر HTML انتخاب شود Artifact گزارش HTML، اگر JSON انتخاب شود Artifact گزارش JSON و اگر JUnit انتخاب شود Artifact گزارش XML/JUnit تولید و به همان PlaywrightRun متصل می‌شود.
• در مودال مشاهده اجرای Playwright، گزارش خروجی باید مطابق Reporter انتخاب‌شده نمایش داده شود و فایل گزارش قابل دانلود باشد. اطلاعات تکراری بین خلاصه Run، گزارش و Artifactها نباید دوباره نمایش داده شود. در اجرای ناموفق، گزارش باید مشابه Playwright نام تست Fail شده، Project، مسیر فایل، شماره خط/ستون اسکریپت، پیام خطا و Code Frame همان بخش اسکریپت را نمایش دهد. گزارش همچنین باید لیست اسمی تست‌های Passed، Skipped/نادیده‌شده و Cancelled/لغوشده را نشان دهد.
• نقش‌هایی که دسترسی اجرای Playwright دارند، کارتابل «فایل تست Playwright» را می‌بینند. نمای پیش‌فرض این کارتابل لیست همه فایل‌های تست کشف‌شده از CDE و فایل‌های ساخته/ویرایش‌شده در UTMS است. با کلیک روی «ایجاد فایل»، فرم ساخت باز می‌شود؛ در این فرم کاربر ابتدا Application، سپس پوشه مقصد خوانده‌شده از ریشه‌های CDE همان Application را انتخاب می‌کند، نام فایل را با الگوی `kebab-case.spec.ts` وارد می‌کند و اسکریپت Playwright را در محیط ویرایش کد شبیه VS Code می‌نویسد.
• نام فایل تست فقط حروف کوچک انگلیسی، عدد و خط تیره را می‌پذیرد و الزاماً باید با `.spec.ts` تمام شود؛ مثل `login-flow.spec.ts`. ورود فاصله، حروف فارسی و کاراکترهای غیر ASCII در نام فایل مجاز نیست.
• فرم ساخت/ویرایش فایل تست باید امکان ویرایش همه اطلاعات شامل Application، پوشه مقصد، نام فایل، توضیحات و اسکریپت را داشته باشد. مسیر نهایی فایل، ریشه CDE انتخاب‌شده، توضیحات اختیاری با محدودیت ۷۰۰ کاراکتر و خطاهای inline باید نمایش داده شود. ذخیره و ویرایش فایل باید Audit شود و در بک‌اند واقعی از طریق Adapter به CDE/Test Repository متصل گردد.
• Execution به‌صورت Async از طریق Queue و Runner انجام می‌شود و UI قفل نمی‌شود.
• Command، Working Directory، Timeout، Environment Variable و Secret Reference توسط System Admin مدیریت می‌شود؛ Secret هرگز در Log نمایش داده نمی‌شود.
• Log، Screenshot، Trace و Report در Object Storage ذخیره و به Run مرتبط می‌شوند.
• Run ناموفق امکان ثبت یک یا چند Bug از Automated Run را دارد.
• Runner قابل Scale افقی و جداشدن از Modular Monolith است.

شکل ۱۳ - جریان اجرای Playwright
Job از پنل به Queue و Runner ارسال می‌شود و Artifactها پس از اجرا در Object Storage قرار می‌گیرند.
۴-۱۰. چک‌لیست امنیتی در سطح Test Case
• برای هر Test Case یک مدخل قابل مشاهده در کارتابل Security Reviewer وجود دارد، ولی تکمیل Checklist اختیاری است.
• در Scope کل اپ ابتدا فهرست Applicationها و سپس Test Caseهای سامانه منتخب نمایش داده می‌شوند.
• Checklist می‌تواند Security، Performance و Penetration را پوشش دهد.
• هر Save یک Revision append-only ایجاد می‌کند و تا قبل از تصمیم نهایی قابل ویرایش است.
• System Admin کل اپ Back-office قالب را برای افزودن، ویرایش، ترتیب و حذف منطقی آیتم‌ها مدیریت می‌کند.
• نتایج Checklistهای Test Caseهای مرتبط در فرم تصمیم انتشار تجمیع می‌شوند و بلاکر اجباری نیستند.

شکل ۱۴ - جریان بازبینی امنیت
قالب چک‌لیست از Back-office مدیریت می‌شود و Reviewهای هر Test Case در Snapshot انتشار تجمیع می‌شوند.
۵. مدل انتشار مبتنی بر VersionHistory
۵-۱. اصول دامنه
• Release مستقل وجود ندارد. VersionHistory موجودیت فنی و کارتابل «تصمیم و ثبت انتشار» نمای عملیاتی آن است.
• دکمه ایجاد در UI با عنوان «انتشار جدید» نمایش داده می‌شود.
• هر VersionHistory دقیقاً یک Primary Test Request دارد؛ در فرم انتشار فقط یک درخواست تست از لیست تمام درخواست‌های مجاز انتخاب می‌شود.
• بخش یا ورودی Related Test Requests هم‌نسخه/هم‌بیلد در UX حذف شده است و کاربر نیازی به کلیک روی گزینه جداگانه «ایجاد VersionHistory» ندارد؛ انتخاب درخواست تست، VersionHistory را با اطلاعات همان صفحه آماده می‌کند.
• فرم انتشار از روی همان درخواست تست اصلی ساخته می‌شود و در پنل Developer به‌صورت Read-only نمایش داده می‌شود تا Developer فقط ببیند درخواست او Publish/Version شده یا نه.
• نظر QA و نتیجه نهایی علاوه بر VersionHistory در نمای وضعیت Primary Test Request منعکس می‌شوند.
• فرم انتشار باید تمام چرخه Primary Request را نمایش دهد: اطلاعات درخواست، Requirement/Flow، Test Case، Run، Bug، Retest، Run Issue، Checklist، Attachment، Playwright، Comment، Audit، آمار کیفیت و تعداد اجراهای گرفته‌شده روی همان درخواست.
• آمارهای فرم انتشار باید Drill-down اسمی داشته باشند؛ کاربر با کلیک روی شمارنده Test Case، Run، Bug یا هر لیبل آماری، لیست رکوردهای مرتبط را با نام و وضعیت مشاهده می‌کند.
• لیبل داخلی «سیاست گردش‌کار انتشار» در UI کاربر نهایی نمایش داده نمی‌شود؛ مالک اعلام نظر/تصمیم فقط در عنوان یا متن عملیاتی همان اقدام نمایش داده می‌شود.
۵-۲. اعلام نظر QA Lead
معنا وضعیت فارسی
تست‌ها و شواهد برای تصمیم انتشار کافی و قابل قبول‌اند. آماده انتشار
انتشار با ریسک‌ها/شرایط مشخص قابل توصیه است. آماده انتشار مشروط
کیفیت فعلی برای انتشار قابل قبول نیست. آماده انتشار نیست
تست لازم اجرا نشده یا شواهد کافی وجود ندارد. تست اجرا نشده

ثبت اعلام نظر QA نیازمند توضیح اجباری است. حداقل یک Test Case باید اجرا شده باشد؛ در غیر این صورت فقط «تست اجرا نشده» مجاز است. گزینه‌های غیرتصمیمی مانند «شروع نشده» و «در حال بررسی» در Modal وضعیت کیفیت نمایش داده نمی‌شوند. Modal وضعیت کیفیت باید جزئیات کامل درخواست تست و داده‌های ثبت‌شده در فرم درخواست را نیز در اختیار کاربر قرار دهد. ثبت نظر یک VersionHistoryRevision غیرقابل‌تغییر ایجاد می‌کند و فرم را وارد وضعیت منتظر تصمیم مالک نهایی WorkflowPolicy می‌نماید.
۵-۳. تصمیم نهایی انتشار براساس WorkflowPolicy
الزامات تصمیم
تاریخ انتشار، SemVer منتشرشده، Build Metadata، Rollback Plan، Decision Note و در حالت Emergency دلیل/ریسک/پذیرش ریسک. انتشار
دلیل عدم انتشار، پیام برای Developer و Decision Note. عدم انتشار
دلیل، Scope بازآزمون، پیام QA، پیام Developer و Decision Note؛ پیام Security اختیاری. نیازمند بازآزمون

تصمیم نهایی باید در یک Transaction اتمیک، Decision Snapshot، تغییر وضعیت VersionHistory و Primary Test Request، Lock Runها، Notificationها و Audit را ثبت کند. برای خروج از کارتابل یا اقدام‌های حساس، Confirm باید به‌صورت Modal داخلی سامانه باشد و استفاده از Alert/Confirm مرورگر یا پنجره سیستم مجاز نیست.

شکل ۱۵ - گردش‌کار VersionHistory و تصمیم انتشار
فرم انتشار به یک درخواست تست اصلی متصل است و کل چرخه داده را پیش از اعلام نظر QA و تصمیم مالک نهایی WorkflowPolicy تجمیع می‌کند.

شکل ۱۶ - ماشین وضعیت VersionHistory
در تصمیم نیازمند بازآزمون، همان VersionHistory به Draft بازمی‌گردد و رکورد جدید ساخته نمی‌شود.
۵-۴. Emergency Tag
Emergency یک Tag محاسباتی است، نه Workflow مستقل. اگر در Primary Request حداقل یک Bug با Severity بحرانی وجود داشته باشد که هنوز به «تأیید بازآزمون/بسته‌شده»، «ردشده» یا «بدون نیاز به اقدام» نرسیده باشد، Tag اضطراری فعال می‌شود. Emergency مانع تصمیم انتشار نیست، اما مالک تصمیم باید دلیل اضطرار، شرح ریسک، فهرست باگ‌های باز و پذیرش صریح ریسک را ثبت کند.
پذیرش ریسک اضطراری نباید به‌صورت یک دکمه ساده باشد؛ باید یک چک‌لیست اجباری نمایش داده شود و پس از انتخاب چک‌لیست، ورودی‌های دلیل اضطرار، شرح ریسک و تأیید پذیرش ریسک برای تکمیل نمایش داده شوند.

شکل ۱۷ - منطق انتشار اضطراری
Emergency به‌صورت خودکار از داده‌های Bug محاسبه می‌شود و در صورت انتشار، الزامات پذیرش ریسک را فعال می‌کند.
۵-۵. Quality Score
امتیاز کیفیت برای کمک به تصمیم و نه جایگزینی تصمیم انسانی محاسبه می‌شود: Base Pass Rate = (Passed / Total Executed) × 100؛ Bug Penalty مجموع حاصل‌ضرب Severity Base، Risk Multiplier و Verification Factor است؛ Quality Score برابر round(clamp(Base Pass Rate - Bug Penalty, 0, 100), 2) است.
مقادیر عامل
Critical=25، Major=10، Minor=3، Trivial=1 Severity Base
Critical=1.50، High=1.25، Medium=1.00، Low=0.75 Risk Multiplier
باز/درحال‌رفع/بازگشایی=1؛ رفع‌شده/آماده بازآزمون=0.5؛ بسته/رد/بدون نیاز به اقدام=0 Verification Factor
Pass، Fail، Blocked و Skipped در مخرج؛ Pending و In Progress خارج از مخرج Executed Cases
در صورت صفر بودن اجرای معتبر، امتیاز صفر و Submit QA مسدود است. Zero Executed

۶. گزارش‌ها، داشبوردها و کارتابل‌ها
۶-۱. اصول گزارش‌گیری
• هر گزارش دو لایه دارد: آماری/مدیریتی و اسمی/عملیاتی با Drill-down.
• گزارش‌های نقش سطح کل اپ ابتدا تجمیع کل و سپس تفکیک Application را نمایش می‌دهند.
• تمام گزارش‌ها دارای فیلتر بازه زمانی، سامانه، نقش، شخص، وضعیت و فیلترهای متناسب با سرستون‌ها هستند.
• تمام جداول Server-side Pagination، Sort و Filter دارند؛ اندازه صفحه حداقل ۳۰، ۷۰ و ۱۰۰ رکورد قابل انتخاب است.
• تمام جداول خروجی Excel دارند؛ خروجی PDF، Scheduled Report، Alert و Audit Export برای گزارش‌های مجاز پشتیبانی می‌شود.
• Product Owner داده‌های تجمیعی را می‌بیند و Log/Trace یا جزئیات امنیتی فقط با مجوز جداگانه نمایش داده می‌شود.
• همه نقش‌ها در محدوده مجاز خود به گزارش تغییرات هر نسخه/VersionHistory دسترسی دارند؛ سطح جزئیات با Role و Scope کنترل می‌شود.
• مدیران سامانه شامل Product Owner، Tech Lead، QA Lead و System Admin به گزارش Traceability از Test Request تا Requirement، Flow، Test Case، Run، Bug، Checklist، Attachment و VersionHistory دسترسی دارند.
• شاخص‌های قابل کلیک مانند تعداد Test Case، اجرای تست، باگ، Run Issue و Checklist باید Drill-down اسمی داشته باشند و فقط عدد خام نمایش ندهند.
مخاطب شاخص‌های اصلی گزارش
PO، Tech Lead، QA Lead، Admin تعداد و وضعیت Test Request، Run، Bug، Run Issue، VersionHistory، Playwright، Attachment و Audit؛ لیست درخواست‌های باز و سن وضعیت. داشبورد کلان
Tech Lead، QA Lead، PO Pass/Fail/Blocked Rate، Critical/Major باز، Reopen، Retest Success، Requirement/Flow Coverage، Playwright و Checklist. سلامت کیفیت سامانه
Tech Lead، QA Lead، PO نظر QA، Runها، Pass Rate، Failed/Blocked، باگ باز، Checklist، Playwright، Attachment Completeness و Emergency. آمادگی انتشار
QA Lead، Tech Lead، PO تعداد درخواست، نقص ورودی، زمان Draft، Reject، Bug تولیدشده و Emergency. عملکرد Developer - درخواست
QA Lead، Tech Lead Assigned/Fixed، Mean Fix Time، Reopen Rate، Critical/Major باز و Fixed Version. عملکرد Developer - اصلاح باگ
BA، QA Lead، PO، Tech Lead Draft محاسباتی/ناقص، زمان تکمیل، بدون Flow، ابهام، Coverage و Gap. Requirement و Flow
QA Lead، Tech Lead منتظر Review، زمان Review، Assignment، بدون مسئول، منتظر نظر کیفیت و برگشت به BA/Developer. کارتابل QA Lead
QA Lead، Tech Lead، PO آماده، مشروط، آماده نیست، اجرا نشده، انتشار با باگ باز یا Checklist ناقص. کیفیت تصمیم QA
QA Lead تعداد، Completeness، High Risk، Regression/Automation Candidate و Attachment. طراحی Test Case
QA Lead، Tech Lead Pass/Fail/Blocked، مدت، بدون Attachment، Fail بدون Bug مجاز و Run Issue. اجرای Test Run
QA Lead تعداد، Critical/Major، Duplicate/Rejected، Reopened، بدون Attachment و زمان Fail تا Bug. کیفیت ثبت Bug
Security، QA Lead، Tech Lead Assigned/Completed/Pending/Concern، زمان تکمیل، Attachment و VersionHistory با Review ناقص. Security Review
Tech Lead، PO، QA Lead انتشار/عدم انتشار/بازآزمون، زمان تصمیم، باگ باز، Checklist ناقص و مستندات تصمیم. تصمیم انتشار
Tech Lead، PO، QA Lead، Admin تعداد Emergency، دلایل پرتکرار، باگ بحرانی، وضعیت QA و نسبت Emergency. ریسک اضطراری
Admin Active/Inactive، Assignment، Multi-role، Multi-system، Coverage Gap و تغییرات RBAC. کاربران و نقش‌ها
Admin و ناظر مجاز عملیات حساس، خارج ساعات کاری، Before/After، IP و Correlation ID. Audit Trail
Admin، QA Lead تعداد، حجم، نوع، Invalid، Deleted، فرم‌های حساس بدون فایل و مصرف Application. Attachment/Storage
QA، Tech Lead، Admin Run، Success/Fail، Timeout/Error، Duration، فایل ناپایدار، Bug و Artifact. Playwright
QA Lead، Tech Lead، PO، Admin زمان هر مرحله، رکوردهای متوقف، مسئول فعلی، SLA Breach و Aging. گلوگاه و SLA
PO، QA Lead، Tech Lead Commentهای VersionHistory، موارد باز، بی‌پاسخ و موضوع پرتکرار. بازخورد Product Owner
همه نقش‌ها در Scope مجاز نسخه، Build، وضعیت QA، تصمیم نهایی، تصمیم‌گیرنده، تغییرات ثبت‌شده، Commentها، Snapshot و وضعیت Publish. گزارش تغییرات نسخه
مدیران مجاز مسیر Test Request → Requirement → Flow → Test Case → Test Run → Bug/Run Issue → Checklist/Attachment → VersionHistory با وضعیت هر گره و شکاف‌های پوشش. گزارش Traceability مدیریتی

۶-۲. نمودارهای داشبورد
• Test Request بر اساس وضعیت و روند زمانی
• Pass/Fail/Blocked Run
• Bug بر اساس Severity و Developer
• زمان اصلاح و Reopen Rate
• VersionHistory بر اساس تصمیم
• Emergency Trend
• Playwright Success Rate
• SLA Breach by Role
• Workload by QA Specialist
• Requirement و Flow Coverage
• Traceability Coverage
• Version Change History
• Audit Events by User
• Storage Usage by Application
• Top Defect Areas
۷. مدل داده مفهومی
مدل داده بر ApplicationId، Traceability و Versioning استوار است. کلیدهای خارجی باید از اتصال داده میان سامانه‌های خارج از Scope جلوگیری کنند. تمام موجودیت‌های عملیاتی دارای CreatedAt/By، UpdatedAt/By، RowVersion و وضعیت حذف منطقی هستند؛ Snapshot، Revision و Audit append-only هستند.
شرح موجودیت
سامانه/محصول نرم‌افزاری و تنظیمات دامنه. Application
هویت کاربر، کدملی، نام، تلفن، وضعیت و اطلاعات امنیتی. User
Role، ScopeType، مجموعه Applicationها، وضعیت و تاریخ اعتبار. UserRoleAssignment
Context جاری Session؛ در DB دائمی نیست مگر برای Session Management. ActiveContext
درخواست اصلی Developer و نقطه محوری فرایند. TestRequest
رابط چندبه‌چند درخواست و نیازمندی؛ شامل Origin=Existing/Other. TestRequestRequirement
نیازمندی، Completeness محاسباتی و Active Toggle. Requirement
جریان‌های وابسته به Requirement. Flow
طراحی تست، Completeness محاسباتی و Active Toggle. TestCase
اجرای دستی یا Retest/Regression و لینک Run قبلی. TestRun
باگ وابسته به Run ناموفق؛ چند باگ برای یک Run. Bug
صف کار QA پس از رفع Bug؛ Run هنگام Start ساخته می‌شود. RetestTask
مانع Environment/Access/Data/Dependency. RunIssue
Metadata فایل و پیوند polymorphic به Entity. Attachment
قالب مدیریتی بازبینی. ChecklistTemplate/Item
بازبینی هر Test Case و Revisionهای آن. ChecklistReview/Revision
اجرای خودکار، Command Reference، Status و Artifact. PlaywrightRun
رکورد نسخه و تصمیم انتشار با Primary Request. VersionHistory
فیلد legacy/داخلی برای سازگاری با داده‌های قدیمی؛ در UX فعلی الزام یا انتخاب Related Request وجود ندارد و مسیر محصول بر Primary Test Request واحد است. VersionHistoryRelatedRequest
اعلام نظر QA و Revisionهای قبل از تصمیم. VersionHistoryRevision
Snapshot غیرقابل‌تغییر تصمیم نهایی انتشار. ReleaseDecisionSnapshot
Comment مجاز؛ برای PO append-only. Comment
اعلان In-App/Email/SMS و وضعیت تحویل. Notification
رخداد append-only با Context، Before/After و Correlation. AuditEvent
فعال‌سازی و تنظیم Adapterهای CDE/Fava و سایر اتصال‌ها. FeatureFlag/IntegrationConfig
SLA سراسری و Override سامانه/Severity/Priority. SlaPolicy

شکل ۱۸ - ERD مفهومی
روابط اصلی نشان می‌دهند که VersionHistory بر Primary Test Request بنا می‌شود، TestRun چند Bug دارد و RetestTask موجودیتی جدا از Run است.
۸. معماری منطقی، اجرایی و استقرار
۸-۱. سبک معماری
Backend در شروع به‌صورت Modular Monolith با مرزهای دامنه روشن پیاده‌سازی می‌شود. ماژول‌های Playwright Runner، گزارش‌های سنگین، اعلان و Integration Worker از ابتدا Async و قابل استخراج به سرویس مستقل طراحی می‌شوند. تراکنش‌های درون دامنه در یک پایگاه داده رابطه‌ای انجام می‌شوند و برای خواندن گزارش‌های حجیم Read Model و Materialized View استفاده می‌شود.

شکل ۱۹ - مؤلفه‌های هسته Backend
API Layer مسئول Validation، Idempotency و Context Enforcement است و ماژول VersionHistory داده تمام ماژول‌های کیفیت را برای تصمیم تجمیع می‌کند.
۸-۲. API و قراردادهای فنی
• APIها REST/JSON با Versioning و OpenAPI هستند؛ امکان استفاده از Query API برای گزارش‌های پیچیده مجاز است.
• همه Mutationهای حساس Idempotency-Key و Correlation-ID می‌پذیرند.
• Optimistic Concurrency با RowVersion/ETag برای جلوگیری از Lost Update اعمال می‌شود.
• خطاها با Problem Details استاندارد و پیام فارسی کاربرپسند بازگردانده می‌شوند؛ Stack Trace افشا نمی‌شود.
• Validation سمت Backend باید هم‌ارز UI باشد: SemVer برای نسخه، ممنوعیت کاراکتر فارسی در Version/Build، ممنوعیت فاصله اول و Backtick در عنوان درخواست، سقف ۷۰۰ کاراکتر توضیحات و الزام Flow برای Requirement.
• فیلتر، Sort و Pagination Server-side است و هیچ Endpoint بدون Context Filter داده عملیاتی برنمی‌گرداند.
• دانلود Attachment با URL امضاشده کوتاه‌عمر یا Streaming کنترل‌شده انجام می‌شود.
• تصمیم انتشار یک Command اتمیک است و در صورت شکست هیچ Snapshot/Status/Lock ناقصی باقی نمی‌ماند.
• Outbox Pattern برای هماهنگی Transaction با Queue/Notification/Audit توصیه و الزامی است.
۸-۳. استقرار و زیرساخت

شکل ۲۰ - Deployment Diagram
API به‌صورت افقی Scale می‌شود، Worker و Runner Pool مستقل هستند و داده عملیاتی، Read Replica، Cache، Queue، Object Storage و Audit Store در Zone داده قرار می‌گیرند.
۸-۴. DFD و Use Case

شکل ۲۱ - نمودار Use Case
تفکیک اختیارات نشان می‌دهد QA Lead تهیه و اعلام نظر را بر عهده دارد و مالک تصمیم نهایی انتشار بر اساس WorkflowPolicy هر Application تعیین می‌شود.

شکل ۲۲ - DFD سطح صفر
تعامل کلی کاربران، UTMS، سرویس‌های بیرونی و مخازن داده را نمایش می‌دهد.

شکل ۲۳ - DFD سطح یک
جریان داده در هفت فرایند اصلی از هویت تا گزارش و Audit تفکیک شده است.
۹. سامانه‌ها و سرویس‌های خارجی
وضعیت کاربرد و قرارداد سیستم
فعال و الزامی استعلام کدملی و دریافت نام/شماره تلفن. قرارداد خطا، Timeout، Cache و Audit لازم است. سامانه هویت/منابع انسانی
آماده و Feature-flagged Application، Version/Build، Environment، Deploy/Publish Status و Last Sync. Adapter کامل؛ تا دریافت Contract/Credential با Feature Flag خاموش. CDE
آماده و Feature-flagged ارسال Bug، External Task ID، Sync Status و Retry. Adapter کامل؛ تا دریافت Contract/Credential خاموش. فاوا
فعال اجرای واقعی Command، Discovery، Timeout، Cancel، Log و Artifact. Playwright Runner
فعال Discovery و مدیریت مسیر تست‌های خودکار. Test Repository
فعال In-App، SMS و Email برای Assignment، Bug، Retest، Checklist و تصمیم انتشار. Notification Service
فعال نگهداری Attachment و Artifact با Encryption، Versioning و Retention. Object Storage
قابل پیکربندی قابل اتصال برای احراز هویت سازمانی؛ ورود شماره تلفن/رمز نیز پشتیبانی می‌شود. SSO/Identity Provider

۱۰. الزامات غیرعملکردی
۱۰-۱. امنیت
• Enforcement کامل Role + Scope + Application در Backend؛ کنترل UI به‌تنهایی کافی نیست.
• Hash رمز با الگوریتم امن، سیاست پیچیدگی، Lockout، Expiry و تغییر رمز اولیه.
• Access Token کوتاه‌عمر، Refresh Token قابل Revoke و Session Management.
• عدم ثبت Password، Token، Secret، Connection String و اطلاعات حساس در Log.
• Encryption in Transit و At Rest برای DB، Object Storage، Backup و Queue.
• Append-only و Tamper-evident بودن Audit؛ دسترسی مشاهده Audit فقط برای نقش مجاز.
• Validation فایل، MIME Sniffing، Malware Scan و Content-Disposition امن.
• Authorization جداگانه برای View/Download Attachment و داده امنیتی.
• تفکیک وظایف QA Lead، Security Reviewer، Tech Lead، PO و Admin.
• Admin Unlock فقط با دلیل، تأیید مجاز، Audit و حفظ Snapshot قبلی.
• Rate Limit، Anti-automation، CSRF برای Session Cookie، CORS Allowlist و CSP.
• مدیریت Secret در Vault و استفاده Runner از Secret Reference.
• ثبت IP، User Agent، Context و Correlation ID برای عملیات حساس.
• پشتیبان‌گیری، تست Restore، Disaster Recovery و Legal Hold.

شکل ۲۴ - جریان Audit Trail
Audit از Context و Diff عملیات ساخته و در مخزن تغییرناپذیر ذخیره می‌شود؛ گزارش و تشخیص ناهنجاری روی آن انجام می‌شود.
۱۰-۲. کارایی
• ۹۵٪ APIهای عملیاتی معمول زیر ۱ ثانیه و صفحات عملیاتی زیر ۳ ثانیه در بار مرجع.
• Pagination، Filter و Sort تمام جداول Server-side؛ اندازه صفحه ۳۰/۷۰/۱۰۰.
• Upload Resumable/Multipart برای فایل‌های بزرگ و جلوگیری از از دست رفتن State فرم.
• Playwright، گزارش‌های سنگین، Export و Notification به‌صورت Async.
• Dashboard از Read Model/Cache/Materialized View ساخته شود، نه Join سنگین لحظه‌ای.
• نسخه Snapshot انتشار از داده تجمیعی سازگار ساخته شود.
• Index بر ApplicationId، Status، Assignee، RequestId، CreatedAt و کلیدهای گزارش.
• Load Test برای مسیرهای Submit، Finalize، Retest، Publish و Export.
۱۰-۳. مقیاس‌پذیری و پایداری
• پشتیبانی از چند Application، چند Role و میلیون‌ها Run، Bug، Attachment و Audit Event.
• Scale افقی API، Worker و Runner؛ Sticky Session الزامی نیست.
• Object Storage برای فایل؛ DB فقط Metadata.
• Partition/Archive برای Audit، Run و Attachment Metadata.
• Cache داده پایه، Permission و Read Model با Invalidation کنترل‌شده.
• Queue با Retry، Dead-letter و Idempotent Consumer.
• Circuit Breaker، Timeout و Retry با Backoff برای CDE، فاوا، HR و Notification.
• Health، Readiness و Liveness Probe؛ Metrics، Trace و Centralized Logging.
• Feature Flag برای Integrationها و قابلیت Rollback تنظیمات.
• سیاست Browser Support و Timezone سازمانی قابل پیکربندی؛ ذخیره همه زمان‌ها UTC.
۱۱. الزامات UI/UX و استانداردهای عمومی
• رابط فارسی RTL، تاریخ شمسی، اعداد و وضعیت‌های نمایشی فارسی؛ واژه فنی انگلیسی فقط در صورت نیاز و ترجیحاً در توضیح ثانویه.
• برای نقش سطح کل اپ، سلسله‌مراتب نمایش Application → موجودیت برقرار باشد؛ از Accordion، Grouped Table یا Drill-down استفاده شود.
• دکمه ایجاد از Header کلی حذف و بالای سمت راست جدول، کنار بخش جست‌وجو و فیلتر قرار گیرد.
• تمام Viewها جزئیات کامل اطلاعات ایجاد/ویرایش را نمایش دهند؛ داده پنهان یا خلاصه ناقص مجاز نیست.
• Requirement و Flow در تمام انتخاب‌ها به‌صورت Accordion قابل مشاهده باشند.
• Wizard اجرای تست/باگ در Create، View و Edit UX یکپارچه داشته باشد.
• در صفحه جزئیات Run، باگ‌ها مرحله دوم Wizard هستند؛ بخش جداگانه پایین جدول حذف می‌شود.
• تغییر وضعیت Developer در همان صفحه جزئیات Bug/Run با کنترل دسترسی و UX روشن انجام شود.
• Loading، Empty State، Error State، Disabled Reason، Confirm و Toast استاندارد لازم است.
• Error Handling تمام فرم‌ها باید inline، زیر همان ورودی، با متن فارسی و حالت قرمز روی کنترل نمایش داده شود؛ نمایش خطای کلی بدون اشاره به فیلد فقط برای خطاهای سیستمی مجاز است.
• Confirm خروج از کارتابل یا اقدام حساس باید Modal داخلی و متمرکز باشد و در Sidebar یا Alert/Confirm مرورگر نمایش داده نشود.
• تمام Inputها و Textareaهای کنترل‌شده باید Copy/Paste طبیعی را پشتیبانی کنند و Paste نباید باعث از دست رفتن State یا دور زدن Validation شود.
• Textareaهای توضیحات باید Counter ۷۰۰ کاراکتری داشته باشند و با رسیدن به سقف به‌صورت بصری هشدار دهند.
• ورودی نسخه و بیلد در همه صفحات باید در زمان تایپ/Paste کاراکترهای غیرمجاز را حذف یا رد کند و خطای inline نمایش دهد.
• برد توسعه باید کارت‌محور، قابل Drag & Drop، با انیمیشن انتخاب کارت و Drop روی ستون مقصد باشد.
• فرم پس از ایجاد جدید Reset شود و Focus ورودی‌ها پایدار بماند.
• Accessibility شامل Keyboard Navigation، Focus Trap، ARIA، Contrast و Screen Reader Labels.
• Responsive برای Desktop، Tablet و Mobile؛ جدول‌ها در موبایل Card/Horizontal Scroll کنترل‌شده.
• همه جداول دارای Column Chooser، Filter، Sort، Pagination و Export Excel هستند.
۱۲. کاتالوگ الزامات عملکردی
شرح شناسه
احراز هویت با شماره تلفن و رمز و پشتیبانی از اتصال SSO. FR-001
استعلام کدملی و Auto-fill اطلاعات کاربر. FR-002
تخصیص Role در Scope کل اپ یا چند سامانه. FR-003
انتخاب Active Context و عدم Union نقش‌ها. FR-004
CRUD و غیرفعال‌سازی Application. FR-005
مدیریت قالب و آیتم‌های Checklist. FR-006
ایجاد Draft Test Request توسط Developer. FR-007
ویرایش کامل Request در Draft و Submitted با Audit. FR-008
انتخاب Multi Requirement اجباری. FR-009
ثبت چند Requirement «سایر» همراه Flow. FR-010
فعال‌سازی Requirement جدید پس از پذیرش QA. FR-011
نمایش جزئیات کامل Request برای Developer و QA. FR-012
Review/Accept/Reject/Cancel/Assign توسط QA Lead. FR-013
عدم نمایش Draft به سایر نقش‌ها و Cancelled در کارتابل QA. FR-014
CRUD Requirement و Flow توسط BA/QA Lead. FR-015
Completeness محاسباتی و Active Toggle Requirement. FR-016
مخفی‌سازی Requirement غیرفعال از نقش عملیاتی. FR-017
نمایش Accordion Requirement و Flow در تمام انتخاب‌ها. FR-018
CRUD/Archive Test Case توسط QA. FR-019
Completeness محاسباتی و Active Toggle Test Case. FR-020
Wizard دو مرحله‌ای Test Run/Bug. FR-021
انتخاب Test Request اجباری در Run. FR-022
اهداف اجرای Multi-select و Run قبلی برای Retest. FR-023
ثبت چند Bug از یک Run Fail. FR-024
تخصیص Developer همان Application در فرم Bug. FR-025
ثبت URL محل خطا و Attachment چندنوعی. FR-026
ثبت Run Issue برای Blocked. FR-027
ویرایش Run/Bug تا تصمیم نهایی و Unlock Admin پس از آن. FR-028
کلیک رفع شد و ایجاد RetestTask/Notification. FR-029
ایجاد Run جدید هنگام شروع Task توسط QA. FR-030
اجرای واقعی Playwright Async. FR-031
Discovery و مسیر دستی تست خودکار. FR-032
کنترل دسترسی Assignment-level برای نمایش کارتابل تست خودکار و اجازه اجرای جدید Playwright برای QA Specialist. FR-032-1
کارتابل فایل تست Playwright با مشاهده همه فایل‌ها، ایجاد با کلیک روی دکمه ایجاد، ویرایش کامل Application/Folder/FileName/Description/Script و ادیتور اسکریپت شبیه VS Code. FR-032-2
تنظیمات کاربرپسند اجرای Playwright شامل Browser/Project چندانتخابی، Headed، Workers، Retries، Max Failures، Trace و Reporter و تبدیل آن‌ها به command نهایی Runner. FR-032-3
تولید Artifact گزارش Playwright مطابق Reporter انتخاب‌شده شامل HTML، JSON یا JUnit/XML. FR-032-4
نمایش Preview و دانلود فایل گزارش Playwright مطابق Reporter انتخاب‌شده، بدون تکرار اطلاعات، همراه با Failure Detail شامل Test Name، Project، File، Line/Column، Error Message و Code Frame و لیست اسمی تست‌های Passed، Skipped و Cancelled. FR-032-5
ذخیره Artifact و ساخت Bug از Automated Run. FR-033
Checklist اختیاری برای هر Test Case. FR-034
Revision چک‌لیست و تجمیع در انتشار. FR-035
VersionHistory با یک Primary Test Request و بدون انتخاب Related Request در UX. FR-036
فرم انتشار متصل به Request با نمایش کل چرخه. FR-037
اعلام نظر QA با چهار وضعیت فارسی. FR-038
تصمیم نهایی انتشار براساس WorkflowPolicy با سه وضعیت فارسی. FR-039
Emergency Tag محاسباتی و پذیرش ریسک. FR-040
Snapshot و Commit اتمیک تصمیم. FR-041
Lock Run و Unlock ممیزی‌شده. FR-042
Comment append-only Product Owner. FR-043
Attachment واقعی در Object Storage. FR-044
Notification چندکاناله. FR-045
Audit append-only برای عملیات حساس. FR-046
Dashboard و گزارش دو لایه. FR-047
فیلتر، Sort، Pagination و Excel تمام جداول. FR-048
Scheduled Report و Alert. FR-049
Adapter کامل CDE و فاوا با Feature Flag. FR-050
SLA قابل پیکربندی و گزارش Breach. FR-051
Mock/Test Users برای UAT در همه نقش/Scopeها. FR-052
لیبل و وضعیت فارسی در UI. FR-053
تاریخ شمسی UI و UTC/Gregorian در DB. FR-054
Soft Delete/Archive طبق سیاست Retention. FR-055
Validation یکسان عنوان درخواست، SemVer نسخه، بیلد انگلیسی و توضیحات ۷۰۰ کاراکتری در تمام فرم‌ها. FR-056
الزام حداقل یک Flow برای ایجاد و فعال‌سازی Requirement. FR-057
حذف ورودی Test Request از فرم Test Case و اتصال اجباری Test Case به Requirement و Flow. FR-058
ویرایش کامل Test Case، Run و Bug تا قبل از ثبت نسخه انتشار/قفل نهایی. FR-059
برد توسعه کارت‌محور برای Developer با Drag & Drop باگ‌ها. FR-060
وضعیت Bug «بدون نیاز به اقدام» با دلیل اجباری برای Developer. FR-061
نمایش پیوست‌ها در جزئیات Bug و امکان Upload پیوست در Edit Formهای مجاز. FR-062
Read-only بودن کارتابل انتشار در پنل Developer برای مشاهده وضعیت Publish/Version درخواست خودش. FR-063
گزارش تغییرات هر نسخه برای همه نقش‌ها در Scope مجاز. FR-064
گزارش Traceability مدیریتی از درخواست تا انتشار. FR-065
Confirm Modal داخلی برای خروج از کارتابل و اقدام‌های حساس. FR-066
Copy/Paste پایدار و سازگار با Validation در تمام ورودی‌های کنترل‌شده. FR-067

۱۳. قواعد کسب‌وکار کلیدی
قاعده شناسه
هر Session فقط یک Active Context دارد. BR-001
Scope APP همه Applicationها و Scope SYSTEMS فقط مجموعه منتخب را پوشش می‌دهد. BR-002
اگر گزینه تست خودکار در Assignment نقش QA Specialist غیرفعال باشد، کارتابل Playwright و ایجاد اجرای جدید Playwright برای همان Active Context مسدود است. BR-002-1
کارتابل ساخت فایل تست Playwright فقط برای نقش‌هایی نمایش داده می‌شود که در همان Active Context مجوز اجرای Playwright دارند. نام فایل تست باید `kebab-case.spec.ts` باشد و فقط حروف کوچک انگلیسی، عدد و خط تیره پیش از پسوند `.spec.ts` مجاز است. BR-002-2
حداقل یک Requirement برای Submit Request اجباری است. BR-003
هر Requirement انتخابی یا جدید در Test Request باید حداقل یک Flow داشته باشد. BR-003-1
Other Requirement فقط پس از پذیرش QA فعال و عمومی می‌شود. BR-004
Request در Draft و Submitted توسط Requester قابل ویرایش است و تغییرات Audit می‌شوند. BR-005
Draft برای سایر نقش‌ها پنهان است. BR-006
Cancelled در کارتابل عملیاتی QA نمایش داده نمی‌شود. BR-007
Requirement تأیید دستی ندارد؛ Completeness محاسباتی است. BR-008
Requirement غیرفعال برای Test Case قابل انتخاب نیست. BR-009
Requirement بدون Flow قابل فعال‌سازی و قابل استفاده در Test Case نیست. BR-009-1
Requirement غیرفعال فقط برای QA Lead و Admin کل اپ قابل مشاهده است. BR-010
Test Case تأیید دستی ندارد؛ Completeness محاسباتی است. BR-011
Test Case ناقص یا غیرفعال قابل اجرا نیست. BR-012
Test Case بدون Requirement و Flow معتبر قابل ایجاد یا فعال‌سازی نیست و Test Request ورودی اجباری فرم Test Case نیست. BR-012-1
Bug فقط از Run Fail ساخته می‌شود. BR-013
یک Run Fail می‌تواند چند Bug داشته باشد. BR-014
Blocked باعث Run Issue می‌شود، نه Bug. BR-015
Assignee Bug باید Developer فعال همان Application باشد. BR-016
Developer Severity/Priority را تغییر نمی‌دهد. BR-017
Developer در هر وضعیت عملیاتی Bug می‌تواند «بدون نیاز به اقدام» را با دلیل اجباری ثبت کند. BR-017-1
رفع Bug وضعیت را سیستمی به ارسال برای Retest/Regression می‌برد. BR-018
RetestTask ایجاد می‌شود ولی Run تا شروع QA ساخته نمی‌شود. BR-019
Run/Bug تا تصمیم نهایی قابل ویرایش؛ پس از آن فقط Unlock Admin. BR-020
Checklist برای هر Test Case قابل دسترس ولی تکمیل آن اختیاری است. BR-021
هر Save Checklist یک Revision غیرقابل‌تغییر ایجاد می‌کند. BR-022
Release مستقل وجود ندارد؛ VersionHistory مرجع انتشار است. BR-023
هر VersionHistory یک Primary Request دارد. BR-024
در UX انتشار فقط یک درخواست تست انتخاب می‌شود و Related Request انتخاب/نمای مستقل ندارد. BR-024-1
اعلام نظر QA و تصمیم نهایی انتشار روی Primary Request نیز منعکس می‌شود. BR-025
مالک تصمیم نهایی، Recommendation QA را ویرایش نمی‌کند. BR-026
Emergency از Bug بحرانی حل‌نشده متصل به Primary Request محاسبه می‌شود و «بدون نیاز به اقدام» مسدودکننده محسوب نمی‌شود. BR-027
Retest Required Runهای قبلی را قفل و همان VersionHistory را به Draft بازمی‌گرداند. BR-028
تصمیم نهایی Snapshot، Status، Lock، Notification و Audit را اتمیک ثبت می‌کند. BR-029
Snapshot، Revision و Audit حذف/ویرایش نمی‌شوند. BR-030
Attachment حذف فیزیکی ندارد. BR-031
تمام گزارش‌ها Scope-aware هستند. BR-032
اگر داده legacy چنددرخواستی وجود داشته باشد، API برای سازگاری Deduplicate می‌کند؛ اما UX و معیارهای پذیرش فعلی بر Primary Request واحد هستند. BR-033
تمام UI Statusها فارسی‌اند. BR-034
Pagination و Export Excel برای همه Tableها اجباری است. BR-035
CDE/Fava تا دریافت Contract/Credential با Feature Flag خاموش‌اند. BR-036
System Admin سامانه‌ای فقط داده Scope خود را می‌بیند؛ تنظیمات حساس فقط Admin کل اپ. BR-037
Admin Unlock نیازمند Reason و Audit است. BR-038
Product Owner فقط View/Comment دارد. BR-039
Quality Score راهنمای تصمیم است و تصمیم انسانی را جایگزین نمی‌کند. BR-040
عنوان درخواست نباید با فاصله شروع شود و Backtick در آن مجاز نیست. BR-041
نسخه باید SemVer معتبر و فاقد حروف فارسی باشد؛ بیلد باید فقط کاراکترهای انگلیسی/ASCII بپذیرد. BR-042
توضیحات عملیاتی حداکثر ۷۰۰ کاراکتر دارند. BR-043
خطای اعتبارسنجی فرم باید زیر همان فیلد نمایش داده شود. BR-044

۱۴. سیاست حذف، قفل و نگهداری
سیاست موجودیت
غیرفعال‌سازی یا Soft Delete؛ در تاریخچه باقی می‌ماند. Application
غیرفعال‌سازی؛ حذف فیزیکی ممنوع. User
Archive/Soft Delete؛ در صورت ارتباط عملیاتی حذف فیزیکی ممنوع. Requirement / Flow / Test Case
Soft Delete قبل از تصمیم انتشار با دلیل و Audit؛ پس از تصمیم قفل. Test Run / Bug / Run Issue
فقط Soft Delete و اعمال Retention. Attachment
حذف ممنوع؛ در صورت خطای اداری فقط وضعیت Aborted با دلیل. VersionHistory
کاملاً تغییرناپذیر و حذف‌ناپذیر. Revision / Snapshot / Audit

۱۵. معیارهای پذیرش سطح سامانه
معیار شناسه
کاربر با Assignment کل اپ تمام Applicationها را به تفکیک سامانه می‌بیند و Assignment چندسامانه‌ای فقط Scope منتخب را. AC-01
هیچ API با تغییر ApplicationId خارج از Context داده برنمی‌گرداند. AC-02
فرم Request حداقل یک Requirement می‌خواهد و چند Other Requirement همراه Flow ثبت می‌کند. AC-03
پس از Accept QA، Other Requirement فعال و در کارتابل Requirement قابل مشاهده است. AC-04
View Request برای Developer و Review QA تمام فیلدها، URL، Requirement و Flow را نشان می‌دهد. AC-05
ویرایش Request در Draft/Submitted کار می‌کند و تب تاریخچه Diff را نشان می‌دهد. AC-06
Requirement غیرفعال در ایجاد Test Case نمایش داده نمی‌شود. AC-07
Wizard Run مرحله اول و دوم را مطابق نتیجه مدیریت و چند Bug ثبت می‌کند. AC-08
لیست Developer همان Application در فرم Bug بارگذاری می‌شود. AC-09
کلیک رفع شد Task و Notification ایجاد می‌کند و QA از Task اجرای Retest را آغاز می‌کند. AC-10
Security Reviewer کل اپ ابتدا Application و سپس Test Caseها را می‌بیند. AC-11
Playwright واقعی Job ایجاد، اجرا و Artifact ذخیره می‌کند. AC-12
QA Specialist بدون مجوز تست خودکار، کارتابل Playwright و دکمه اجرای جدید Playwright را مشاهده نمی‌کند. AC-12-1
کاربر دارای مجوز اجرای Playwright در کارتابل فایل تست، همه فایل‌های کشف‌شده و مدیریت‌شده Scope خود را می‌بیند، با کلیک روی ایجاد فرم ساخت را باز می‌کند، فایل `*.spec.ts` معتبر می‌سازد، خطای نام/اسکریپت را inline می‌بیند و می‌تواند تمام اطلاعات هر فایل را ویرایش کند. AC-12-2
کاربر دارای مجوز اجرای Playwright می‌تواند در فرم اجرای جدید مرورگرها، Headed، Worker، Retry، Max Failures، Trace و Reporter را از کنترل‌های UI انتخاب کند؛ Run ایجادشده این تنظیمات را در جزئیات نمایش می‌دهد و command نهایی با optionهای استاندارد Playwright ساخته می‌شود. AC-12-3
با انتخاب Reporter در اجرای جدید، Artifact گزارش خروجی باید با نام فایل و MIME متناسب با همان Reporter ایجاد و در جزئیات Run قابل مشاهده باشد. AC-12-4
در مودال مشاهده PlaywrightRun، کاربر می‌تواند گزارش HTML/JSON/JUnit را مطابق انتخاب Runner ببیند و دانلود کند؛ اطلاعات تکراری گزارش و Artifactها حذف می‌شود؛ اگر تست Fail شده باشد، خطای گزارش باید محل دقیق فایل و خط اسکریپت و Code Frame را نشان دهد و لیست اسمی تست‌های Passed، Skipped و Cancelled نیز قابل مشاهده باشد. AC-12-5
فرم انتشار کل چرخه Primary Request واحد را نمایش می‌دهد و Related Request در UX ندارد. AC-13
QA نظر و مالک تصمیم نهایی انتشار را با Validation اجباری ثبت می‌کنند. AC-14
تصمیم نهایی در خطای میانی Rollback می‌شود و وضعیت نیمه‌کاره باقی نمی‌ماند. AC-15
Emergency Tag با تغییر Bug به‌صورت خودکار اضافه/حذف می‌شود. AC-16
پس از تصمیم نهایی Run/Bug قفل و فقط با Unlock ممیزی‌شده ویرایش می‌شوند. AC-17
تمام Tableها Pagination 30/70/100، فیلتر و Excel دارند. AC-18
UI فارسی RTL، Focus پایدار، Reset فرم و جزئیات کامل دارد. AC-19
Audit برای Role Change، Request Edit، Run، Bug، Checklist، Playwright، Publish، Unlock و Attachment ثبت می‌شود. AC-20
ورودی عنوان درخواست فاصله اول و Backtick را نمی‌پذیرد و خطای inline نشان می‌دهد. AC-21
ورودی نسخه SemVer و بدون حروف فارسی است؛ ورودی بیلد حروف فارسی را نمی‌پذیرد. AC-22
Textarea توضیحات سقف ۷۰۰ کاراکتر و Counter دارد. AC-23
نیازمندی بدون Flow ایجاد/فعال نمی‌شود و پیام خطای روشن دارد. AC-24
Test Case بدون Requirement و Flow معتبر ذخیره نمی‌شود و ورودی انتخاب Test Request در فرم ندارد. AC-25
Developer از برد توسعه می‌تواند کارت Bug را Drag کند، وضعیت «بدون نیاز به اقدام» را با دلیل ثبت کند و کارت در ستون مربوط دیده شود. AC-26
در ویرایش Run، باگ‌های همان اجرا قابل افزودن، حذف و ویرایش با فیلدهای یکسان با فرم ایجاد هستند. AC-27
فرم‌های دارای پیوست در حالت Edit نیز Upload و نمایش پیوست دارند. AC-28
گزارش Traceability مدیریتی و گزارش تغییرات نسخه در Scope مجاز قابل مشاهده است. AC-29
Confirm خروج از کارتابل Modal داخلی است و Alert مرورگر استفاده نمی‌شود. AC-30

پیوست الف - تکنیک‌های طراحی تست
• تست مبتنی بر نیازمندی (Requirements-based Testing)
• افراز هم‌ارزی (Equivalence Partitioning)
• تحلیل مقادیر مرزی (Boundary Value Analysis)
• تست جدول تصمیم (Decision Table Testing)
• تست انتقال وضعیت (State Transition Testing)
• تست سناریویی (Scenario Testing)
• روش درخت طبقه‌بندی (Classification Tree Method)
• طراحی تست ترکیبی (Combinatorial Test Design)
• نمودار علت و معلول (Cause-Effect Graphing)
• تست نحو/ساختار ورودی (Syntax Testing)
• تست تصادفی (Random Testing)
• تست دگرریختی/رابطه‌ای (Metamorphic Testing)
• تست دستورها (Statement Testing)
• تست شاخه‌ها (Branch Testing)
• تست تصمیم‌ها (Decision Testing)
• تست شرط شاخه (Branch Condition Testing)
• تست ترکیب شرط‌های شاخه (Branch Condition Combination Testing)
• پوشش تصمیم/شرط اصلاح‌شده (MCDC Testing)
• تست جریان داده (Data Flow Testing)
• حدس خطا (Error Guessing)
پیوست ب - مدل دسترسی خلاصه
محدودیت دسترسی نقش
بدون اجرا، تغییر Severity/Priority، Toggle یا تصمیم انتشار. درخواست‌های خودش، Requirement Read-only، Test Case Read-only، Bugهای تخصیصی، Taskهای مربوط و برد توسعه با وضعیت «بدون نیاز به اقدام». Developer
بدون اعلام نظر کیفیت و تصمیم انتشار. Test Case، Run، Bug، Retest و Run Issue ارجاعی؛ Playwright فقط در صورت فعال بودن گزینه تست خودکار روی Assignment همان Context. QA Specialist
بدون تصمیم نهایی مگر در WorkflowPolicy نوع QA-owned؛ تمام عملیات QA و Requirement/Flow در Scope؛ اعلام نظر کیفیت. QA Lead
بدون Run، Bug و انتشار. Requirement، Flow و گزارش پوشش. BA
بدون تصمیم انتشار و ویرایش تست. Test Caseها و Checklistهای Scope. Security Reviewer
بدون ویرایش داده تست یا Recommendation QA. Read-only چرخه تست و تصمیم نهایی VersionHistory؛ اقدام تصمیم فقط در صورت مالک بودن Capability. Tech Lead
بدون Sign-off و Mutation عملیاتی. گزارش مدیریتی و Comment. Product Owner
بدون تکمیل داده عملیاتی به‌جای نقش‌ها؛ Override با دلیل. همه سامانه‌ها، مدیریت هویت/سامانه/قالب/Audit/Unlock. System Admin کل اپ
بدون تنظیمات حساس سراسری و Role Assignment کل اپ. مشاهده و مدیریت محدود داده Scope طبق مجوز. System Admin سامانه‌ای

پیوست ج - نمودارهای تکمیلی فرایندی

شکل ۲۵ - جریان سرتاسری کیفیت تا انتشار
زنجیره اصلی از درخواست تست تا تصمیم انتشار و حلقه‌های Fail، Blocked و Retest را نمایش می‌دهد.

پیوست د - وضعیت پیاده‌سازی فعلی فرانت و Mock
این بخش وضعیت کد فعلی را از الزامات نهایی محصول جدا می‌کند تا سند هم مرجع محصول باقی بماند و هم با پیاده‌سازی فعلی قابل تطبیق باشد.

موارد پیاده‌سازی‌شده در فرانت/Mock:
• مسیریابی، Sidebar و کنترل دسترسی کارتابل‌ها بر اساس Active Context و Role.
• کنترل دسترسی تست خودکار برای QA Specialist بر اساس گزینه Assignment و مخفی‌سازی Playwright/Playwright Files در صورت غیرفعال بودن.
• Back-office سامانه‌ها با سه ریشه CDE شامل Front، Back NodeJS/DataService و Gateway.
• اعتبارسنجی عنوان درخواست، نسخه SemVer، بیلد ASCII و محدودیت توضیحات در فرم‌های اصلی به کمک utilityهای مشترک.
• الزام Flow هنگام ایجاد/فعال‌سازی Requirement.
• حذف انتخاب Test Request از فرم Test Case و الزام Requirement/Flow.
• ویرایش Run و Bugهای متصل قبل از Lock انتشار، همراه با نمایش/آپلود پیوست در جریان‌های به‌روزشده.
• برد توسعه کارت‌محور با Drag & Drop، وضعیت «باگ نیست» و «بدون نیاز به اقدام».
• VersionHistory با یک Primary Test Request، بدون Related Request در UX، تصمیم مبتنی بر WorkflowPolicy و چک‌لیست پذیرش ریسک اضطراری.
• کارتابل Playwright Files برای مشاهده فایل‌های کشف‌شده و مدیریت فایل‌های ایجادشده در UTMS.
• اجرای Playwright در Mock Runner با Browser/Project، Headed، Workers، Retries، Max Failures، Trace و Reporter.
• تولید و نمایش/دانلود گزارش Playwright متناسب با Reporter انتخاب‌شده شامل HTML، JSON و JUnit/XML، همراه با Failure Detail و لیست اسمی Passed/Skipped/Cancelled.
• صفحه Reports با ۲۰ گزارش شامل Traceability مدیریتی و گزارش تغییرات VersionHistory.

وضعیت پس از تکمیل فازهای ۱۴ تا ۱۷ فرانت:
• `Table` مشترک دارای فیلتر سریع، Column Chooser و خروجی Excel/CSV در toolbar داخلی است و همه جدول‌های مبتنی بر آن این قابلیت‌ها را دریافت می‌کنند.
• Pagination با گزینه‌های ۱۰، ۳۰، ۷۰ و ۱۰۰ و `onLimitChange` در صفحات جدولی اصلی یکسان‌سازی شده است؛ صفحه سامانه‌ها نیز pagination محلی دارد.
• Reports Page خروجی JSON، Excel و PDF mock دارد و UI زمان‌بندی گزارش و Alert به‌صورت frontend/mock اضافه شده است.
• فیلترهای مشترک گزارش‌ها شامل بازه زمانی، وضعیت و جست‌وجوی شخص/متن اضافه شده و روی ردیف‌های جدولی گزارش اعمال می‌شود.
• کارت گزارش Test Requests به read model اختصاصی `getTestRequestReport` متصل است و دیگر از داده Developer Performance استفاده نمی‌کند.
• استفاده از `confirm()` و `alert()` مرورگر از سورس فرانت حذف شده و حذف Flow داخل Requirement Detail با Modal داخلی انجام می‌شود.
• فاصله‌های باقی‌مانده برای بک‌اند/Worker: اجرای واقعی Playwright، Adapter واقعی CDE/Fava، ذخیره Artifact در Object Storage، PDF server-side، Scheduled Report و Alert واقعی، Audit Export واقعی و تراکنش‌های اتمیک انتشار.
جمع‌بندی
این سند مدل نهایی UTMS را به‌عنوان سامانه کامل سازمانی تثبیت می‌کند. مرجع عملیاتی فرایند، Primary Test Request است؛ VersionHistory چرخه نسخه و انتشار را مدیریت می‌کند؛ QA Lead نظر کیفی را ثبت می‌کند و مالک تصمیم نهایی بر اساس WorkflowPolicy هر Application تعیین می‌شود. معماری، داده، دسترسی، گزارش، Audit و Integrationها به‌گونه‌ای طراحی شده‌اند که تمام قابلیت‌های مصوب قابل پیاده‌سازی، آزمون و بهره‌برداری باشند.
]
