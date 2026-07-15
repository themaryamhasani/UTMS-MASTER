import { test, expect } from '../fixtures/utms.fixture';
import { roleStatePath } from '../helpers/api-context';
import { annotateTest, metadata } from '../helpers/traceability';

test.use({ storageState: roleStatePath('DEVELOPER') });

test('UTMS-UAT-BRANCH-001 @uat @branch validates the developer entry journey', async ({ page }, testInfo) => {
  annotateTest(testInfo, metadata('UTMS-UAT-BRANCH-001', {
    requirement: 'Developer-to-QA workflow entry and scoped navigation', feature: 'Test request intake', level: 'e2e',
    type: 'uat', technique: 'Branch Testing', role: 'DEVELOPER', scope: 'SYSTEMS', risk: 'high',
    data: 'Developer storage state and test-request route', expected: 'Developer can reach the request cartable and sees an actionable create control',
  }));
  await page.goto('/test-requests');
  await expect(page.getByRole('heading').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'درخواست جدید' })).toBeVisible();
});

