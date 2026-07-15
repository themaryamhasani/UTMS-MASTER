import { test, expect } from '../fixtures/utms.fixture';
import { roleStatePath } from '../helpers/api-context';
import { annotateTest, metadata } from '../helpers/traceability';

test.describe('developer workflow', () => {
  test.use({ storageState: roleStatePath('DEVELOPER') });

  test('UTMS-REQ-STATE-001 @e2e @state-transition creates and submits a test request', async ({ page }, testInfo) => {
    annotateTest(testInfo, metadata('UTMS-REQ-STATE-001', {
      requirement: 'Developer to QA workflow steps 1-5', feature: 'Test request', level: 'e2e', type: 'ui-ux',
      technique: 'State Transition Testing', role: 'DEVELOPER', scope: 'SYSTEMS', risk: 'critical',
      data: 'Valid request plus an existing requirement/flow', expected: 'DRAFT is created, visible after refresh, then transitions to SUBMITTED',
    }));
    const title = 'درخواست خودکار پرداخت پایدار';
    await page.goto('/test-requests');
    await page.getByRole('button', { name: 'درخواست جدید' }).click();
    const dialog = page.getByRole('dialog', { name: 'ایجاد درخواست تست جدید' });
    await dialog.getByLabel('عنوان درخواست *').fill(title);
    await dialog.getByLabel('توضیحات').fill('ایجادشده توسط آزمون قطعی Playwright');
    await dialog.getByLabel('نسخه *').fill('2.5.0');
    await dialog.getByLabel('شماره بیلد').fill('build-250');
    await dialog.getByLabel('آدرس سامانه').fill('https://app.example.com');
    await dialog.getByRole('checkbox').first().check();
    await dialog.getByRole('button', { name: 'ایجاد', exact: true }).click();
    await expect(page.getByText('درخواست تست ایجاد شد.')).toBeVisible();
    await expect(page.getByText(title)).toBeVisible();

    await page.reload();
    await expect(page.getByText(title)).toBeVisible();
    await page.getByText(title).first().click();
    const details = page.getByRole('dialog', { name: 'جزئیات درخواست تست' });
    await expect(details.getByText('پیش‌نویس')).toBeVisible();
    await details.getByRole('button', { name: 'ارسال', exact: true }).click();
    await expect(page.getByText('ارسال شد.')).toBeVisible();
    await page.getByText(title).first().click();
    await expect(page.getByRole('dialog', { name: 'جزئیات درخواست تست' }).getByText('ارسال شده')).toBeVisible();
  });

  test('UTMS-AUTH-STATE-002 @e2e @state-transition restores session and logs out safely', async ({ page }, testInfo) => {
    annotateTest(testInfo, metadata('UTMS-AUTH-STATE-002', {
      requirement: 'Authentication refresh/logout workflow', feature: 'Authentication', level: 'e2e', type: 'functional',
      technique: 'State Transition Testing', role: 'DEVELOPER', scope: 'SYSTEMS', risk: 'high',
      data: 'Authenticated storage state → refresh → logout confirmation', expected: 'Refresh preserves context and logout returns to login',
    }));
    await page.goto('/dashboard');
    await page.reload();
    await expect(page.getByText('احمد محمدی', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'خروج از سیستم' }).click();
    const dialog = page.getByRole('dialog', { name: 'تایید خروج' });
    await dialog.getByRole('button', { name: 'خروج', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'سامانه UTMS' })).toBeVisible();
  });
});

test.describe('direct-route authorization', () => {
  test.use({ storageState: roleStatePath('SECURITY_REVIEWER') });
  test('UTMS-RBAC-SEC-003 @e2e @security redirects an unauthorized direct URL', async ({ page }, testInfo) => {
    annotateTest(testInfo, metadata('UTMS-RBAC-SEC-003', {
      requirement: 'App GuardedRoute and role × cartable matrix', feature: 'Route authorization', level: 'e2e', type: 'security',
      technique: 'Decision Table Testing', role: 'SECURITY_REVIEWER', scope: 'APP', risk: 'critical',
      data: 'Direct navigation to /users', expected: 'Restricted page never renders and route redirects to dashboard',
    }));
    await page.goto('/users');
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: 'مدیریت کاربران و نقش‌ها' })).toHaveCount(0);
  });
});
