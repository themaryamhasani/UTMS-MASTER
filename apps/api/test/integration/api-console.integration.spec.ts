import { test, expect } from '../../../../tests/fixtures/utms.fixture';
import { inflateRawSync } from 'node:zlib';
import { contextHeader } from '../../../../tests/helpers/api-context';
import { SeededRandom } from '../../../../tests/helpers/seeded-random';
import { annotateTest, metadata } from '../../../../tests/helpers/traceability';

const developerHeaders = { 'x-utms-context': contextHeader('DEVELOPER') };

function docxEntry(buffer: Buffer, wantedName: string): Buffer {
  let eocd = buffer.length - 22;
  while (eocd >= Math.max(0, buffer.length - 66_000) && buffer.readUInt32LE(eocd) !== 0x06054b50) eocd -= 1;
  if (eocd < 0) throw new Error('DOCX central directory not found');
  const total = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  for (let index = 0; index < total; index += 1) {
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    if (name === wantedName) {
      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
      return method === 8 ? inflateRawSync(compressed) : compressed;
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error(`DOCX entry not found: ${wantedName}`);
}

test('UTMS-API-INT-001 @integration exposes health and self-check contracts', async ({ api }, testInfo) => {
  annotateTest(testInfo, metadata('UTMS-API-INT-001', {
    requirement: 'README API health and Online API Console self-check', feature: 'API health', level: 'integration',
    type: 'integration', technique: 'Requirements-based Testing', role: 'N/A', scope: 'N/A', risk: 'critical',
    data: 'GET /api/health and /api/api-console/self-check', expected: 'Health is ok and every backend self-check passes',
  }));
  const health = await api.get('/api/health');
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({ status: 'ok', service: 'utms-api', modules: ['api-console', 'domain-rpc'] });
  const selfCheck = await api.get('/api/api-console/self-check');
  expect(selfCheck.status()).toBe(200);
  expect(await selfCheck.json()).toMatchObject({ failed: 0 });
});

test('UTMS-DOMAIN-INT-001 @integration exposes domain RPC services and report read models', async ({ api }, testInfo) => {
  annotateTest(testInfo, metadata('UTMS-DOMAIN-INT-001', {
    requirement: 'docs/migration/FRONTEND_BACKEND_ALIGNMENT_REPORT.md', feature: 'Domain RPC alignment', level: 'integration',
    type: 'integration', technique: 'Requirements-based Testing', role: 'N/A', scope: 'N/A', risk: 'critical',
    data: 'GET /api/domain/health, GET /api/domain/services and POST /api/domain/rpc for reportsApi.getSystemOverview',
    expected: 'Domain services are exposed server-side and report data is returned through backend RPC',
  }));

  const health = await api.get('/api/domain/health');
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({ status: 'ok', service: 'utms-domain-rpc' });

  const services = await api.get('/api/domain/services');
  expect(services.status()).toBe(200);
  const serviceInventory = await services.json();
  expect(serviceInventory).toHaveProperty('testRequestApi');
  expect(serviceInventory).toHaveProperty('reportsApi');

  const overview = await api.post('/api/domain/rpc', {
    data: { service: 'reportsApi', method: 'getSystemOverview', args: ['ALL'] },
  });
  expect(overview.status()).toBe(200);
  const payload = await overview.json();
  expect(payload.data.testRequests.total).toBeGreaterThan(0);
  expect(payload.data.testRuns).toHaveProperty('passRate');
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

test('UTMS-API-INT-003 @documentation generates a valid redacted Persian operational DOCX', async ({ api }, testInfo) => {
  annotateTest(testInfo, metadata('UTMS-API-INT-003', {
    requirement: 'Persian API operational documentation generation', feature: 'API Console documentation', level: 'integration',
    type: 'integration', technique: 'Requirements-based Testing', role: 'DEVELOPER', scope: 'SYSTEMS', risk: 'critical',
    data: 'Teacher University Funds request with token, national code, response schema and configured descriptions',
    expected: 'Final endpoint returns a valid Base64 DOCX with Persian sections, schema tables, appendix and no raw secrets',
  }));
  const collection = await (await api.post('/api/api-console/collections', {
    headers: developerHeaders,
    data: { name: 'Operational Documentation', applicationId: 'app-1' },
  })).json();
  const parsed = await (await api.post('/api/api-console/curl/parse', {
    headers: developerHeaders,
    data: {
      curlText: "curl --request POST --url https://esb.medu.ir/TeacherUniversityFunds/GetTeacherUniversityFundData --header 'Content-Type: application/json' --header 'token: gBLon4YS-real-secret-token-jpMQ==' --header 'Content-Length: 123' --data '{\"nationalCode\":\"3651113262\"}'",
    },
  })).json();
  let request = await (await api.post('/api/api-console/requests', {
    headers: developerHeaders,
    data: {
      name: 'وب سرویس استعلام کسورات دانشجو معلم',
      description: 'این سرویس جزئیات کسورات دانشجو معلم را استعلام می‌کند.',
      applicationId: 'app-1', collectionId: collection.id, environmentId: 'env-test',
      normalizedRequest: parsed.normalizedRequest, importedCurlId: parsed.id,
    },
  })).json();
  await api.post(`/api/api-console/requests/${request.id}/manual-responses`, {
    headers: developerHeaders,
    data: {
      statusCode: 200,
      headersText: 'content-type: application/json',
      body: JSON.stringify({
        EmployeeCode: '82123484', WorkPlaceCode: 4911, WorkPlaceTitle: 'زرآباد',
        NetPayablePrice: '304156763', DeductionsSumPrice: '13745265',
      }),
      claimedEnvironmentId: 'env-test', source: 'acceptance-test', reason: 'Successful response example',
    },
  });
  request = await (await api.post(`/api/api-console/requests/${request.id}/documentation/refresh`, { headers: developerHeaders })).json();
  const outputDescriptions: Record<string, [string, string]> = {
    WorkPlaceCode: ['Integer', 'کد منطقه'], EmployeeCode: ['Integer', 'کد پرسنلی'],
    WorkPlaceTitle: ['string', 'نام منطقه'], NetPayablePrice: ['Integer', 'مجموع استعلامی'],
    DeductionsSumPrice: ['Integer', 'مجموع کسورات'],
  };
  request.documentation.inputParameters = request.documentation.inputParameters.map((row: any) => row.name === 'nationalCode'
    ? { ...row, dataType: 'string', required: true, description: 'کدملی فرد مورد نظر' }
    : row);
  request.documentation.outputParameters = request.documentation.outputParameters.map((row: any) => outputDescriptions[row.name]
    ? { ...row, dataType: outputDescriptions[row.name][0], description: outputDescriptions[row.name][1] }
    : row);
  const saved = await api.put(`/api/api-console/requests/${request.id}`, { headers: developerHeaders, data: request });
  expect(saved.ok()).toBe(true);

  const finalResponse = await api.post(`/api/api-console/requests/${request.id}/documentation/final`, { headers: developerHeaders });
  expect(finalResponse.status()).toBe(200);
  const result = await finalResponse.json();
  expect(result.wordMimeType).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  const docx = Buffer.from(result.wordDocumentBase64, 'base64');
  expect(docx.subarray(0, 2).toString('utf8')).toBe('PK');
  const documentXml = docxEntry(docx, 'word/document.xml').toString('utf8');
  const settingsXml = docxEntry(docx, 'word/settings.xml').toString('utf8');
  for (const requiredText of [
    'مستندات بهره برداری', 'مقدمه سرویس احراز هویت', 'مقدمه دسترسی به استعلام جزئیات وب سرویس',
    'پارامتر های سرایند', 'پارامتر های ورودی', 'پارامترهای خروجی',
    'نمونه فراخوانی دریافت جزئیات وب سرویس', 'نمونه تست موفق دریافت جزئیات وب سرویس',
    'پیوست – مرجع کدهای پاسخ و خطا', 'کدهای پاسخ HTTPS وب سرویس',
    'ردیف', 'نام پارامتر', 'نوع یا مقدار نمونه', 'الزامی', 'کدملی فرد مورد نظر', 'کد پرسنلی',
  ]) expect(documentXml).toContain(requiredText);
  expect(documentXml).toContain('TOC \\o');
  expect(settingsXml).toContain('<w:updateFields w:val="true"/>');
  expect(documentXml).not.toContain('Content-Length');
  expect(documentXml).not.toContain('gBLon4YS-real-secret-token-jpMQ==');
  expect(documentXml).not.toContain('3651113262');
  expect(documentXml).not.toContain('82123484');
  expect(documentXml).toContain('gBLon4YS...****...jpMQ==');
  expect(documentXml).toContain('3651***262');
  expect(documentXml).toContain('82****84');
  expect(result.markdown).toContain('3651***262');
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
