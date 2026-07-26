import { expect, test } from '@playwright/test';
import {
  createEmptySecurityTestConfiguration,
  validateSecurityTestConfiguration,
} from '../../apps/web/src/utils/securityTest';
import type { SecurityTestConfiguration } from '../../apps/web/src/types';

function fillTechnicalSecurityRequestInfo(config: SecurityTestConfiguration) {
  config.systemType = 'Web Application';
  config.frontend = 'React';
  config.gateway = 'JavaScript Gateway';
  config.backend = 'Node.js';
  config.database = 'PostgreSQL';
  config.webServer = 'Nginx';
  config.communicationModel = 'gateway + dataservice';
  config.securityTestType = 'GRAY_BOX';
  config.primaryTestMethod = 'URL و حساب‌های تست';
}

async function domainRpc(
  request: import('@playwright/test').APIRequestContext,
  service: string,
  method: string,
  args: unknown[]
) {
  const apiBaseUrl = process.env.UTMS_API_BASE_URL || 'http://127.0.0.1:4174';
  const response = await request.post(`${apiBaseUrl}/api/domain/rpc`, {
    data: { service, method, args },
  });
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  return body.data;
}

test('security configuration requires common access metadata', () => {
  const config = createEmptySecurityTestConfiguration();
  const errors = validateSecurityTestConfiguration(config);

  expect(errors.requestType).toBeTruthy();
  expect(errors.environment).toBeTruthy();
  expect(errors.primaryUrl).toBeTruthy();
  expect(errors.accessStartAt).toBeTruthy();
  expect(errors.accessEndAt).toBeTruthy();
  expect(errors.frontend).toBeTruthy();
  expect(errors.securityTestType).toBeTruthy();
  expect(errors.environmentSupportContact).toBeTruthy();
  expect(errors.emergencyStopContact).toBeTruthy();
});

test('development security configuration never contains a password field', () => {
  const config = createEmptySecurityTestConfiguration();
  const serializedKeys = JSON.stringify(config);

  expect(serializedKeys).not.toContain('"password"');
  expect(serializedKeys).toContain('"passwordDeliveryMethod"');
});

test('test environment cannot start without SSO test accounts', () => {
  const config = createEmptySecurityTestConfiguration();
  config.requestType = 'NEW_VERSION';
  fillTechnicalSecurityRequestInfo(config);
  config.environment = 'TEST';
  config.primaryUrl = 'https://test.example.ir';
  config.accessStatus = 'VPN';
  config.vpnRequired = 'YES';
  config.ipWhitelistRequired = 'NO';
  config.allowedTestHours = '08:00-16:00';
  config.accessStartAt = '2026-07-27T08:00';
  config.accessEndAt = '2026-07-28T16:00';
  config.environmentStability = 'STABLE';
  config.environmentSupportContact = 'Support 09120000000';
  config.emergencyStopContact = 'Emergency 09121111111';
  config.test.url = 'https://test.example.ir';
  config.test.ssoProvider = 'Government SSO';
  config.test.protocol = 'OPENID_CONNECT';
  config.test.accountRoles = 'operator';
  config.test.mfaStatus = 'ENABLED';
  config.test.sessionDurationMinutes = '30';
  config.test.logoutBehavior = 'SSO_AND_APPLICATION';
  config.test.accountExpiresAt = '2026-08-01T00:00';

  const errors = validateSecurityTestConfiguration(config);
  expect(errors['test.ssoTestAccounts']).toBeTruthy();

  config.test.ssoTestAccounts = 'security-operator@example.ir';
  expect(validateSecurityTestConfiguration(config)).toEqual({});
});

