const { createHash, randomUUID } = require('crypto');

const DOCUMENT_TYPE = 'utms-playwright-test-file';
const SCHEMA_VERSION = 1;
const DEFAULT_URL = 'http://127.0.0.1:5984';
const DEFAULT_DATABASE = 'utms_playwright';
const MAX_RESPONSE_BYTES = Number(process.env.COUCHDB_MAX_RESPONSE_BYTES || 32 * 1024 * 1024);
const REQUEST_TIMEOUT_MS = Number(process.env.COUCHDB_REQUEST_TIMEOUT_MS || 15_000);
const PAGE_SIZE = 200;
const MAX_PROJECT_FILES = 5_000;

class CouchTestStoreError extends Error {
  constructor(category, message, statusCode = 502, details) {
    super(message);
    this.category = category;
    this.statusCode = statusCode;
    this.details = details;
  }
}

function configuration() {
  const baseUrl = new URL(process.env.COUCHDB_URL || DEFAULT_URL);
  if (!['http:', 'https:'].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash) {
    throw new CouchTestStoreError('COUCHDB_CONFIGURATION_INVALID', 'COUCHDB_URL must be an HTTP(S) origin without embedded credentials.', 500);
  }
  const database = String(process.env.COUCHDB_DATABASE || DEFAULT_DATABASE).trim().toLowerCase();
  if (!/^[a-z][a-z0-9_$()+/-]{0,237}$/.test(database)) {
    throw new CouchTestStoreError('COUCHDB_CONFIGURATION_INVALID', 'COUCHDB_DATABASE is not a valid CouchDB database name.', 500);
  }
  const username = String(process.env.COUCHDB_USERNAME || (process.env.NODE_ENV === 'production' ? '' : 'utms'));
  const password = String(process.env.COUCHDB_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : 'utms-couchdb-development'));
  if (process.env.NODE_ENV === 'production' && (!username || !password)) {
    throw new CouchTestStoreError('COUCHDB_CONFIGURATION_INVALID', 'CouchDB credentials are required in production.', 500);
  }
  return {
    baseUrl: baseUrl.origin,
    database,
    username,
    password,
  };
}

function storeDescriptor() {
  const { database } = configuration();
  return { provider: 'COUCHDB', database };
}

function databaseUrl(path = '') {
  const config = configuration();
  return `${config.baseUrl}/${encodeURIComponent(config.database)}${path}`;
}

function authHeader(config) {
  if (!config.username && !config.password) return null;
  return `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`;
}

async function readBoundedJson(response) {
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > MAX_RESPONSE_BYTES) {
    throw new CouchTestStoreError('COUCHDB_RESPONSE_TOO_LARGE', 'CouchDB response exceeded the configured limit.', 502);
  }
  const body = Buffer.from(await response.arrayBuffer());
  if (body.length > MAX_RESPONSE_BYTES) {
    throw new CouchTestStoreError('COUCHDB_RESPONSE_TOO_LARGE', 'CouchDB response exceeded the configured limit.', 502);
  }
  if (!body.length) return {};
  try {
    return JSON.parse(body.toString('utf8'));
  } catch {
    throw new CouchTestStoreError('COUCHDB_INVALID_JSON', 'CouchDB returned invalid JSON.', 502);
  }
}

async function request(path, options = {}) {
  const config = configuration();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const headers = { accept: 'application/json' };
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  const authorization = authHeader(config);
  if (authorization) headers.authorization = authorization;
  let response;
  try {
    response = await fetch(databaseUrl(path), {
      method: options.method || 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      redirect: 'error',
      signal: controller.signal,
    });
  } catch (error) {
    const timedOut = error?.name === 'AbortError';
    throw new CouchTestStoreError(
      timedOut ? 'COUCHDB_TIMEOUT' : 'COUCHDB_UNAVAILABLE',
      timedOut ? 'CouchDB request timed out.' : 'The Playwright CouchDB store is unavailable.',
      timedOut ? 504 : 503,
    );
  } finally {
    clearTimeout(timeout);
  }
  const payload = await readBoundedJson(response);
  if (options.acceptStatuses?.includes(response.status)) return { response, payload };
  if (!response.ok) {
    const conflict = response.status === 409;
    throw new CouchTestStoreError(
      conflict ? 'COUCHDB_WRITE_CONFLICT' : 'COUCHDB_REQUEST_FAILED',
      conflict ? 'The CouchDB document changed. Reload it before saving.' : `CouchDB returned HTTP ${response.status}.`,
      conflict ? 409 : 502,
      { couchStatus: response.status, reason: payload.reason || payload.error },
    );
  }
  return { response, payload };
}

let initializedFor;
let initialization;

async function ensureDatabase() {
  const config = configuration();
  const identity = `${config.baseUrl}/${config.database}`;
  if (initializedFor === identity) return storeDescriptor();
  if (initialization) return initialization;
  initialization = (async () => {
    const created = await request('', { method: 'PUT', acceptStatuses: [201, 202, 412] });
    if (![201, 202, 412].includes(created.response.status)) {
      throw new CouchTestStoreError('COUCHDB_INITIALIZATION_FAILED', 'The Playwright CouchDB database could not be created.', 502);
    }
    await request('/_index', {
      method: 'POST',
      body: {
        index: { fields: ['type', 'applicationId', 'cdeBinding.projectKey', 'bindingFingerprint'] },
        ddoc: 'utms-playwright',
        name: 'project-binding',
        type: 'json',
      },
    });
    initializedFor = identity;
    return storeDescriptor();
  })().finally(() => { initialization = null; });
  return initialization;
}

