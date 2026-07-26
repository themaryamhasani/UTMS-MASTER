import type { SecurityTestConfiguration } from '../types';

export function createEmptySecurityTestConfiguration(): SecurityTestConfiguration {
  return {
    requestType: '',
    systemType: 'Web Application',
    frontend: '',
    gateway: '',
    backend: '',
    database: '',
    webServer: 'Nginx',
    communicationModel: '',
    securityTestType: '',
    primaryTestMethod: 'URL و حساب‌های تست',
    environment: '',
    primaryUrl: '',
    secondaryUrls: '',
    accessStatus: '',
    vpnRequired: '',
    ipWhitelistRequired: '',
    allowedTestHours: '',
    accessStartAt: '',
    accessEndAt: '',
    environmentStability: '',
    environmentSupportContact: '',
    emergencyStopContact: '',
    development: {
      url: '',
      loginIdentifier: '',
      testAccounts: '',
      accountRoles: '',
      accountExpiresAt: '',
      passwordDeliveryMethod: '',
      accountResetAvailable: '',
      accountResetContact: '',
    },
    test: {
      url: '',
      ssoProvider: '',
      protocol: '',
      ssoTestAccounts: '',
      accountRoles: '',
      tenant: '',
      mfaStatus: '',
      callbackDomain: '',
      redirectDomain: '',
      sessionDurationMinutes: '',
      logoutBehavior: '',
      accountExpiresAt: '',
      knownSsoLimitations: '',
    },
    production: {
      url: '',
      controlledTestAccount: '',
      testAccountOwner: '',
      accountRole: '',
      businessOwnerPermission: '',
      technicalOwnerPermission: '',
      productionOwnerPermission: '',
      securityTeamPermission: '',
      authorizedTestDateTime: '',
      emergencyContact: '',
      monitoringConfirmed: '',
      backupOrRollbackConfirmed: '',
      automatedScanRestriction: '',
      dataChangeRestriction: '',
      dataDeletionRestriction: '',
      stopCondition: '',
    },
  };
}

function requireFields(
  source: Record<string, unknown>,
  prefix: string,
  labels: Record<string, string>,
  errors: Record<string, string>
): void {
  Object.entries(labels).forEach(([field, label]) => {
    const value = source[field];
    if (typeof value !== 'string' || !value.trim()) {
      errors[`${prefix}${field}`] = `${label} الزامی است.`;
    }
  });
}