test('production security configuration requires explicit permissions and stop controls', () => {
  const config = createEmptySecurityTestConfiguration();
  config.requestType = 'INITIAL';
  fillTechnicalSecurityRequestInfo(config);
  config.environment = 'PRODUCTION';
  config.primaryUrl = 'https://prod.example.ir';
  config.accessStatus = 'IP_WHITELIST';
  config.vpnRequired = 'NO';
  config.ipWhitelistRequired = 'YES';
  config.allowedTestHours = '01:00-03:00';
  config.accessStartAt = '2026-07-27T01:00';
  config.accessEndAt = '2026-07-27T03:00';
  config.environmentStability = 'STABLE';
  config.environmentSupportContact = 'Production Support 09120000000';
  config.emergencyStopContact = 'Incident Commander 09121111111';
  config.production.url = 'https://prod.example.ir';
  config.production.controlledTestAccount = 'security-controlled-account';
  config.production.testAccountOwner = 'Business Owner';
  config.production.accountRole = 'operator';
  config.production.authorizedTestDateTime = '2026-07-27T01:00';
  config.production.emergencyContact = 'Incident Commander 09121111111';
  config.production.monitoringConfirmed = 'YES';
  config.production.backupOrRollbackConfirmed = 'YES';
  config.production.automatedScanRestriction = 'LIMITED';
  config.production.dataChangeRestriction = 'No permanent writes';
  config.production.dataDeletionRestriction = 'Deletion prohibited';
  config.production.stopCondition = 'Stop on elevated error rate';
  let errors = validateSecurityTestConfiguration(config);
  expect(errors['production.businessOwnerPermission']).toBeTruthy();
  expect(errors['production.securityTeamPermission']).toBeTruthy();

  config.production.businessOwnerPermission = 'APPROVED';
  config.production.technicalOwnerPermission = 'APPROVED';
  config.production.productionOwnerPermission = 'APPROVED';
  config.production.securityTeamPermission = 'APPROVED';
  errors = validateSecurityTestConfiguration(config);
  expect(errors).toEqual({});

  config.production.securityTeamPermission = 'REJECTED';
  errors = validateSecurityTestConfiguration(config);
  expect(errors['production.securityTeamPermission']).toContain('تأیید تیم امنیت');
});

test('assigning a test request creates an in-app notification for the QA specialist', async ({ request }) => {
  const created = await domainRpc(request, 'testRequestApi', 'create', [
    {
      title: 'بررسی اعلان ارجاع درخواست تست',
      description: 'درخواست مستقل برای کنترل اعلان داخل سامانه به کارشناس تست',
      version: '1.0.0',
      buildNumber: 'security-notification-1',
      environment: 'development',
      priority: 'MEDIUM',
      riskLevel: 'MEDIUM',
      systemUrl: 'https://notification-test.example.ir',
      selectedRequirementIds: [],
      testTypes: ['FUNCTIONAL'],
    },
    'user-1',
    'app-1',
  ]);
  await domainRpc(request, 'testRequestApi', 'submit', [created.id, 'user-1']);
  await domainRpc(request, 'testRequestApi', 'review', [
    created.id,
    'user-2',
    'ACCEPTED',
    'پذیرش برای ارجاع',
  ]);
  await domainRpc(request, 'testRequestApi', 'assign', [
    created.id,
    'user-3',
    'user-2',
  ]);

  const notifications = await domainRpc(request, 'notificationApi', 'getByUser', ['user-3']);
  const assignmentNotification = notifications.find(
    (notification: { entityId?: string; title?: string; channels?: string[] }) =>
      notification.entityId === created.id &&
      notification.title === 'ارجاع درخواست تست'
  );

  expect(assignmentNotification).toBeTruthy();
  expect(assignmentNotification.channels).toContain('IN_APP');

  const auditLogs = await domainRpc(request, 'auditLogApi', 'getByEntity', [
    'TEST_REQUEST',
    created.id,
  ]);
  const assignmentLog = auditLogs.find(
    (log: { action?: string }) => log.action === 'ASSIGN'
  );
  expect(assignmentLog).toBeTruthy();
  expect(JSON.parse(assignmentLog.newValue)).toMatchObject({
    assigneeId: 'user-3',
  });
});

