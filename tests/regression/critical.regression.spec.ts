import { test, expect } from '../fixtures/utms.fixture';
import { contextHeader } from '../helpers/api-context';
import { annotateTest, metadata } from '../helpers/traceability';

test('UTMS-REG-META-001 @regression @metamorphic preserves collection result after export', async ({ api }, testInfo) => {
  annotateTest(testInfo, metadata('UTMS-REG-META-001', {
    requirement: 'Online API Console export is non-mutating', feature: 'Collection export', level: 'integration',
    type: 'regression', technique: 'Metamorphic Testing', role: 'DEVELOPER', scope: 'SYSTEMS', risk: 'high',
    data: 'Collection created, listed, exported, then listed again', expected: 'The exported representation does not alter active collection cardinality',
  }));
  const headers = { 'x-utms-context': contextHeader('DEVELOPER') };
  const created = await (await api.post('/api/api-console/collections', { headers, data: { name: 'Regression', applicationId: 'app-1' } })).json();
  const before = await (await api.get('/api/api-console/collections?applicationId=app-1', { headers })).json();
  const exportResponse = await api.get(`/api/api-console/collections/${created.id}/export-postman`, { headers });
  expect(exportResponse.status()).toBe(200);
  const after = await (await api.get('/api/api-console/collections?applicationId=app-1', { headers })).json();
  expect(after).toHaveLength(before.length);
});

