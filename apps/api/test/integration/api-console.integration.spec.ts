import { test, expect } from '../../../../tests/fixtures/utms.fixture';
import { contextHeader } from '../../../../tests/helpers/api-context';
import { SeededRandom } from '../../../../tests/helpers/seeded-random';
import { annotateTest, metadata } from '../../../../tests/helpers/traceability';

const developerHeaders = { 'x-utms-context': contextHeader('DEVELOPER') };

test('UTMS-API-INT-001 @integration exposes health and self-check contracts', async ({ api }, testInfo) => {
  annotateTest(testInfo, metadata('UTMS-API-INT-001', {
    requirement: 'README API health and Online API Console self-check', feature: 'API health', level: 'integration',
    type: 'integration', technique: 'Requirements-based Testing', role: 'N/A', scope: 'N/A', risk: 'critical',
    data: 'GET /api/health and /api/api-console/self-check', expected: 'Health is ok and every backend self-check passes',
  }));
  const health = await api.get('/api/health');
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({ status: 'ok', service: 'utms-api', modules: ['api-console'] });
  const selfCheck = await api.get('/api/api-console/self-check');
  expect(selfCheck.status()).toBe(200);
  expect(await selfCheck.json()).toMatchObject({ failed: 0 });
});

test('UTMS-API-INT-002 @data-flow creates, reads, exports, and soft-archives an API request', async ({ api }, testInfo) => {
  annotateTest(testInfo, metadata('UTMS-API-INT-002', {
    requirement: 'docs/api/ONLINE_API_CONSOLE_IMPLEMENTATION.md', feature: 'API Console lifecycle', level: 'integration',
    type: 'data-integrity', technique: 'Data Flow Testing', role: 'DEVELOPER', scope: 'SYSTEMS', risk: 'critical',
    data: 'Collection and request containing a sensitive authorization header', expected: 'Entity links persist, exports mask secrets, archive is a soft delete',
  }));
  const collectionResponse = await api.post('/api/api-console/collections', {
    headers: developerHeaders,
    data: { name: 'Integration Collection', applicationId: 'app-1' },
  });
  expect(collectionResponse.status()).toBe(200);
  const collection = await collectionResponse.json();

  const parsedResponse = await api.post('/api/api-console/curl/parse', {
    headers: developerHeaders,
    data: { curlText: "curl https://example.com/orders -H 'authorization: Bearer test-secret' -H 'accept: application/json'" },
  });
  const parsed = await parsedResponse.json();
  const createResponse = await api.post('/api/api-console/requests', {
    headers: developerHeaders,
    data: {
      name: 'Orders API',
      applicationId: 'app-1',
      collectionId: collection.id,
      environmentId: 'env-test',
      normalizedRequest: parsed.normalizedRequest,
      importedCurlId: parsed.id,
    },
  });
  expect(createResponse.status()).toBe(200);
  const created = await createResponse.json();
  expect(created.collectionId).toBe(collection.id);
  expect(JSON.stringify(created)).not.toContain('test-secret');

  const exportResponse = await api.post(`/api/api-console/requests/${created.id}/export-curl`, {
    headers: developerHeaders,
    data: { dialect: 'bash' },
  });
  expect(JSON.stringify(await exportResponse.json())).not.toContain('test-secret');

  const archive = await api.delete(`/api/api-console/requests/${created.id}`, { headers: developerHeaders });
  expect(await archive.json()).toMatchObject({ id: created.id, status: 'ARCHIVED' });
  const listed = await api.get('/api/api-console/requests?applicationId=app-1', { headers: developerHeaders });
  expect((await listed.json()).data).toHaveLength(0);
});

test('UTMS-API-RND-003 @random keeps seeded pagination/filter requests bounded', async ({ api }, testInfo) => {
  const seed = Number(process.env.UTMS_TEST_SEED || 20260715);
  annotateTest(testInfo, metadata('UTMS-API-RND-003', {
    requirement: 'Deterministic integration random testing', feature: 'Collection filters', level: 'integration',
    type: 'integration', technique: 'Random Testing', role: 'QA_SPECIALIST', scope: 'SYSTEMS', risk: 'medium',
    data: `Seed ${seed}; names and page sizes generated inside fixed bounds`, expected: 'Generated records are isolated and pagination totals are stable',
  }));
  const headers = { 'x-utms-context': contextHeader('QA_SPECIALIST') };
  const random = new SeededRandom(seed);
  const names: string[] = [];
  for (let index = 0; index < 6; index += 1) {
    const name = `seed-${seed}-${random.text(6)}`;
    names.push(name);
    const response = await api.post('/api/api-console/collections', {
      headers,
      data: { name, applicationId: 'app-1' },
    });
    expect(response.ok()).toBe(true);
  }
  const listed = await api.get('/api/api-console/collections?applicationId=app-1', { headers });
  const rows = await listed.json();
  expect(rows.map((row: any) => row.name).sort()).toEqual(names.sort());
  console.log(`UTMS integration random seed: ${seed}`);
});

test('UTMS-API-INT-004 @negative reset endpoint restores an isolated empty store', async ({ api }, testInfo) => {
  annotateTest(testInfo, metadata('UTMS-API-INT-004', {
    requirement: 'Test data isolation', feature: 'Test reset', level: 'integration', type: 'negative',
    technique: 'Branch Condition Testing', role: 'SYSTEM_ADMIN', scope: 'APP', risk: 'critical',
    data: 'Mutation followed by NODE_ENV=test reset', expected: 'Reset succeeds only in test mode and removes prior test data',
  }));
  await api.post('/api/api-console/collections', {
    headers: developerHeaders,
    data: { name: 'Will be reset', applicationId: 'app-1' },
  });
  const reset = await api.post('/api/api-console/__test/reset');
  expect(reset.status()).toBe(200);
  expect(await reset.json()).toEqual({ reset: true, storeVersion: 1 });
  const listed = await api.get('/api/api-console/collections?applicationId=app-1', { headers: developerHeaders });
  expect(await listed.json()).toEqual([]);
});
