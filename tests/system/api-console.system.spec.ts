import { test, expect } from '../fixtures/utms.fixture';
import { contextHeader, roleStatePath } from '../helpers/api-context';
import { annotateTest, metadata } from '../helpers/traceability';

test.use({ storageState: roleStatePath('DEVELOPER') });

test('UTMS-API-SYS-001 @system flows API-created data into the authenticated UI', async ({ api, page }, testInfo) => {
  annotateTest(testInfo, metadata('UTMS-API-SYS-001', {
    requirement: 'Online API Console collection/request workflow', feature: 'API Console', level: 'system', type: 'integration',
    technique: 'Data Flow Testing', role: 'DEVELOPER', scope: 'SYSTEMS', risk: 'critical',
    data: 'Collection created through HTTP API under same active context as browser', expected: 'The UI reads and renders the persisted backend collection',
  }));
  const name = 'مجموعه سیستم Playwright';
  const response = await api.post('/api/api-console/collections', {
    headers: { 'x-utms-context': contextHeader('DEVELOPER') },
    data: { name, applicationId: 'app-1' },
  });
  expect(response.ok()).toBe(true);
  await page.goto('/api-console');
  await expect(page.getByRole('option', { name })).toBeAttached();
  await page.reload();
  await expect(page.getByRole('option', { name })).toBeAttached();
});

test('UTMS-API-SYS-002 @system preserves soft-delete and export semantics across endpoints', async ({ api }, testInfo) => {
  annotateTest(testInfo, metadata('UTMS-API-SYS-002', {
    requirement: 'API Console archive/export data integrity', feature: 'API Console', level: 'system', type: 'data-integrity',
    technique: 'Metamorphic Testing', role: 'DEVELOPER', scope: 'SYSTEMS', risk: 'high',
    data: 'Export before archive and list after archive', expected: 'Export is non-mutating and archive removes only active-list visibility',
  }));
  const headers = { 'x-utms-context': contextHeader('DEVELOPER') };
  const collection = await (await api.post('/api/api-console/collections', { headers, data: { name: 'Export', applicationId: 'app-1' } })).json();
  const created = await (await api.post('/api/api-console/requests', {
    headers,
    data: { name: 'Health', applicationId: 'app-1', collectionId: collection.id, environmentId: 'env-test' },
  })).json();
  const before = await (await api.get('/api/api-console/requests', { headers })).json();
  await api.post(`/api/api-console/requests/${created.id}/export-curl`, { headers, data: { dialect: 'bash' } });
  const afterExport = await (await api.get('/api/api-console/requests', { headers })).json();
  expect(afterExport.total).toBe(before.total);
  await api.delete(`/api/api-console/requests/${created.id}`, { headers });
  const afterArchive = await (await api.get('/api/api-console/requests', { headers })).json();
  expect(afterArchive.total).toBe(before.total - 1);
});
