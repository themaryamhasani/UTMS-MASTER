import { test, expect } from '../fixtures/utms.fixture';
import { annotateTest, metadata } from '../helpers/traceability';

test('UTMS-COMP-THEME-003 @compatibility keeps theme behavior portable across browsers', async ({ page }, testInfo) => {
  annotateTest(testInfo, metadata('UTMS-COMP-THEME-003', {
    requirement: 'Portable system preference and persistent theme behavior',
    feature: 'Theme control',
    level: 'e2e',
    type: 'compatibility',
    technique: 'Browser Compatibility Testing',
    role: 'ANONYMOUS',
    scope: 'N/A',
    data: 'Dark OS preference → explicit light choice → reload at 320px',
    expected: 'Theme resolution, persistence, and narrow layout behave consistently in supported engines',
    risk: 'medium',
  }));

  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('utms-theme'));
  await page.reload();

  const toggle = page.getByRole('button', { name: 'تغییر حالت نمایش' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');

  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.setViewportSize({ width: 320, height: 720 });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
});
