import { test, expect } from '../fixtures/utms.fixture';
import { scanAccessibility } from '../helpers/accessibility';
import { roleStatePath } from '../helpers/api-context';
import { annotateTest, metadata } from '../helpers/traceability';

test('UTMS-A11Y-CAUSE-001 @accessibility @cause-effect checks the login surface', async ({ page }, testInfo) => {
  annotateTest(testInfo, metadata('UTMS-A11Y-CAUSE-001', {
    requirement: 'WCAG 2.2 AA login and validation behavior', feature: 'Authentication form', level: 'e2e',
    type: 'accessibility', technique: 'Cause-Effect Graphing', role: 'ANONYMOUS', scope: 'N/A', risk: 'high',
    data: 'Empty form cause → associated error effect', expected: 'No serious or critical automated accessibility violations',
  }));
  await page.goto('/');
  await page.getByRole('button', { name: 'ورود به سیستم' }).click();
  const result = await scanAccessibility(page, testInfo);
  expect(result.violations.filter(item => item.impact === 'serious' || item.impact === 'critical')).toEqual([]);
  await expect(page.getByLabel('شماره تلفن *')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('رمز عبور *')).toHaveAttribute('aria-invalid', 'true');
});

test.describe('authenticated screens', () => {
  test.use({ storageState: roleStatePath('QA_LEAD') });

  test('UTMS-A11Y-CAUSE-002 @accessibility @system scans the RTL dashboard', async ({ page }, testInfo) => {
    annotateTest(testInfo, metadata('UTMS-A11Y-CAUSE-002', {
      requirement: 'WCAG 2.2 AA dashboard, navigation, and live content', feature: 'Dashboard', level: 'e2e',
      type: 'accessibility', technique: 'Cause-Effect Graphing', role: 'QA_LEAD', scope: 'SYSTEMS', risk: 'high',
      data: 'Authenticated QA Lead storage state', expected: 'RTL dashboard has no serious or critical violations and keeps a named main heading',
    }));
    await page.goto('/dashboard');
    const result = await scanAccessibility(page, testInfo);
    expect(result.violations.filter(item => item.impact === 'serious' || item.impact === 'critical')).toEqual([]);
    await expect(page.locator('html[dir="rtl"]')).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();
  });
});

