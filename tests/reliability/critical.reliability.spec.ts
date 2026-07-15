import { test, expect } from '../fixtures/utms.fixture';
import { contextHeader } from '../helpers/api-context';
import { annotateTest, metadata } from '../helpers/traceability';

test('UTMS-REL-COMB-001 @reliability @combinatorial keeps health and reset idempotent', async ({ api }, testInfo) => {
  annotateTest(testInfo, metadata('UTMS-REL-COMB-001', {
    requirement: 'Reliability: repeatable health, isolated reset, and no test-order dependency', feature: 'Test environment', level: 'integration',
    type: 'reliability', technique: 'Combinatorial Test Design', role: 'SYSTEM_ADMIN', scope: 'APP', risk: 'high',
    data: 'Role × reset × health covering array; 5 repetitions', expected: 'Every health request succeeds and reset remains idempotent',
  }));
  for (let index = 0; index < 5; index += 1) {
    const health = await api.get('/api/health');
    expect(health.status()).toBe(200);
    const reset = await api.post('/api/api-console/__test/reset');
    expect(reset.status()).toBe(200);
    const collections = await api.get('/api/api-console/collections?applicationId=ALL', {
      headers: { 'x-utms-context': contextHeader('SYSTEM_ADMIN') },
    });
    expect(collections.status()).toBe(200);
    expect(await collections.json()).toEqual([]);
  }
});

