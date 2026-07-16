import { test, expect } from '../fixtures/utms.fixture';
import { roleStatePath } from '../helpers/api-context';
import { annotateTest, metadata } from '../helpers/traceability';

test.describe('test management application scope', () => {
  test.use({ storageState: roleStatePath('QA_LEAD') });

  test('UTMS-TC-SCOPE-017 @e2e identifies the requirement application when adding a test case', async ({ page }, testInfo) => {
    annotateTest(testInfo, metadata('UTMS-TC-SCOPE-017', {
      requirement: 'Requirement application identity in Test Case form', feature: 'Test case design', level: 'e2e',
      type: 'ui-ux', technique: 'Data Flow Testing', role: 'QA_LEAD,QA_SPECIALIST', scope: 'SYSTEMS', risk: 'high',
      data: 'Ready requirements in the active application', expected: 'Every requirement option identifies its application',
    }));
    await page.goto('/test-cases');
    await page.getByRole('button', { name: 'تست کیس جدید' }).click();
    const dialog = page.getByRole('dialog', { name: 'ایجاد تست کیس جدید' });
    await dialog.getByLabel('سامانه تست کیس *').selectOption('app-1');
    const requirementSelect = dialog.getByLabel('نیازمندی مرتبط * (اجباری)');

    await expect(requirementSelect.locator('option').filter({ hasText: 'سامانه بانکداری آنلاین' }).first()).toBeAttached();
    await requirementSelect.selectOption('req-1');
    await expect(dialog.getByText('سامانه: سامانه بانکداری آنلاین', { exact: true })).toBeVisible();
  });

  test('UTMS-RUN-SCOPE-018 @e2e loads requirements after selecting the request application', async ({ page }, testInfo) => {
    annotateTest(testInfo, metadata('UTMS-RUN-SCOPE-018', {
      requirement: 'Test Request to Requirement cascade in Test Run wizard', feature: 'Test execution wizard', level: 'e2e',
      type: 'functional', technique: 'State Transition Testing', role: 'QA_LEAD,QA_SPECIALIST', scope: 'SYSTEMS', risk: 'critical',
      data: 'Request tr-2, requirement req-2 and ready test case tc-3', expected: 'Request selects its application, then requirement, then matching test case',
    }));
    await page.goto('/test-runs');
    await expect(page).toHaveURL(/\/test-runs-bugs$/);
    await page.getByRole('button', { name: 'اجرای جدید' }).click();
    const dialog = page.getByRole('dialog', { name: /مرحله ۱: اجرای تست/ });
    const requestSelect = dialog.getByLabel('درخواست تست *');
    const requirementSelect = dialog.getByLabel('نیازمندی مرتبط با سامانه *');
    const testCaseSelect = dialog.getByLabel('تست کیس *');

    await requestSelect.selectOption('tr-2');
    await expect(dialog.getByText('سامانه درخواست تست:').locator('..')).toContainText('سامانه بانکداری آنلاین');
    await expect(requirementSelect).toBeEnabled();
    await expect(requirementSelect.locator('option[value="req-2"]')).toContainText('گزارش تراکنش‌ها');

    await requirementSelect.selectOption('req-2');
    await expect(testCaseSelect).toBeEnabled();
    await expect(testCaseSelect.locator('option[value="tc-3"]')).toContainText('فیلتر گزارش');

    await requestSelect.selectOption('tr-3');
    await expect(requirementSelect).toHaveValue('');
    await expect(testCaseSelect).toHaveValue('');

    await requestSelect.selectOption('tr-2');
    await requirementSelect.selectOption('req-2');
    await testCaseSelect.selectOption('tc-3');
    await dialog.getByRole('button', { name: 'تست عملکردی', exact: true }).click();
    await dialog.getByLabel('نتیجه تست *').selectOption('PASSED');
    await dialog.getByLabel('نتیجه واقعی *').fill('اجرای محدوده سامانه با موفقیت ثبت شد.');
    await dialog.getByRole('button', { name: 'ذخیره', exact: true }).click();
    await expect(page.getByText('اجرای تست ثبت شد.')).toBeVisible();
  });
});

