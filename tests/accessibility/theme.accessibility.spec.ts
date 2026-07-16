import { test, expect } from '../fixtures/utms.fixture';
import { scanAccessibility } from '../helpers/accessibility';
import { roleStatePath } from '../helpers/api-context';
import { annotateTest, metadata } from '../helpers/traceability';

const seriousViolations = (result: Awaited<ReturnType<typeof scanAccessibility>>) =>
  result.violations.filter(item => item.impact === 'serious' || item.impact === 'critical');

test('UTMS-A11Y-THEME-001 @accessibility @state-transition persists an accessible night theme', async ({ page }, testInfo) => {
  annotateTest(testInfo, metadata('UTMS-A11Y-THEME-001', {
    requirement: 'Persistent WCAG 2.2 AA light and night appearance',
    feature: 'Theme control',
    level: 'e2e',
    type: 'accessibility',
    technique: 'State Transition Testing',
    role: 'ANONYMOUS',
    scope: 'N/A',
    data: 'Light preference → keyboard toggle → reload → dark OS preference',
    expected: 'Theme state, native color scheme, target size, contrast, persistence, and system fallback remain correct',
    risk: 'high',
  }));

  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('utms-theme'));
  await page.reload();

  const toggle = page.getByRole('button', { name: 'تغییر حالت نمایش' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');

  const target = await toggle.boundingBox();
  expect(target?.width).toBeGreaterThanOrEqual(44);
  expect(target?.height).toBeGreaterThanOrEqual(44);

  await toggle.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe('dark');
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(7, 13, 25)');
  await expect.poll(() => page.locator('.bg-white.rounded-2xl').first().evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgb(15, 23, 42)');
  await expect.poll(() => page.getByLabel('شماره تلفن *').evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgb(17, 28, 48)');

  const result = await scanAccessibility(page, testInfo);
  expect(seriousViolations(result)).toEqual([]);

  await page.setViewportSize({ width: 390, height: 844 });
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'تغییر حالت نمایش' })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'تغییر حالت نمایش' }).press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await page.evaluate(() => localStorage.removeItem('utms-theme'));
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test.describe('authenticated night theme', () => {
  test.use({ storageState: roleStatePath('DEVELOPER') });

  test('UTMS-A11Y-THEME-002 @accessibility scans primary authenticated surfaces in night mode', async ({ page }, testInfo) => {
    annotateTest(testInfo, metadata('UTMS-A11Y-THEME-002', {
      requirement: 'WCAG 2.2 AA night appearance for authenticated workflows',
      feature: 'Dashboard, navigation, notifications, and data entry',
      level: 'e2e',
      type: 'accessibility',
      technique: 'Interface Testing',
      role: 'DEVELOPER',
      scope: 'SYSTEMS',
      data: 'Persisted night theme with seeded developer context',
      expected: 'Representative desktop, mobile, and modal surfaces have no serious or critical Axe findings',
      risk: 'high',
    }));

    await page.addInitScript(() => localStorage.setItem('utms-theme', 'dark'));
    await page.goto('/dashboard');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(seriousViolations(await scanAccessibility(page, testInfo))).toEqual([]);

    await page.setViewportSize({ width: 320, height: 720 });
    const mobileToggle = page.locator('div.sticky').getByRole('button', { name: 'تغییر حالت نمایش' });
    await expect(mobileToggle).toBeVisible();
    await expect(page.getByRole('button', { name: 'تغییر حالت نمایش' })).toHaveCount(1);
    const mobileTarget = await mobileToggle.boundingBox();
    expect(mobileTarget?.width).toBeGreaterThanOrEqual(44);
    expect(mobileTarget?.height).toBeGreaterThanOrEqual(44);

    await page.goto('/test-requests');
    await page.getByRole('button', { name: 'درخواست جدید' }).click();
    const dialog = page.getByRole('dialog', { name: 'ایجاد درخواست تست جدید' });
    await expect(dialog).toBeVisible();
    await expect.poll(() => dialog.evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgb(15, 23, 42)');
    expect(seriousViolations(await scanAccessibility(page, testInfo))).toEqual([]);
  });
});
