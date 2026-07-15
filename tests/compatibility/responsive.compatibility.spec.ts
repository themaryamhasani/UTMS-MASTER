import { test, expect } from '../fixtures/utms.fixture';
import { roleStatePath } from '../helpers/api-context';
import { annotateTest, metadata } from '../helpers/traceability';

const applicationRoutes = [
  '/dashboard',
  '/test-requests',
  '/requirements',
  '/test-cases',
  '/test-runs',
  '/bugs',
  '/test-runs-bugs',
  '/developer-board',
  '/run-issues',
  '/checklists',
  '/playwright',
  '/playwright-files',
  '/releases',
  '/reports',
  '/api-console',
  '/users',
  '/applications',
  '/checklist-admin',
  '/admin-operations',
  '/audit',
  '/settings',
] as const;

async function expectNoViewportOverflow(page: import('@playwright/test').Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));

  expect(dimensions.document, JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.body, JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.viewport + 1);
}

test.describe('responsive application shell', () => {
  test.use({ storageState: roleStatePath('SYSTEM_ADMIN') });

  test('UTMS-COMP-RWD-001 @compatibility keeps every cartable inside a narrow viewport', async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    annotateTest(testInfo, metadata('UTMS-COMP-RWD-001', {
      requirement: 'All UTMS cartables remain usable from 320 CSS pixels upward', feature: 'Responsive layout', level: 'e2e',
      type: 'compatibility', technique: 'Route matrix testing', role: 'SYSTEM_ADMIN', scope: 'APP', risk: 'high',
      data: 'Every application route at 320x720', expected: 'Visible main content with no document-level horizontal overflow',
    }));

    await page.setViewportSize({ width: 320, height: 720 });
    for (const route of applicationRoutes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('main').first(), route).toBeVisible();
      await expectNoViewportOverflow(page);
    }
  });
});

test.describe('responsive developer board', () => {
  test.use({ storageState: roleStatePath('DEVELOPER') });

  test('UTMS-COMP-RWD-002 @compatibility gives board cards a usable width at every breakpoint', async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    annotateTest(testInfo, metadata('UTMS-COMP-RWD-002', {
      requirement: 'Developer board cards adapt without clipping or unusably narrow lanes', feature: 'Developer board', level: 'e2e',
      type: 'compatibility', technique: 'Breakpoint testing', role: 'DEVELOPER', scope: 'SYSTEMS', risk: 'high',
      data: '320, 390, 768, 1024, 1440 and 1920 pixel viewports', expected: 'Six responsive lanes and contained cards without page overflow',
    }));

    for (const width of [320, 390, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: width < 700 ? 720 : 900 });
      await page.goto('/developer-board', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'برد توسعه' })).toBeVisible();
      await expectNoViewportOverflow(page);

      const lanes = page.locator('.responsive-grid > section');
      await expect(lanes).toHaveCount(6);
      const laneWidths = await lanes.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().width));
      for (const laneWidth of laneWidths) {
        expect(laneWidth, `lane width at ${width}px`).toBeGreaterThanOrEqual(Math.min(260, width - 32));
      }

      const cards = page.locator('.responsive-grid > section article');
      const cardContainment = await cards.evaluateAll(elements => elements.every(element => {
        const card = element.getBoundingClientRect();
        const lane = element.parentElement?.parentElement?.getBoundingClientRect();
        return !!lane && card.left >= lane.left - 1 && card.right <= lane.right + 1;
      }));
      expect(cardContainment, `card containment at ${width}px`).toBe(true);
    }
  });
});