test.describe('QA specialist application scope', () => {
  test.use({ storageState: roleStatePath('QA_SPECIALIST') });

  test('UTMS-RUN-SCOPE-019 @e2e keeps assigned execution data inside the request application', async ({ page }, testInfo) => {
    annotateTest(testInfo, metadata('UTMS-RUN-SCOPE-019', {
      requirement: 'QA Specialist multi-system test management scope', feature: 'Test case and execution selection', level: 'e2e',
      type: 'security-functional', technique: 'Data Flow Testing', role: 'QA_SPECIALIST', scope: 'SYSTEMS', risk: 'critical',
      data: 'Assigned request tr-2 and its ready requirement/test case', expected: 'The specialist sees application identity and the scoped request cascade',
    }));
    await page.goto('/test-cases');
    await page.getByRole('button', { name: 'تست کیس جدید' }).click();
    const testCaseDialog = page.getByRole('dialog', { name: 'ایجاد تست کیس جدید' });
    await expect(testCaseDialog.getByLabel('نیازمندی مرتبط * (اجباری)').locator('option').filter({ hasText: 'سامانه بانکداری آنلاین' }).first()).toBeAttached();
    await testCaseDialog.getByRole('button', { name: 'انصراف' }).click();

    await page.goto('/test-runs-bugs');
    await page.getByRole('button', { name: 'اجرای جدید' }).click();
    const runDialog = page.getByRole('dialog', { name: /مرحله ۱: اجرای تست/ });
    await runDialog.getByLabel('درخواست تست *').selectOption('tr-2');
    await expect(runDialog.getByLabel('نیازمندی مرتبط با سامانه *').locator('option[value="req-2"]')).toBeAttached();
    await runDialog.getByLabel('نیازمندی مرتبط با سامانه *').selectOption('req-2');
    await expect(runDialog.getByLabel('تست کیس *').locator('option[value="tc-3"]')).toBeAttached();
  });
});

test.describe('developer multi-system creation scope', () => {
  test.use({ storageState: roleStatePath('DEVELOPER') });

  test('UTMS-REQUEST-SCOPE-021 @e2e requires a system and filters linked requirements', async ({ page }, testInfo) => {
    annotateTest(testInfo, metadata('UTMS-REQUEST-SCOPE-021', {
      requirement: 'Explicit application for Test Request creation', feature: 'Test request creation', level: 'e2e',
      type: 'data-integrity-ui', technique: 'Data Flow Testing', role: 'DEVELOPER', scope: 'SYSTEMS', risk: 'critical',
      data: 'Developer context with app-1 and app-2; app-1 requirement req-1', expected: 'No implicit first app and only same-app requirements are selectable',
    }));

    await page.goto('/test-requests');
    await page.getByRole('button', { name: 'درخواست جدید' }).click();
    const dialog = page.getByRole('dialog', { name: 'ایجاد درخواست تست جدید' });
    const applicationSelect = dialog.getByLabel('سامانه درخواست تست *');
    await expect(applicationSelect).toHaveValue('');
    await expect(applicationSelect.getByRole('option', { name: /سامانه بانکداری آنلاین/ })).toBeAttached();
    await expect(applicationSelect.getByRole('option', { name: /سامانه مدیریت منابع انسانی/ })).toBeAttached();

    await applicationSelect.selectOption('app-1');
    await expect(dialog.getByText(/انتقال وجه زمان‌بندی شده/).first()).toBeVisible();
    await applicationSelect.selectOption('app-2');
    await expect(dialog.getByText('نیازمندی فعالی برای این سامانه نیست')).toBeVisible();
    await expect(dialog.getByText(/انتقال وجه زمان‌بندی شده/)).toHaveCount(0);
  });
});

test.describe('multi-role working context', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('UTMS-AUTH-CONTEXT-020 @e2e groups duplicate roles and switches role without logout', async ({ page }, testInfo) => {
    annotateTest(testInfo, metadata('UTMS-AUTH-CONTEXT-020', {
      requirement: 'In-session role switching with real application names', feature: 'Authentication context', level: 'e2e',
      type: 'functional-ui', technique: 'State Transition Testing', role: 'DEVELOPER,BA', scope: 'SYSTEMS', risk: 'critical',
      data: 'user-1 with two Developer assignments and one BA assignment', expected: 'One Developer option, real system names, and an in-session switch to BA',
    }));

    await page.goto('/login');
    await page.getByLabel('شماره تلفن').fill('09121234567');
    await page.getByLabel('رمز عبور').fill('test-password');
    await page.getByRole('button', { name: 'ورود به سیستم' }).click();

    const developerContext = page.getByRole('button', { name: /توسعه‌دهنده/ });
    await expect(developerContext).toHaveCount(1);
    await expect(developerContext).toContainText('سامانه بانکداری آنلاین');
    await expect(developerContext).toContainText('سامانه مدیریت منابع انسانی');
    await expect(page.getByText(/چند سامانه/)).toHaveCount(0);
    await developerContext.click();

    await expect(page).toHaveURL(/\/dashboard$/);
    const switcher = page.locator('header').getByRole('button', { name: 'تغییر نقش و محیط کاری' });
    await switcher.click();
    await page.getByRole('menuitemradio', { name: /تحلیلگر کسب‌وکار/ }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator('header').getByRole('button', { name: 'تغییر نقش و محیط کاری' })).toContainText('تحلیلگر کسب‌وکار');
    await expect(page.locator('header')).toContainText('سامانه مدیریت منابع انسانی');
  });
});
