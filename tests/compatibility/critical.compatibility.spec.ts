import { test, expect } from '../fixtures/utms.fixture';
import { roleStatePath } from '../helpers/api-context';
import { annotateTest, metadata } from '../helpers/traceability';

test.use({ storageState: roleStatePath('DEVELOPER') });

test('UTMS-COMP-SCN-001 @compatibility @scenario renders navigation and preserves RTL', async ({ page }, testInfo) => {
  annotateTest(testInfo, metadata('UTMS-COMP-SCN-001', {
    requirement: 'Compatibility matrix: Chromium, Firefox, WebKit; desktop and RTL', feature: 'Dashboard navigation', level: 'e2e',
    type: 'compatibility', technique: 'Scenario Testing', role: 'DEVELOPER', scope: 'SYSTEMS', risk: 'medium',
    data: 'Authenticated desktop context', expected: 'The dashboard, navigation, and route transition work on each browser project',
  }));
  await page.goto('/dashboard');
  await expect(page.locator('html[dir="rtl"]')).toBeVisible();
  await expect(page.getByRole('heading').first()).toBeVisible();
  const requestsLink = page.getByRole('link', { name: 'درخواست‌های تست' });
  if (await requestsLink.count()) {
    await requestsLink.click();
    await expect(page).toHaveURL(/\/test-requests$/);
  }
});

