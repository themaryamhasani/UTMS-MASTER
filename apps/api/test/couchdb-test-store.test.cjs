const assert = require('node:assert/strict');
const test = require('node:test');
const {
  bindingFingerprint,
  bindingForMapping,
  createDocument,
  getDocument,
  listProjectDocuments,
  resetForTests,
  updateDocument,
} = require('../src/modules/playwright/couchdb-test-store.cjs');

function response(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('CouchDB test documents retain exact CDE binding and use revisions for writes', async t => {
  const originalFetch = global.fetch;
  const originalEnvironment = {
    COUCHDB_URL: process.env.COUCHDB_URL,
    COUCHDB_DATABASE: process.env.COUCHDB_DATABASE,
    COUCHDB_USERNAME: process.env.COUCHDB_USERNAME,
    COUCHDB_PASSWORD: process.env.COUCHDB_PASSWORD,
  };
  process.env.COUCHDB_URL = 'http://couch.test:5984';
  process.env.COUCHDB_DATABASE = 'utms_playwright_test';
  process.env.COUCHDB_USERNAME = 'test-user';
  process.env.COUCHDB_PASSWORD = 'test-password';
  resetForTests();
  const documents = new Map();
  const calls = [];
  global.fetch = async (url, init = {}) => {
    const parsed = new URL(url);
    const method = init.method || 'GET';
    calls.push({ method, pathname: parsed.pathname, headers: init.headers, body: init.body });
    if (method === 'PUT' && parsed.pathname === '/utms_playwright_test') return response(201, { ok: true });
    if (method === 'POST' && parsed.pathname.endsWith('/_index')) return response(200, { result: 'created' });
    if (method === 'POST' && parsed.pathname.endsWith('/_find')) {
      const selector = JSON.parse(init.body).selector;
      const docs = [...documents.values()].filter(document =>
        document.type === selector.type &&
        document.applicationId === selector.applicationId &&
        document.cdeBinding.projectKey === selector['cdeBinding.projectKey'] &&
        document.bindingFingerprint === selector.bindingFingerprint
      );
      return response(200, { docs, bookmark: 'done' });
    }
    const documentId = decodeURIComponent(parsed.pathname.split('/').pop());
    if (method === 'GET') return documents.has(documentId) ? response(200, documents.get(documentId)) : response(404, { error: 'not_found' });
    if (method === 'PUT') {
      const document = JSON.parse(init.body);
      const current = documents.get(documentId);
      if (current && document._rev !== current._rev) return response(409, { error: 'conflict' });
      const generation = current ? Number(current._rev.split('-')[0]) + 1 : 1;
      const revision = `${generation}-test`;
      documents.set(documentId, { ...document, _rev: revision });
      return response(201, { ok: true, id: documentId, rev: revision });
    }
    return response(500, { error: 'unexpected_request' });
  };
  t.after(() => {
    global.fetch = originalFetch;
    for (const [name, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    resetForTests();
  });

  const mapping = {
    projectKey: 'medu-inquiry',
    webUiRepoName: 'medu-inquiry/web-ui',
    dataServiceRepoName: 'medu-inquiry/data-service',
    apiModuleRepoName: 'medu-inquiry/api-module',
    messageConsumerRepoName: null,
  };
  const cdeBinding = bindingForMapping(mapping);
  const created = await createDocument({
    applicationId: 'application-1',
    path: 'tests/inquiry.spec.ts',
    script: 'export const value = 1;',
    description: 'Inquiry test',
    userId: 'user-1',
    cdeBinding,
  });
  assert.equal(created._rev, '1-test');
  assert.equal(created.cdeBinding.origin, 'https://cde.edus.ir');
  assert.equal(created.cdeBinding.projectKey, 'medu-inquiry');
  assert.equal(created.bindingFingerprint, bindingFingerprint(cdeBinding));

  const listed = await listProjectDocuments('application-1', cdeBinding);
  assert.equal(listed.length, 1);
  assert.equal(listed[0]._id, created._id);
  assert.ok(calls.every(call => call.headers.authorization === `Basic ${Buffer.from('test-user:test-password').toString('base64')}`));

  const current = await getDocument(created._id, {
    applicationId: 'application-1',
    bindingFingerprint: bindingFingerprint(cdeBinding),
  });
  await assert.rejects(
    updateDocument(current, { path: current.path, script: 'changed', userId: 'user-1', expectedRevision: 'stale-revision' }),
    error => error.category === 'COUCHDB_WRITE_CONFLICT' && error.statusCode === 409,
  );
  const updated = await updateDocument(current, {
    path: current.path,
    script: 'export const value = 2;',
    description: current.description,
    userId: 'user-1',
    expectedRevision: current._rev,
  });
  assert.equal(updated._rev, '2-test');
});

test('CouchDB project binding changes produce a different fingerprint', () => {
  const first = bindingForMapping({
    projectKey: 'project-a',
    webUiRepoName: 'project-a/web-ui',
    dataServiceRepoName: 'project-a/data-service',
    apiModuleRepoName: 'project-a/api-module',
  });
  const second = { ...first, projectKey: 'project-b' };
  assert.notEqual(bindingFingerprint(first), bindingFingerprint(second));
});
