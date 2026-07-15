import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { test, expect } from '../../../../tests/fixtures/utms.fixture';
import { contextHeader, type UtmsRole } from '../../../../tests/helpers/api-context';
import { annotateTest, metadata } from '../../../../tests/helpers/traceability';

test('UTMS-RBAC-SEC-001 @security denies missing and malformed active context', async ({ api }, testInfo) => {
  annotateTest(testInfo, metadata('UTMS-RBAC-SEC-001', {
    requirement: 'x-utms-context authorization', feature: 'API authentication', level: 'integration', type: 'security',
    technique: 'Decision Table Testing', role: 'ANONYMOUS', scope: 'N/A', risk: 'critical',
    data: 'Header absent and invalid Base64/JSON', expected: 'Both unauthenticated rules return 401 without data disclosure',
  }));
  for (const headers of [{}, { 'x-utms-context': 'not-valid-context' }]) {
    const response = await api.get('/api/api-console/collections', { headers });
    expect(response.status()).toBe(401);
    expect(await response.json()).toMatchObject({ error: { category: 'AUTHENTICATION_ERROR' } });
  }
});

test('UTMS-RBAC-SEC-002 @decision-table enforces create permission for all eight roles', async ({ api }, testInfo) => {
  annotateTest(testInfo, metadata('UTMS-RBAC-SEC-002', {
    requirement: 'API_CONSOLE_POLICY.canCreate', feature: 'API Console RBAC', level: 'integration', type: 'security',
    technique: 'Decision Table Testing', role: 'ALL_ROLES', scope: 'SYSTEMS', risk: 'critical',
    data: '8 roles × create collection action', expected: '6 allowed rules return 200 and 2 denied rules return 403',
  }));
  const roles: UtmsRole[] = ['SYSTEM_ADMIN', 'DEVELOPER', 'QA_LEAD', 'QA_SPECIALIST', 'BA', 'SECURITY_REVIEWER', 'TECH_LEAD', 'PRODUCT_OWNER'];
  const allowed = new Set<UtmsRole>(['SYSTEM_ADMIN', 'DEVELOPER', 'QA_LEAD', 'QA_SPECIALIST', 'BA', 'TECH_LEAD']);
  for (const role of roles) {
    const response = await api.post('/api/api-console/collections', {
      headers: { 'x-utms-context': contextHeader(role) },
      data: { name: `RBAC ${role}`, applicationId: 'app-1' },
    });
    expect(response.status(), role).toBe(allowed.has(role) ? 200 : 403);
  }
});

test('UTMS-SCOPE-SEC-003 @security prevents cross-user and cross-scope data disclosure', async ({ api }, testInfo) => {
  annotateTest(testInfo, metadata('UTMS-SCOPE-SEC-003', {
    requirement: 'Owner and application scope checks', feature: 'Data isolation', level: 'integration', type: 'security',
    technique: 'Branch Condition Combination Testing', role: 'DEVELOPER,QA_LEAD', scope: 'SYSTEMS', risk: 'critical',
    data: 'Owner mismatch plus application-scope mismatch', expected: 'The second identity sees no first-user collection',
  }));
  const created = await api.post('/api/api-console/collections', {
    headers: { 'x-utms-context': contextHeader('DEVELOPER') },
    data: { name: 'Private Developer Collection', applicationId: 'app-1' },
  });
  expect(created.ok()).toBe(true);
  const otherUser = await api.get('/api/api-console/collections?applicationId=ALL', {
    headers: { 'x-utms-context': contextHeader('QA_LEAD', { applicationId: 'app-2', scopeApplicationIds: ['app-2'] }) },
  });
  expect(await otherUser.json()).toEqual([]);
});