function hash(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function bindingForMapping(mapping) {
  return {
    serviceId: 'cde.edus.ir',
    origin: 'https://cde.edus.ir',
    projectKey: String(mapping.projectKey),
    repositories: {
      webUi: mapping.webUiRepoName || null,
      dataService: mapping.dataServiceRepoName || null,
      apiModule: mapping.apiModuleRepoName || null,
      messageConsumer: mapping.messageConsumerRepoName || null,
    },
  };
}

function bindingFingerprint(binding) {
  return hash(JSON.stringify(binding));
}

function assertDocument(document, expected = {}) {
  if (!document || document.type !== DOCUMENT_TYPE || document.schemaVersion !== SCHEMA_VERSION) {
    throw new CouchTestStoreError('COUCHDB_DOCUMENT_INVALID', 'CouchDB returned an unsupported Playwright document.', 502);
  }
  if (expected.applicationId && document.applicationId !== String(expected.applicationId)) {
    throw new CouchTestStoreError('COUCHDB_PROJECT_BINDING_MISMATCH', 'The Playwright document belongs to another UTMS Application.', 409);
  }
  if (expected.bindingFingerprint && document.bindingFingerprint !== expected.bindingFingerprint) {
    throw new CouchTestStoreError('COUCHDB_PROJECT_BINDING_MISMATCH', 'The Playwright document is mapped to a different CDE project configuration.', 409);
  }
  return document;
}

async function findDocuments(selector) {
  await ensureDatabase();
  const documents = [];
  let bookmark;
  do {
    const body = { selector, limit: PAGE_SIZE, ...(bookmark ? { bookmark } : {}) };
    const { payload } = await request('/_find', { method: 'POST', body });
    const page = Array.isArray(payload.docs) ? payload.docs : [];
    for (const document of page) {
      documents.push(document);
      if (documents.length > MAX_PROJECT_FILES) {
        throw new CouchTestStoreError('COUCHDB_PROJECT_TOO_LARGE', `A project cannot contain more than ${MAX_PROJECT_FILES} Playwright files.`, 413);
      }
    }
    const next = typeof payload.bookmark === 'string' ? payload.bookmark : '';
    if (page.length < PAGE_SIZE || !next || next === bookmark) break;
    bookmark = next;
  } while (true);
  return documents;
}

async function listProjectDocuments(applicationId, binding) {
  const fingerprint = bindingFingerprint(binding);
  const documents = await findDocuments({
    type: DOCUMENT_TYPE,
    applicationId: String(applicationId),
    'cdeBinding.projectKey': binding.projectKey,
    bindingFingerprint: fingerprint,
  });
  return documents.map(document => assertDocument(document, { applicationId, bindingFingerprint: fingerprint }));
}

async function getDocument(documentId, expected = {}) {
  await ensureDatabase();
  const { response, payload } = await request(`/${encodeURIComponent(String(documentId))}`, { acceptStatuses: [200, 404] });
  if (response.status === 404) return null;
  return assertDocument(payload, expected);
}

async function createDocument(input) {
  await ensureDatabase();
  const now = new Date().toISOString();
  const document = {
    _id: `playwright-file:${randomUUID()}`,
    type: DOCUMENT_TYPE,
    schemaVersion: SCHEMA_VERSION,
    applicationId: String(input.applicationId),
    path: String(input.path),
    pathKey: String(input.path).toLocaleLowerCase('en-US'),
    script: String(input.script),
    description: input.description || null,
    sourceHash: hash(input.script),
    cdeBinding: input.cdeBinding,
    bindingFingerprint: bindingFingerprint(input.cdeBinding),
    createdById: String(input.userId),
    updatedById: String(input.userId),
    createdAt: now,
    updatedAt: now,
  };
  const { payload } = await request(`/${encodeURIComponent(document._id)}`, { method: 'PUT', body: document });
  return { ...document, _rev: payload.rev };
}

async function updateDocument(current, input) {
  const expectedRevision = String(input.expectedRevision || '');
  if (!expectedRevision || current._rev !== expectedRevision) {
    throw new CouchTestStoreError('COUCHDB_WRITE_CONFLICT', 'The CouchDB document changed. Reload it before saving.', 409, { currentRevision: current._rev });
  }
  const document = {
    ...current,
    path: String(input.path),
    pathKey: String(input.path).toLocaleLowerCase('en-US'),
    script: String(input.script),
    description: input.description || null,
    sourceHash: hash(input.script),
    updatedById: String(input.userId),
    updatedAt: new Date().toISOString(),
  };
  const { payload } = await request(`/${encodeURIComponent(document._id)}`, { method: 'PUT', body: document });
  return { ...document, _rev: payload.rev };
}

async function health() {
  await ensureDatabase();
  const { payload } = await request('');
  return { ...storeDescriptor(), healthy: true, documentCount: Number(payload.doc_count || 0) };
}

function resetForTests() {
  initializedFor = undefined;
  initialization = null;
}

module.exports = {
  CouchTestStoreError,
  DOCUMENT_TYPE,
  SCHEMA_VERSION,
  assertDocument,
  bindingFingerprint,
  bindingForMapping,
  createDocument,
  getDocument,
  health,
  listProjectDocuments,
  resetForTests,
  storeDescriptor,
  updateDocument,
};