test('security review is request-scoped, explicitly selected, and hands off to Tech Lead', async ({ request }) => {
  const testRequest = await domainRpc(request, 'testRequestApi', 'create', [
    {
      title: 'گردش کامل تست امنیت درخواست',
      description: 'درخواست مستقل برای کنترل گردش QA، کارشناس امنیت و سرپرست فنی',
      version: '2.1.0',
      environment: 'development',
      priority: 'HIGH',
      riskLevel: 'HIGH',
      systemUrl: 'https://security-flow.example.ir',
      selectedRequirementIds: [],
      testTypes: ['FUNCTIONAL', 'SECURITY'],
    },
    'user-1',
    'app-1',
  ]);
  await domainRpc(request, 'testRequestApi', 'submit', [testRequest.id, 'user-1']);
  await domainRpc(request, 'testRequestApi', 'review', [
    testRequest.id,
    'user-2',
    'ACCEPTED',
    'پذیرش درخواست',
  ]);
  await domainRpc(request, 'testRequestApi', 'assign', [
    testRequest.id,
    'user-3',
    'user-2',
  ]);

  const requirement = await domainRpc(request, 'requirementApi', 'create', [
    {
      title: 'نیازمندی گردش تست امنیت',
      description: 'نیازمندی قابل ردیابی برای پرونده امنیت',
      acceptanceCriteria: 'گردش امنیت تا سرپرست فنی تکمیل شود',
      testRequestId: testRequest.id,
    },
    'user-1',
    'app-1',
  ]);
  const flow = await domainRpc(request, 'flowApi', 'create', [
    {
      requirementId: requirement.id,
      title: 'جریان اصلی تست امنیت',
      description: 'ورود، اجرای سناریو و بررسی نتیجه',
      steps: 'ورود و اجرای سناریو',
    },
    'user-1',
  ]);
  await domainRpc(request, 'requirementApi', 'update', [
    requirement.id,
    { status: 'APPROVED' },
    'user-2',
  ]);
  const testCase = await domainRpc(request, 'testCaseApi', 'create', [
    {
      testRequestId: testRequest.id,
      requirementId: requirement.id,
      flowId: flow.id,
      title: 'تست کیس موفق گردش امنیت',
      scenario: 'اعتبارسنجی گردش درخواست',
      preconditions: 'درخواست پذیرفته و ارجاع شده باشد',
      testData: 'داده کنترل‌شده',
      steps: '۱. ورود ۲. اجرای سناریو',
      expectedResult: 'سناریو موفق باشد',
      testType: 'FUNCTIONAL',
      testDesignTechnique: 'REQUIREMENTS_BASED',
      priority: 'HIGH',
      riskLevel: 'HIGH',
      qualityAttribute: 'FUNCTIONALITY',
      isActive: true,
    },
    'user-3',
    'app-1',
  ]);
  const run = await domainRpc(request, 'testRunApi', 'create', [
    {
      testCaseId: testCase.id,
      testRequestId: testRequest.id,
      version: '2.1.0',
      buildNumber: 'security-flow-1',
      purposes: ['FUNCTIONAL_TEST'],
    },
    'user-3',
    'app-1',
    'QA_SPECIALIST',
  ]);
  await domainRpc(request, 'testRunApi', 'updateStatus', [
    run.id,
    'PASSED',
    'اجرای موفق',
    'user-3',
  ]);
  await domainRpc(request, 'testRunApi', 'finalize', [run.id, 'user-3']);

  const versionHistory = await domainRpc(request, 'releasePublishApi', 'create', [
    { primaryTestRequestId: testRequest.id, relatedRequestIds: [] },
    'user-2',
    'app-1',
    'QA_LEAD',
  ]);
  expect(versionHistory.buildNumber).toBeUndefined();

  const versionWithQaBuild = await domainRpc(
    request,
    'releasePublishApi',
    'setMissingBuildNumber',
    [versionHistory.id, 'security-flow-1', 'user-2', 'QA_LEAD']
  );
  expect(versionWithQaBuild.buildNumber).toBe('security-flow-1');
  const requestWithQaBuild = await domainRpc(request, 'testRequestApi', 'getById', [
    testRequest.id,
  ]);
  expect(requestWithQaBuild.buildNumber).toBe('security-flow-1');

  const reviewsBeforeSelection = await domainRpc(
    request,
    'securityChecklistApi',
    'getAllForApp',
    ['app-1']
  );
  expect(reviewsBeforeSelection.some(
    (review: { testRequestId?: string }) => review.testRequestId === testRequest.id
  )).toBeFalsy();

  const retestRequired = await domainRpc(request, 'releasePublishApi', 'setQAQuality', [
    versionHistory.id,
    'RETEST_REQUIRED',
    'اجرای موفق است اما برای اطمینان باید یک اجرای مستقل دیگر ثبت شود',
    'user-2',
    'QA_LEAD',
  ]);
  expect(retestRequired.status).toBe('QA_REVIEW');
  expect(retestRequired.qaQualityStatus).toBe('RETEST_REQUIRED');

  const prematureApproval = await domainRpc(request, 'releasePublishApi', 'setQAQuality', [
    versionHistory.id,
    'READY',
    'تلاش برای تأیید بدون اجرای جدید',
    'user-2',
    'QA_LEAD',
  ]);
  expect(prematureApproval).toBeNull();

  const retestNotifications = await domainRpc(
    request,
    'notificationApi',
    'getByUser',
    ['user-3']
  );
  expect(retestNotifications.some(
    (notification: { entityId?: string; title?: string }) =>
      notification.entityId === testRequest.id &&
      notification.title === 'احتیاج به اجرای مجدد'
  )).toBeTruthy();

  const secondRun = await domainRpc(request, 'testRunApi', 'create', [
    {
      testCaseId: testCase.id,
      testRequestId: testRequest.id,
      previousRunId: run.id,
      version: '2.1.0',
      buildNumber: 'security-flow-1',
      purposes: ['RETEST'],
    },
    'user-3',
    'app-1',
    'QA_SPECIALIST',
  ]);
  await domainRpc(request, 'testRunApi', 'updateStatus', [
    secondRun.id,
    'PASSED',
    'اجرای مجدد موفق',
    'user-3',
  ]);
  await domainRpc(request, 'testRunApi', 'finalize', [secondRun.id, 'user-3']);

  const requestAfterRetest = await domainRpc(request, 'testRequestApi', 'getById', [
    testRequest.id,
  ]);
  expect(requestAfterRetest.qaQualityStatus).toBe('IN_PROGRESS');
  expect(requestAfterRetest.qaQualityNotes).toContain('اجرای مستقل دیگر');

  const config = createEmptySecurityTestConfiguration();
  config.requestType = 'NEW_VERSION';
  fillTechnicalSecurityRequestInfo(config);
  config.environment = 'DEVELOPMENT';
  config.primaryUrl = 'https://security-flow.example.ir';
  config.accessStatus = 'VPN';
  config.vpnRequired = 'YES';
  config.ipWhitelistRequired = 'NO';
  config.allowedTestHours = '08:00-16:00';
  config.accessStartAt = '2026-07-27T08:00';
  config.accessEndAt = '2026-07-28T16:00';
  config.environmentStability = 'STABLE';
  config.environmentSupportContact = 'پشتیبان محیط 09120000000';
  config.emergencyStopContact = 'مسئول توقف 09121111111';
  config.development.url = 'https://security-flow.example.ir';
  config.development.loginIdentifier = 'security-reviewer@example.ir';
  config.development.testAccounts = 'security-reviewer@example.ir';
  config.development.accountRoles = 'کاربر عادی';
  config.development.passwordDeliveryMethod = 'VAULT';
  config.development.accountResetAvailable = 'YES';
  config.development.accountResetContact = 'پشتیبان حساب 09122222222';

  const qaReviewed = await domainRpc(request, 'releasePublishApi', 'setQAQuality', [
    versionHistory.id,
    'READY',
    'تست نرم‌افزار موفق و تست امنیت الزامی است',
    'user-2',
    'QA_LEAD',
    true,
    config,
  ]);
  expect(qaReviewed.status).toBe('SECURITY_REVIEW');

  const reviews = await domainRpc(request, 'securityChecklistApi', 'getAllForApp', ['app-1']);
  const review = reviews.find(
    (item: { testRequestId?: string }) => item.testRequestId === testRequest.id
  );
  expect(review).toBeTruthy();
  expect(review.testRequestId).toBe(testRequest.id);
  expect(review).not.toHaveProperty('testCaseId');
  expect(review.requestSummary.buildNumber).toBe('security-flow-1');
  expect(review.requestSummary.testCases).toHaveLength(1);
  expect(review.requestSummary.finalRuns).toHaveLength(2);

  const securityNotifications = await domainRpc(
    request,
    'notificationApi',
    'getByUser',
    ['user-5']
  );
  expect(securityNotifications.some(
    (notification: { entityId?: string; title?: string }) =>
      notification.entityId === testRequest.id &&
      notification.title === 'درخواست تست امنیت جدید'
  )).toBeTruthy();

  for (const item of review.items) {
    await domainRpc(request, 'securityChecklistApi', 'updateItem', [
      review.id,
      item.id,
      'PASS',
      'بررسی شد',
      'user-5',
    ]);
  }
  await domainRpc(request, 'securityChecklistApi', 'complete', [review.id, 'user-5']);

  const handedOffVersion = await domainRpc(
    request,
    'releasePublishApi',
    'getById',
    [versionHistory.id]
  );
  expect(handedOffVersion.status).toBe('PENDING_DECISION');

  const techLeadNotifications = await domainRpc(
    request,
    'notificationApi',
    'getByUser',
    ['user-6']
  );
  expect(techLeadNotifications.some(
    (notification: { entityId?: string; title?: string }) =>
      notification.entityId === versionHistory.id &&
      notification.title === 'تست امنیت تکمیل شد'
  )).toBeTruthy();

  const approvedVersion = await domainRpc(request, 'releasePublishApi', 'decide', [
    versionHistory.id,
    'APPROVED',
    'تأیید انتشار پس از تکمیل تست نرم‌افزار و امنیت',
    'user-6',
    'TECH_LEAD',
  ]);
  expect(approvedVersion.status).toBe('APPROVED');
  expect(approvedVersion.decision).toBe('APPROVED');

  const completedRequest = await domainRpc(request, 'testRequestApi', 'getById', [
    testRequest.id,
  ]);
  expect(completedRequest.status).toBe('COMPLETED');
  expect(completedRequest.releaseDecision).toBe('APPROVED');
});
