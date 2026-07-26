import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Input, Select, Textarea } from '../ui/Input';
import { JalaliDateTimePicker } from '../ui/JalaliDateTimePicker';
import type { SecurityTestConfiguration } from '../../types';

interface Props {
  value: SecurityTestConfiguration;
  onChange: (value: SecurityTestConfiguration) => void;
  errors?: Record<string, string>;
}

const yesNoOptions = [
  { value: 'YES', label: 'بله' },
  { value: 'NO', label: 'خیر' },
];

const approvalOptions = [
  { value: 'APPROVED', label: 'تأیید' },
  { value: 'REJECTED', label: 'رد' },
];

export const SecurityTestConfigurationFields: React.FC<Props> = ({
  value,
  onChange,
  errors = {},
}) => {
  const setRoot = (field: keyof SecurityTestConfiguration, nextValue: string) => {
    onChange({ ...value, [field]: nextValue });
  };
  const setNested = (
    section: 'development' | 'test' | 'production',
    field: string,
    nextValue: string
  ) => {
    onChange({
      ...value,
      [section]: {
        ...value[section],
        [field]: nextValue,
      },
    } as SecurityTestConfiguration);
  };

  return (
    <div className="space-y-5 rounded-lg border border-purple-200 bg-purple-50/40 p-4">
      <div>
        <h3 className="font-semibold text-purple-900">اطلاعات درخواست تست امنیت</h3>
        <p className="mt-1 text-xs text-purple-700">
          این اطلاعات همراه درخواست در اختیار کارشناس امنیت قرار می‌گیرد.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Select
          label="نوع درخواست *"
          value={value.requestType}
          onChange={(event) => setRoot('requestType', event.target.value)}
          options={[
            { value: 'INITIAL', label: 'تست اولیه' },
            { value: 'NEW_VERSION', label: 'نسخه جدید' },
            { value: 'RETEST', label: 'بازآزمایی' },
          ]}
          placeholder="انتخاب کنید"
          error={errors.requestType}
        />
        <Select
          label="نوع سامانه *"
          value={value.systemType}
          onChange={(event) => setRoot('systemType', event.target.value)}
          options={[
            { value: 'Web Application', label: 'Web Application' },
            { value: 'API Service', label: 'API Service' },
            { value: 'Mobile Application', label: 'Mobile Application' },
            { value: 'Desktop Application', label: 'Desktop Application' },
          ]}
          placeholder="انتخاب کنید"
          error={errors.systemType}
        />
        <Select
          label="Frontend *"
          value={value.frontend}
          onChange={(event) => setRoot('frontend', event.target.value)}
          options={[
            { value: 'React', label: 'React' },
            { value: 'Next.js', label: 'Next.js' },
            { value: 'Angular', label: 'Angular' },
            { value: 'Vue.js', label: 'Vue.js' },
            { value: 'Svelte', label: 'Svelte' },
            { value: 'Other', label: 'سایر' },
          ]}
          placeholder="انتخاب کنید"
          error={errors.frontend}
        />
        <Select
          label="Gateway *"
          value={value.gateway}
          onChange={(event) => setRoot('gateway', event.target.value)}
          options={[
            { value: 'JavaScript Gateway', label: 'JavaScript Gateway' },
            { value: 'API Gateway', label: 'API Gateway' },
            { value: 'Kong', label: 'Kong' },
            { value: 'Nginx Gateway', label: 'Nginx Gateway' },
            { value: 'None', label: 'بدون Gateway' },
            { value: 'Other', label: 'سایر' },
          ]}
          placeholder="انتخاب کنید"
          error={errors.gateway}
        />
        <Select
          label="Backend *"
          value={value.backend}
          onChange={(event) => setRoot('backend', event.target.value)}
          options={[
            { value: 'Node.js', label: 'Node.js' },
            { value: 'Java', label: 'Java' },
            { value: '.NET', label: '.NET' },
            { value: 'Python', label: 'Python' },
            { value: 'PHP', label: 'PHP' },
            { value: 'Go', label: 'Go' },
            { value: 'Other', label: 'سایر' },
          ]}
          placeholder="انتخاب کنید"
          error={errors.backend}
        />
        <Select
          label="Database *"
          value={value.database}
          onChange={(event) => setRoot('database', event.target.value)}
          options={[
            { value: 'PostgreSQL', label: 'PostgreSQL' },
            { value: 'MySQL', label: 'MySQL' },
            { value: 'SQL Server', label: 'SQL Server' },
            { value: 'Oracle', label: 'Oracle' },
            { value: 'MongoDB', label: 'MongoDB' },
            { value: 'Other', label: 'سایر' },
          ]}
          placeholder="انتخاب کنید"
          error={errors.database}
        />
        <Select
          label="Web Server / Reverse Proxy *"
          value={value.webServer}
          onChange={(event) => setRoot('webServer', event.target.value)}
          options={[
            { value: 'Nginx', label: 'Nginx' },
            { value: 'Apache', label: 'Apache' },
            { value: 'IIS', label: 'IIS' },
            { value: 'Traefik', label: 'Traefik' },
            { value: 'Other', label: 'سایر' },
          ]}
          placeholder="انتخاب کنید"
          error={errors.webServer}
        />
        <Select
          label="مدل ارتباط *"
          value={value.communicationModel}
          onChange={(event) => setRoot('communicationModel', event.target.value)}
          options={[
            { value: 'gateway approach', label: 'gateway approach' },
            { value: 'gateway + dataservice', label: 'gateway + dataservice' },
          ]}
          placeholder="انتخاب کنید"
          error={errors.communicationModel}
        />
        <Select
          label="نوع تست *"
          value={value.securityTestType}
          onChange={(event) => setRoot('securityTestType', event.target.value)}
          options={[
            { value: 'BLACK_BOX', label: 'Black Box' },
            { value: 'GRAY_BOX', label: 'Gray Box' },
          ]}
          placeholder="انتخاب کنید"
          error={errors.securityTestType}
        />
        <Select
          label="روش اصلی تست *"
          value={value.primaryTestMethod}
          onChange={(event) => setRoot('primaryTestMethod', event.target.value)}
          options={[
            { value: 'URL و حساب‌های تست', label: 'URL و حساب‌های تست' },
            { value: 'URL بدون حساب تست', label: 'URL بدون حساب تست' },
            { value: 'API Endpoint و Token تست', label: 'API Endpoint و Token تست' },
          ]}
          placeholder="انتخاب کنید"
          error={errors.primaryTestMethod}
        />
        <Select
          label="محیط مورد تست *"
          value={value.environment}
          onChange={(event) => setRoot('environment', event.target.value)}
          options={[
            { value: 'DEVELOPMENT', label: 'Development' },
            { value: 'TEST', label: 'Test' },
            { value: 'PRODUCTION', label: 'Production' },
          ]}
          placeholder="انتخاب کنید"
          error={errors.environment}
        />
        <Input
          label="URL اصلی *"
          value={value.primaryUrl}
          onChange={(event) => setRoot('primaryUrl', event.target.value)}
          placeholder="https://example.ir"
          error={errors.primaryUrl}
        />
        <Textarea
          label="URLهای فرعی"
          value={value.secondaryUrls || ''}
          onChange={(event) => setRoot('secondaryUrls', event.target.value)}
          placeholder="هر URL را در یک خط وارد کنید"
          error={errors.secondaryUrls}
        />
        <Select
          label="وضعیت دسترسی *"
          value={value.accessStatus}
          onChange={(event) => setRoot('accessStatus', event.target.value)}
          options={[
            { value: 'INTERNET', label: 'اینترنت' },
            { value: 'ORGANIZATION_NETWORK', label: 'شبکه سازمان' },
            { value: 'VPN', label: 'VPN' },
            { value: 'IP_WHITELIST', label: 'IP Whitelist' },
          ]}
          placeholder="انتخاب کنید"
          error={errors.accessStatus}
        />
        <Select
          label="نیاز به VPN *"
          value={value.vpnRequired}
          onChange={(event) => setRoot('vpnRequired', event.target.value)}
          options={yesNoOptions}
          placeholder="انتخاب کنید"
          error={errors.vpnRequired}
        />
        <Select
          label="نیاز به IP Whitelist *"
          value={value.ipWhitelistRequired}
          onChange={(event) => setRoot('ipWhitelistRequired', event.target.value)}
          options={yesNoOptions}
          placeholder="انتخاب کنید"
          error={errors.ipWhitelistRequired}
        />
        <Input
          label="ساعات مجاز تست *"
          value={value.allowedTestHours}
          onChange={(event) => setRoot('allowedTestHours', event.target.value)}
          placeholder="مثلاً ۸ تا ۱۶ روزهای کاری"
          error={errors.allowedTestHours}
        />
        <JalaliDateTimePicker
          label="تاریخ شروع دسترسی *"
          value={value.accessStartAt}
          onChange={(nextValue) => setRoot('accessStartAt', nextValue)}
          error={errors.accessStartAt}
        />
        <JalaliDateTimePicker
          label="تاریخ پایان دسترسی *"
          value={value.accessEndAt}
          onChange={(nextValue) => setRoot('accessEndAt', nextValue)}
          error={errors.accessEndAt}
        />
        <Select
          label="وضعیت پایداری محیط *"
          value={value.environmentStability}
          onChange={(event) => setRoot('environmentStability', event.target.value)}
          options={[
            { value: 'STABLE', label: 'پایدار' },
            { value: 'UNSTABLE', label: 'ناپایدار' },
            { value: 'COORDINATION_REQUIRED', label: 'نیازمند هماهنگی' },
          ]}
          placeholder="انتخاب کنید"
          error={errors.environmentStability}
        />
        <Input
          label="مسئول پشتیبانی محیط (نام و شماره تماس) *"
          value={value.environmentSupportContact}
          onChange={(event) => setRoot('environmentSupportContact', event.target.value)}
          error={errors.environmentSupportContact}
        />
        <Input
          label="تماس اضطراری توقف تست (نام و شماره تماس) *"
          value={value.emergencyStopContact}
          onChange={(event) => setRoot('emergencyStopContact', event.target.value)}
          error={errors.emergencyStopContact}
        />
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>رمز عبور نباید داخل فرم نوشته شود؛ فقط روش تحویل امن آن را مشخص کنید.</span>
      </div>

      {value.environment === 'DEVELOPMENT' && (
        <div className="space-y-3 border-t border-purple-200 pt-4">
          <h4 className="font-medium text-gray-900">اطلاعات احراز هویت محیط Development</h4>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Input
              label="URL محیط Development *"
              value={value.development.url}
              onChange={(event) => setNested('development', 'url', event.target.value)}
              error={errors['development.url']}
            />
            <Input label="روش ورود" value="نام کاربری و رمز عبور محلی" disabled />
            <Input
              label="شناسه ورود *"
              value={value.development.loginIdentifier}
              onChange={(event) => setNested('development', 'loginIdentifier', event.target.value)}
              placeholder="نام کاربری / شماره همراه / ایمیل / سایر"
              error={errors['development.loginIdentifier']}
            />
            <Textarea
              label="حساب‌های تست *"
              value={value.development.testAccounts}
              onChange={(event) => setNested('development', 'testAccounts', event.target.value)}
              placeholder="شناسه حداقل یک حساب برای هر نقش مهم؛ بدون رمز عبور"
              error={errors['development.testAccounts']}
            />
            <Textarea
              label="نقش هر حساب *"
              value={value.development.accountRoles}
              onChange={(event) => setNested('development', 'accountRoles', event.target.value)}
              placeholder="کاربر عادی / مدیر / اپراتور و ..."
              error={errors['development.accountRoles']}
            />
            <JalaliDateTimePicker
              label="تاریخ انقضای حساب"
              value={value.development.accountExpiresAt || ''}
              onChange={(nextValue) => setNested('development', 'accountExpiresAt', nextValue)}
            />
            <Select
              label="روش تحویل رمز *"
              value={value.development.passwordDeliveryMethod}
              onChange={(event) => setNested('development', 'passwordDeliveryMethod', event.target.value)}
              options={[
                { value: 'VAULT', label: 'Vault' },
                { value: 'SECURE_CHANNEL', label: 'کانال امن' },
                { value: 'ONE_TIME_LINK', label: 'لینک یک‌بارمصرف' },
              ]}
              placeholder="انتخاب کنید"
              error={errors['development.passwordDeliveryMethod']}
            />
            <Select
              label="امکان Reset حساب *"
              value={value.development.accountResetAvailable}
              onChange={(event) => setNested('development', 'accountResetAvailable', event.target.value)}
              options={yesNoOptions}
              placeholder="انتخاب کنید"
              error={errors['development.accountResetAvailable']}
            />
            {value.development.accountResetAvailable === 'YES' && (
              <Input
                label="مسئول Reset حساب (نام و تماس) *"
                value={value.development.accountResetContact || ''}
                onChange={(event) => setNested('development', 'accountResetContact', event.target.value)}
                error={errors['development.accountResetContact']}
              />
            )}
          </div>
        </div>
      )}

      {value.environment === 'TEST' && (
        <div className="space-y-3 border-t border-purple-200 pt-4">
          <h4 className="font-medium text-gray-900">اطلاعات احراز هویت محیط Test</h4>
          <p className="text-sm text-red-700">بدون حساب تست SSO، تست امنیت محیط Test قابل شروع نیست.</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Input
              label="URL محیط Test *"
              value={value.test.url}
              onChange={(event) => setNested('test', 'url', event.target.value)}
              error={errors['test.url']}
            />
            <Input label="روش ورود" value="SSO" disabled />
            <Input
              label="نام SSO Provider *"
              value={value.test.ssoProvider}
              onChange={(event) => setNested('test', 'ssoProvider', event.target.value)}
              error={errors['test.ssoProvider']}
            />
            <Select
              label="پروتکل *"
              value={value.test.protocol}
              onChange={(event) => setNested('test', 'protocol', event.target.value)}
              options={[
                { value: 'OPENID_CONNECT', label: 'OpenID Connect' },
                { value: 'OAUTH_2', label: 'OAuth 2.0' },
                { value: 'SAML_2', label: 'SAML 2.0' },
                { value: 'OTHER', label: 'سایر' },
              ]}
              placeholder="انتخاب کنید"
              error={errors['test.protocol']}
            />
            <Textarea
              label="حساب‌های تست SSO *"
              value={value.test.ssoTestAccounts}
              onChange={(event) => setNested('test', 'ssoTestAccounts', event.target.value)}
              placeholder="شناسه حساب‌ها؛ بدون رمز عبور"
              error={errors['test.ssoTestAccounts']}
            />
            <Textarea
              label="نقش حساب‌ها *"
              value={value.test.accountRoles}
              onChange={(event) => setNested('test', 'accountRoles', event.target.value)}
              error={errors['test.accountRoles']}
            />
            <Input
              label="Tenant یا سازمان"
              value={value.test.tenant || ''}
              onChange={(event) => setNested('test', 'tenant', event.target.value)}
            />
            <Select
              label="وضعیت MFA *"
              value={value.test.mfaStatus}
              onChange={(event) => setNested('test', 'mfaStatus', event.target.value)}
              options={[
                { value: 'ENABLED', label: 'فعال' },
                { value: 'DISABLED', label: 'غیرفعال' },
                { value: 'CONDITIONAL', label: 'مشروط' },
              ]}
              placeholder="انتخاب کنید"
              error={errors['test.mfaStatus']}
            />
            <Input
              label="Callback Domain"
              value={value.test.callbackDomain || ''}
              onChange={(event) => setNested('test', 'callbackDomain', event.target.value)}
            />
            <Input
              label="Redirect Domain"
              value={value.test.redirectDomain || ''}
              onChange={(event) => setNested('test', 'redirectDomain', event.target.value)}
            />
            <Input
              type="number"
              min="1"
              label="مدت Session (دقیقه) *"
              value={value.test.sessionDurationMinutes}
              onChange={(event) => setNested('test', 'sessionDurationMinutes', event.target.value)}
              error={errors['test.sessionDurationMinutes']}
            />
            <Select
              label="رفتار Logout *"
              value={value.test.logoutBehavior}
              onChange={(event) => setNested('test', 'logoutBehavior', event.target.value)}
              options={[
                { value: 'APPLICATION_ONLY', label: 'خروج فقط از سامانه' },
                { value: 'SSO_AND_APPLICATION', label: 'خروج از SSO و سامانه' },
              ]}
              placeholder="انتخاب کنید"
              error={errors['test.logoutBehavior']}
            />
            <JalaliDateTimePicker
              label="تاریخ انقضای حساب *"
              value={value.test.accountExpiresAt}
              onChange={(nextValue) => setNested('test', 'accountExpiresAt', nextValue)}
              error={errors['test.accountExpiresAt']}
            />
            <Textarea
              label="محدودیت شناخته‌شده SSO"
              value={value.test.knownSsoLimitations || ''}
              onChange={(event) => setNested('test', 'knownSsoLimitations', event.target.value)}
            />
          </div>
        </div>
      )}

      {value.environment === 'PRODUCTION' && (
        <div className="space-y-3 border-t border-purple-200 pt-4">
          <h4 className="font-medium text-gray-900">اطلاعات و مجوزهای محیط Production</h4>
          <p className="text-sm text-red-700">تست Production فقط با مجوز صریح انجام می‌شود.</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Input
              label="URL محیط Production *"
              value={value.production.url}
              onChange={(event) => setNested('production', 'url', event.target.value)}
              error={errors['production.url']}
            />
            <Input label="روش ورود" value="Government Gateway SSO" disabled />
            <Input
              label="حساب تست کنترل‌شده *"
              value={value.production.controlledTestAccount}
              onChange={(event) => setNested('production', 'controlledTestAccount', event.target.value)}
              placeholder="شناسه حساب؛ بدون رمز عبور"
              error={errors['production.controlledTestAccount']}
            />
            <Input
              label="مالک حساب تست *"
              value={value.production.testAccountOwner}
              onChange={(event) => setNested('production', 'testAccountOwner', event.target.value)}
              error={errors['production.testAccountOwner']}
            />
            <Input
              label="نقش حساب *"
              value={value.production.accountRole}
              onChange={(event) => setNested('production', 'accountRole', event.target.value)}
              error={errors['production.accountRole']}
            />
            {([
              ['businessOwnerPermission', 'مجوز مالک کسب‌وکار *'],
              ['technicalOwnerPermission', 'مجوز مسئول فنی *'],
              ['productionOwnerPermission', 'مجوز مالک Production *'],
              ['securityTeamPermission', 'مجوز تیم امنیت *'],
            ] as const).map(([field, label]) => (
              <Select
                key={field}
                label={label}
                value={value.production[field]}
                onChange={(event) => setNested('production', field, event.target.value)}
                options={approvalOptions}
                placeholder="انتخاب کنید"
                error={errors[`production.${field}`]}
              />
            ))}
            <JalaliDateTimePicker
              label="تاریخ و ساعت مجاز تست *"
              value={value.production.authorizedTestDateTime}
              onChange={(nextValue) => setNested('production', 'authorizedTestDateTime', nextValue)}
              error={errors['production.authorizedTestDateTime']}
            />
            <Input
              label="تماس اضطراری *"
              value={value.production.emergencyContact}
              onChange={(event) => setNested('production', 'emergencyContact', event.target.value)}
              error={errors['production.emergencyContact']}
            />
            <Select
              label="تأیید Monitoring *"
              value={value.production.monitoringConfirmed}
              onChange={(event) => setNested('production', 'monitoringConfirmed', event.target.value)}
              options={yesNoOptions}
              placeholder="انتخاب کنید"
              error={errors['production.monitoringConfirmed']}
            />
            <Select
              label="تأیید Backup یا Rollback *"
              value={value.production.backupOrRollbackConfirmed}
              onChange={(event) => setNested('production', 'backupOrRollbackConfirmed', event.target.value)}
              options={yesNoOptions}
              placeholder="انتخاب کنید"
              error={errors['production.backupOrRollbackConfirmed']}
            />
            <Select
              label="محدودیت اسکن خودکار *"
              value={value.production.automatedScanRestriction}
              onChange={(event) => setNested('production', 'automatedScanRestriction', event.target.value)}
              options={[
                { value: 'ALLOWED', label: 'مجاز' },
                { value: 'PROHIBITED', label: 'ممنوع' },
                { value: 'LIMITED', label: 'محدود' },
              ]}
              placeholder="انتخاب کنید"
              error={errors['production.automatedScanRestriction']}
            />
            {([
              ['dataChangeRestriction', 'محدودیت تغییر داده *'],
              ['dataDeletionRestriction', 'محدودیت حذف داده *'],
              ['stopCondition', 'شرط توقف تست *'],
            ] as const).map(([field, label]) => (
              <Input
                key={field}
                label={label}
                value={value.production[field]}
                onChange={(event) => setNested('production', field, event.target.value)}
                error={errors[`production.${field}`]}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