export function validateSecurityTestConfiguration(
  config: SecurityTestConfiguration
): Record<string, string> {
  const errors: Record<string, string> = {};
  requireFields(config as unknown as Record<string, unknown>, '', {
    requestType: 'نوع درخواست',
    systemType: 'نوع سامانه',
    frontend: 'Frontend',
    gateway: 'Gateway',
    backend: 'Backend',
    database: 'Database',
    webServer: 'Web Server / Reverse Proxy',
    communicationModel: 'مدل ارتباط',
    securityTestType: 'نوع تست',
    primaryTestMethod: 'روش اصلی تست',
    environment: 'محیط مورد تست',
    primaryUrl: 'URL اصلی',
    accessStatus: 'وضعیت دسترسی',
    vpnRequired: 'نیاز به VPN',
    ipWhitelistRequired: 'نیاز به IP Whitelist',
    allowedTestHours: 'ساعات مجاز تست',
    accessStartAt: 'تاریخ شروع دسترسی',
    accessEndAt: 'تاریخ پایان دسترسی',
    environmentStability: 'وضعیت پایداری محیط',
    environmentSupportContact: 'مسئول پشتیبانی محیط',
    emergencyStopContact: 'تماس اضطراری توقف تست',
  }, errors);

  if (config.primaryUrl.trim()) {
    try {
      new URL(config.primaryUrl);
    } catch {
      errors.primaryUrl = 'URL اصلی معتبر نیست.';
    }
  }
  if (config.accessStartAt && config.accessEndAt &&
      new Date(config.accessEndAt).getTime() <= new Date(config.accessStartAt).getTime()) {
    errors.accessEndAt = 'تاریخ پایان دسترسی باید بعد از تاریخ شروع باشد.';
  }

  if (config.environment === 'DEVELOPMENT') {
    requireFields(config.development as unknown as Record<string, unknown>, 'development.', {
      url: 'URL محیط Development',
      loginIdentifier: 'شناسه ورود',
      testAccounts: 'حساب‌های تست',
      accountRoles: 'نقش حساب‌ها',
      passwordDeliveryMethod: 'روش تحویل رمز',
      accountResetAvailable: 'امکان Reset حساب',
    }, errors);
    if (config.development.accountResetAvailable === 'YES' &&
        !config.development.accountResetContact?.trim()) {
      errors['development.accountResetContact'] = 'مسئول Reset حساب الزامی است.';
    }
  }

  if (config.environment === 'TEST') {
    requireFields(config.test as unknown as Record<string, unknown>, 'test.', {
      url: 'URL محیط Test',
      ssoProvider: 'نام SSO Provider',
      protocol: 'پروتکل',
      ssoTestAccounts: 'حساب‌های تست SSO',
      accountRoles: 'نقش حساب‌ها',
      mfaStatus: 'وضعیت MFA',
      sessionDurationMinutes: 'مدت Session',
      logoutBehavior: 'رفتار Logout',
      accountExpiresAt: 'تاریخ انقضای حساب',
    }, errors);
    if (config.test.sessionDurationMinutes &&
        (!/^\d+$/.test(config.test.sessionDurationMinutes) ||
          Number(config.test.sessionDurationMinutes) <= 0)) {
      errors['test.sessionDurationMinutes'] = 'مدت Session باید یک عدد مثبت باشد.';
    }
  }

  if (config.environment === 'PRODUCTION') {
    requireFields(config.production as unknown as Record<string, unknown>, 'production.', {
      url: 'URL محیط Production',
      controlledTestAccount: 'حساب تست کنترل‌شده',
      testAccountOwner: 'مالک حساب تست',
      accountRole: 'نقش حساب',
      businessOwnerPermission: 'مجوز مالک کسب‌وکار',
      technicalOwnerPermission: 'مجوز مسئول فنی',
      productionOwnerPermission: 'مجوز مالک Production',
      securityTeamPermission: 'مجوز تیم امنیت',
      authorizedTestDateTime: 'تاریخ و ساعت مجاز تست',
      emergencyContact: 'تماس اضطراری',
      monitoringConfirmed: 'تأیید Monitoring',
      backupOrRollbackConfirmed: 'تأیید Backup یا Rollback',
      automatedScanRestriction: 'محدودیت اسکن خودکار',
      dataChangeRestriction: 'محدودیت تغییر داده',
      dataDeletionRestriction: 'محدودیت حذف داده',
      stopCondition: 'شرط توقف تست',
    }, errors);
    ([
      ['businessOwnerPermission', 'مالک کسب‌وکار'],
      ['technicalOwnerPermission', 'مسئول فنی'],
      ['productionOwnerPermission', 'مالک Production'],
      ['securityTeamPermission', 'تیم امنیت'],
    ] as const).forEach(([field, label]) => {
      if (config.production[field] && config.production[field] !== 'APPROVED') {
        errors[`production.${field}`] = `برای شروع تست Production تأیید ${label} الزامی است.`;
      }
    });
    if (config.production.monitoringConfirmed === 'NO') {
      errors['production.monitoringConfirmed'] = 'تأیید Monitoring برای تست Production الزامی است.';
    }
    if (config.production.backupOrRollbackConfirmed === 'NO') {
      errors['production.backupOrRollbackConfirmed'] = 'تأیید Backup یا Rollback برای تست Production الزامی است.';
    }
  }

  return errors;
}
