import { test, expect } from '../fixtures/utms.fixture';
import { annotateTest, metadata } from '../helpers/traceability';

test('UTMS-SMOKE-STMT-001 @smoke @statement verifies the API health statement', async ({ api }, testInfo) => {
  annotateTest(testInfo, metadata('UTMS-SMOKE-STMT-001', {
    requirement: 'README current application URLs', feature: 'API availability', level: 'system', type: 'smoke',
    technique: 'Statement Testing', role: 'N/A', scope: 'N/A', risk: 'critical', data: 'GET /api/health',
    expected: 'The health handler executes and returns status ok',
  }));
  const response = await api.get('/api/health');
  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({ status: 'ok', service: 'utms-api' });
});

test('UTMS-AUTH-FUNC-002 @smoke @functional logs in and selects an active context', async ({ page }, testInfo) => {
  annotateTest(testInfo, metadata('UTMS-AUTH-FUNC-002', {
    requirement: 'docs/workflows/CARTABLE_REQUIREMENTS.md authentication/context', feature: 'Authentication', level: 'e2e',
    type: 'functional', technique: 'Requirements-based Testing', role: 'DEVELOPER', scope: 'SYSTEMS', risk: 'critical',
    data: 'Seed developer 09121234567 and deterministic password', expected: 'Context selection opens the RTL dashboard',
  }));
  await page.goto('/');
  await page.getByLabel('شماره تلفن *').fill('09121234567');
  await page.getByLabel('رمز عبور *').fill('test-password');
  await page.getByRole('button', { name: 'ورود به سیستم' }).click();
  await expect(page.getByRole('heading', { name: 'انتخاب محیط کاری' })).toBeVisible();
  // The seeded login fixture can expose more than one application. Select
  // the first developer context by its accessible role label rather than
  // coupling the smoke test to a display name that may change with seed data.
  await page.getByRole('button', { name: /توسعه‌دهنده/ }).first().click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator('html[dir="rtl"]')).toBeVisible();
});