test('UTMS-SSRF-SEC-004 @security rejects loopback execution without weakening production policy', async ({ api }, testInfo) => {
  annotateTest(testInfo, metadata('UTMS-SSRF-SEC-004', {
    requirement: 'SSRF destination policy', feature: 'API execution', level: 'system', type: 'security',
    technique: 'Error Guessing', role: 'DEVELOPER', scope: 'SYSTEMS', risk: 'critical',
    data: 'HTTP request targeting 127.0.0.1', expected: 'Execution evidence is recorded with DESTINATION_NOT_ALLOWED and no outbound request occurs',
  }));
  const headers = { 'x-utms-context': contextHeader('DEVELOPER') };
  const collection = await (await api.post('/api/api-console/collections', {
    headers,
    data: { name: 'SSRF', applicationId: 'app-1' },
  })).json();
  const request = await (await api.post('/api/api-console/requests', {
    headers,
    data: {
      name: 'Blocked destination', applicationId: 'app-1', collectionId: collection.id, environmentId: 'env-test',
      normalizedRequest: { method: 'GET', url: 'http://127.0.0.1:4174/api/health', queryParameters: [], headers: [], cookies: [], body: { type: 'none', raw: '' }, authentication: { type: 'none' }, tls: { verifyCertificate: true }, executionMode: 'EXACT' },
    },
  })).json();
  const execution = await api.post(`/api/api-console/requests/${request.id}/execute`, {
    headers,
    data: { environmentId: 'env-test', runnerId: 'runner-test' },
  });
  expect(execution.status()).toBe(200);
  expect(await execution.json()).toMatchObject({ errorCategory: 'DESTINATION_NOT_ALLOWED', transportResult: 'BLOCKED' });
});

test('UTMS-API-BVA-005 @boundary rejects request bodies above the discovered byte limit', async ({ api }, testInfo) => {
  annotateTest(testInfo, metadata('UTMS-API-BVA-005', {
    requirement: 'API_CONSOLE_MAX_REQUEST_BODY default 2 MiB', feature: 'Request body limits', level: 'integration', type: 'boundary',
    technique: 'Boundary Value Analysis', role: 'DEVELOPER', scope: 'SYSTEMS', risk: 'high',
    data: '2 MiB plus JSON framing', expected: 'Maximum-plus-one partition is rejected with HTTP 413',
  }));
  const response = await api.post('/api/api-console/curl/parse', {
    headers: { 'x-utms-context': contextHeader('DEVELOPER') },
    data: { curlText: 'x'.repeat(2 * 1024 * 1024) },
  });
  expect(response.status()).toBe(413);
});

test('UTMS-RESET-SEC-006 @negative hides the reset route outside test mode', async ({}, testInfo) => {
  annotateTest(testInfo, metadata('UTMS-RESET-SEC-006', {
    requirement: 'Test-only reset safety control', feature: 'Test isolation', level: 'integration', type: 'security',
    technique: 'Branch Condition Testing', role: 'ANONYMOUS', scope: 'N/A', risk: 'critical',
    data: 'NODE_ENV=production child process', expected: 'Reset route responds 404 outside the isolated test environment',
  }));
  const port = 14200 + (process.pid % 200);
  const dataDir = path.resolve('runtime', `reset-production-${process.pid}`);
  const child = spawn(process.execPath, ['apps/api/src/main.cjs'], {
    cwd: process.cwd(),
    stdio: 'ignore',
    env: { ...process.env, NODE_ENV: 'production', API_CONSOLE_PORT: String(port), API_CONSOLE_DATA_DIR: dataDir },
  });
  try {
    const deadline = Date.now() + 15_000;
    let healthy = false;
    while (Date.now() < deadline) {
      try {
        const health = await fetch(`http://127.0.0.1:${port}/api/health`);
        if (health.ok) { healthy = true; break; }
      } catch { /* process is still starting */ }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    expect(healthy).toBe(true);
    const response = await fetch(`http://127.0.0.1:${port}/api/api-console/__test/reset`, { method: 'POST' });
    expect(response.status).toBe(404);
  } finally {
    child.kill('SIGTERM');
    const workspaceRuntime = path.resolve('runtime');
    if (dataDir.startsWith(`${workspaceRuntime}${path.sep}`)) fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
