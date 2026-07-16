import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '../fixtures/utms.fixture';
import { roleStatePath } from '../helpers/api-context';
import { annotateTest, metadata } from '../helpers/traceability';

const routes = [
  '/dashboard', '/test-requests', '/requirements', '/test-cases', '/test-runs',
  '/bugs', '/test-runs-bugs', '/developer-board', '/run-issues', '/checklists',
  '/playwright', '/playwright-files', '/releases', '/reports', '/api-console',
  '/users', '/applications', '/checklist-admin', '/admin-operations', '/audit', '/settings',
] as const;

test.use({ storageState: roleStatePath('SYSTEM_ADMIN') });

test('UTMS-A11Y-THEME-003 @accessibility @route-matrix audits every cartable in night mode', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  annotateTest(testInfo, metadata('UTMS-A11Y-THEME-003', {
    requirement: 'WCAG 2.2 AA night appearance across every UTMS cartable',
    feature: 'Application-wide night theme',
    level: 'e2e',
    type: 'accessibility',
    technique: 'Route Matrix Testing',
    role: 'SYSTEM_ADMIN',
    scope: 'APP',
    data: 'All application routes with a persisted night preference',
    expected: 'Every cartable renders in night mode without serious or critical Axe findings',
    risk: 'high',
  }));

  await page.addInitScript(() => localStorage.setItem('utms-theme', 'dark'));

  for (const route of routes) {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html'), route).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('main').first(), route).toBeVisible();
    await page.evaluate(() => new Promise<void>(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));
    await expect(page.locator('[role="status"]'), `${route} loading state`).toHaveCount(0);
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const serious = result.violations
      .filter(item => item.impact === 'serious' || item.impact === 'critical')
      .map(item => ({ id: item.id, description: item.description, targets: item.nodes.flatMap(node => node.target) }));
    expect(serious, route).toEqual([]);
  }
});
