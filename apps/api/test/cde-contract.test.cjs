const assert = require('node:assert/strict');
const test = require('node:test');
const CryptoJS = require('crypto-js');
const {
  assertLogicalSuccess,
  createCdeState,
  getDataSource,
  secretForClientId,
  storeFormData,
} = require('../src/modules/cde/core-client.cjs');
const {
  compileDataServiceBranchContent,
  normalizeSourcePath,
} = require('../src/modules/cde/data-service-compiler.cjs');
const { decryptObject, encryptObject } = require('../src/modules/playwright/object-store.cjs');
const { createLoginChallenge, readLoginChallenge } = require('../src/modules/cde/cde-session-store.cjs');
const {
  normalizeRemoteFiles,
  projectRepositoryName,
  repositoryBranches,
} = require('../src/modules/cde/cde-server.cjs');

function jsonResponse(payload, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

test('Core read/write gateways are POST-only, strip provider prefixes, and retain session identity', async t => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return jsonResponse({ Result: { IsUserLogin: true, items: [] } }, calls.length === 1 ? { 'set-cookie': '_cdesc=rotated; Path=/; HttpOnly' } : {});
  };
  t.after(() => { global.fetch = originalFetch; });

  let state = createCdeState();
  const clientId = state.clientId;
  state = (await getDataSource(state, 'ds/cde/repository/list/my-repo', {})).state;
  state = (await storeFormData(state, 'fr/cde/package/any/personal/save', { personal: { content: 'x' } })).state;

  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, 'https://cde.edus.ir/core-api/v1/data-provider/get-data-source');
  assert.equal(calls[1].url, 'https://cde.edus.ir/core-api/v1/data-provider/store-form-data');
  assert.ok(calls.every(call => call.init.method === 'POST'));
  assert.ok(calls.every(call => call.init.headers['client-id'] === clientId));
  assert.deepEqual(JSON.parse(calls[0].init.body), { serviceId: 'cde.edus.ir', key: 'cde/repository/list/my-repo', params: {} });
  assert.equal(JSON.parse(calls[1].init.body).formId, 'cde/package/any/personal/save');
  assert.equal(calls[0].init.headers.referer, 'https://cde.edus.ir/second-editor');
  assert.equal(calls[1].init.headers.referer, 'https://cde.edus.ir/second-editor');
  assert.equal(calls[1].init.headers.prostage, 'develop');
  assert.match(calls[1].init.headers.cookie, /_cdesc=rotated/);
  assert.equal(calls[0].init.headers['content-length'], undefined);
  assert.equal(calls[0].init.headers['sec-fetch-site'], undefined);
});

test('login providers use the login referer and never receive editor prostage', async t => {
  const originalFetch = global.fetch;
  let captured;
  global.fetch = async (url, init) => {
    captured = { url, init };
    return jsonResponse({ Result: { nextStep: 'password', IsUserLogin: false } });
  };
  t.after(() => { global.fetch = originalFetch; });
  await storeFormData(createCdeState(), 'auth/signin/iran-cellphone', { userSource: 'rayadevelopers', userLoginName: '9000000000' });
  assert.equal(captured.init.method, 'POST');
  assert.equal(captured.init.headers.referer, 'https://cde.edus.ir/');
  assert.equal(captured.init.headers.prostage, undefined);
});

test('project browsing sends the exact repository-list and package-fetch Core payloads', async t => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return jsonResponse({ Result: { IsUserLogin: true, items: [] } });
  };
  t.after(() => { global.fetch = originalFetch; });

  let state = createCdeState();
  state = (await getDataSource(state, 'cde/repository/web-ui/list/fetch', {
    repoName: 'medu-inquiry/web-ui',
  })).state;
  state = (await getDataSource(state, 'cde/package/any/one/fetch', {
    repoName: 'medu-inquiry/web-ui',
    packId: 'pages/component/medu-inquiry/App',
  })).state;

  assert.ok(calls.every(call => call.init.method === 'POST'));
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    serviceId: 'cde.edus.ir',
    key: 'cde/repository/web-ui/list/fetch',
    params: { repoName: 'medu-inquiry/web-ui' },
  });
  assert.deepEqual(JSON.parse(calls[1].init.body), {
    serviceId: 'cde.edus.ir',
    key: 'cde/package/any/one/fetch',
    params: {
      repoName: 'medu-inquiry/web-ui',
      packId: 'pages/component/medu-inquiry/App',
    },
  });
});

test('project browsing derives allowlisted repository names and normalizes nested read-only source', () => {
  assert.equal(projectRepositoryName('medu-inquiry', 'WEB_UI'), 'medu-inquiry/web-ui');
  assert.equal(projectRepositoryName('medu-inquiry', 'DATA_SERVICE'), 'medu-inquiry/data-service');
  assert.equal(projectRepositoryName('medu-inquiry', 'API_MODULE'), 'medu-inquiry/api-module');
  assert.throws(() => projectRepositoryName('../other', 'WEB_UI'), error => error.category === 'CDE_PROJECT_INVALID');
  assert.throws(() => projectRepositoryName('medu-inquiry', 'TESTS'), error => error.category === 'CDE_REPOSITORY_TYPE_INVALID');

  const branches = repositoryBranches({
    personal: [{
      rand_id: '1r4hhryn2a2c5f',
      versionId: 'msbj99sq6xm',
      editable: false,
      content: {
        type: 'REACT',
        content: [{ name: 'components/composites/Card.jsx', code: 'function Card() {}' }],
      },
    }],
  }, 'WEB_UI');
  assert.equal(branches.length, 1);
  assert.deepEqual(branches[0].selector, { kind: 'PERSONAL', randId: '1r4hhryn2a2c5f', index: 0 });
  assert.deepEqual(normalizeRemoteFiles(branches[0], 'WEB_UI', 'pages/component/medu-inquiry/App'), [{
    path: 'components/composites/Card.jsx',
    code: 'function Card() {}',
    readOnly: true,
  }]);
});

test('ecreq encrypts requests and decrypts double-encoded Core responses', async t => {
  const originalFetch = global.fetch;
  const state = createCdeState();
  state.ecreq = true;
  let encryptedBody;
  global.fetch = async (url, init) => {
    encryptedBody = JSON.parse(init.body);
    const result = { items: ['project-a'], IsUserLogin: true, ecreq: true };
    const token = CryptoJS.AES.encrypt(JSON.stringify(JSON.stringify(result)), secretForClientId(state.clientId)).toString();
    return jsonResponse({ token });
  };
  t.after(() => { global.fetch = originalFetch; });
  const response = await getDataSource(state, 'cde/repository/list/my-repo', {});
  assert.deepEqual(response.response.Result.items, ['project-a']);
  const plaintext = CryptoJS.AES.decrypt(encryptedBody.reqtoken, secretForClientId(state.clientId)).toString(CryptoJS.enc.Utf8);
  assert.equal(JSON.parse(plaintext).key, 'cde/repository/list/my-repo');
});

test('HTTP 200 logical errors and non-allowlisted providers are rejected', async () => {
  assert.throws(() => assertLogicalSuccess({ Result: { success: false, message: 'conflict' } }), error => error.category === 'CDE_LOGICAL_ERROR');
  await assert.rejects(
    getDataSource(createCdeState(), 'ds/arbitrary/provider', {}),
    error => error.category === 'CDE_PROVIDER_NOT_ALLOWED' && error.statusCode === 403
  );
});

test('Core save transport accepts payloads above the observed four MiB default', async t => {
  const originalFetch = global.fetch;
  let serializedBytes = 0;
  global.fetch = async (url, init) => {
    serializedBytes = Buffer.byteLength(init.body);
    return jsonResponse({ Result: { versionId: 'next-version', IsUserLogin: true } });
  };
  t.after(() => { global.fetch = originalFetch; });
  await storeFormData(createCdeState(), 'cde/package/any/personal/save', { personal: { content: 'x'.repeat(5 * 1024 * 1024) } });
  assert.ok(serializedBytes > 4 * 1024 * 1024);
});

test('Data Service compiler rejects unsafe/colliding paths and preserves unrelated content fields', () => {
  for (const path of ['../secret.js', '/absolute.js', 'C:\\secret.js', 'a/../b.js', 'a//b.js', `nul\0.js`]) {
    assert.throws(() => normalizeSourcePath(path));
  }
  assert.throws(() => compileDataServiceBranchContent({
    type: 'JS',
    content: [{ name: 'tests/A.spec.ts', code: 'export {}' }, { name: 'tests/a.spec.ts', code: 'export {}' }],
  }), /collide/i);
  const compiled = compileDataServiceBranchContent({
    type: 'JS',
    customEditorField: { keep: true },
    content: [{ name: 'tests/example.spec.ts', code: 'const value: number = 1;', oppend: true }],
  });
  assert.deepEqual(compiled.customEditorField, { keep: true });
  assert.equal(compiled.content[0].oppend, true);
  assert.equal(compiled.build[0].name, 'tests/example.spec.js');
  assert.match(compiled.build[0].build, /value/);
});

test('snapshot encryption is authenticated and login challenges are opaque and session-bound', () => {
  const source = Buffer.from('private CDE source');
  const encrypted = encryptObject(source);
  assert.equal(encrypted.includes(source), false);
  assert.deepEqual(decryptObject(encrypted), source);
  const tampered = Buffer.from(encrypted);
  tampered[tampered.length - 1] ^= 1;
  assert.throws(() => decryptObject(tampered));

  const challenge = createLoginChallenge('session-a', '9000000000');
  assert.equal(challenge.includes('9000000000'), false);
  assert.equal(readLoginChallenge('session-a', challenge), '9000000000');
  assert.throws(() => readLoginChallenge('session-b', challenge));
});
