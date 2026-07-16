const fs = require('fs');
const path = require('path');

const REPOSITORY_ROOT = path.resolve(__dirname, '../../../../..');
const GENERATED_DIR = path.join(REPOSITORY_ROOT, 'runtime', 'domain-rpc');
const ENTRY_FILE = path.join(GENERATED_DIR, 'domain-services-entry.mjs');
const BUNDLE_FILE = path.join(GENERATED_DIR, 'domain-services.cjs');

const SERVICE_NAMES = [
  'testRequestApi',
  'requirementApi',
  'flowApi',
  'testCaseApi',
  'testRunApi',
  'bugApi',
  'retestTaskApi',
  'runIssueApi',
  'checklistApi',
  'playwrightApi',
  'releasePublishApi',
  'versionHistoryApi',
  'commandTraceApi',
  'auditLogApi',
  'commentApi',
  'notificationApi',
  'attachmentApi',
  'dashboardApi',
  'userApi',
  'systemSettingsApi',
  'workflowPolicyApi',
  'applicationApi',
  'securityChecklistApi',
];

let loadedServices = null;
const inFlightQueries = new Map();
const SINGLE_FLIGHT_MAX_AGE_MS = 30000;
const SINGLE_FLIGHT_MAX_ENTRIES = 250;

const QUERY_OPERATION_POLICIES = new Set([
  'testRequestApi.getAll',
  'testRequestApi.getVisibleForRole',
  'testRequestApi.getById',
  'testRequestApi.getPendingForReview',
  'testRequestApi.getByRequester',
  'testRequestApi.getByAssignee',
  'requirementApi.getAll',
  'requirementApi.getById',
  'requirementApi.getIncomplete',
  'flowApi.getByRequirement',
  'testCaseApi.getAll',
  'testCaseApi.getVisibleForRole',
  'testCaseApi.getById',
  'testCaseApi.getByTestRequest',
  'testRunApi.getAll',
  'testRunApi.getVisibleForRole',
  'testRunApi.getById',
  'testRunApi.getByTestRequest',
  'testRunApi.getPending',
  'bugApi.getAll',
  'bugApi.getVisibleForRole',
  'bugApi.getById',
  'bugApi.getByAssignee',
  'bugApi.getReadyForRetest',
  'bugApi.getCriticalOpen',
  'bugApi.getCriticalOpenVisible',
  'retestTaskApi.getAll',
  'retestTaskApi.getVisibleForRole',
  'retestTaskApi.getByBug',
  'runIssueApi.getAll',
  'runIssueApi.getOpen',
  'checklistApi.getAll',
  'checklistApi.getById',
  'checklistApi.getPending',
  'playwrightApi.getAll',
  'playwrightApi.getById',
  'playwrightApi.getTestFiles',
  'playwrightApi.discoverFolders',
  'playwrightApi.discoverFiles',
  'releasePublishApi.getAll',
  'releasePublishApi.getById',
  'releasePublishApi.getByPrimaryTestRequest',
  'releasePublishApi.getPrimaryRequestCandidates',
  'releasePublishApi.getEligiblePrimaryRequests',
  'releasePublishApi.getRelatedCandidates',
  'releasePublishApi.getEvidence',
  'releasePublishApi.getCriticalOpenBugs',
  'versionHistoryApi.getAll',
  'versionHistoryApi.getById',
  'versionHistoryApi.getByPrimaryTestRequest',
  'versionHistoryApi.getPrimaryRequestCandidates',
  'versionHistoryApi.getEligiblePrimaryRequests',
  'versionHistoryApi.getRelatedCandidates',
  'versionHistoryApi.getEvidence',
  'versionHistoryApi.getCriticalOpenBugs',
  'commandTraceApi.getAll',
  'commandTraceApi.getByCorrelationId',
  'commandTraceApi.getByIdempotencyKey',
  'auditLogApi.getAll',
  'auditLogApi.getByEntity',
  'commentApi.getByEntity',
  'notificationApi.getByUser',
  'notificationApi.getUnreadCount',
  'notificationApi.getOutbox',
  'attachmentApi.getByEntity',
  'userApi.getAll',
  'userApi.getById',
  'userApi.lookupByNationalCode',
  'userApi.getDevelopers',
  'userApi.getQASpecialists',
  'systemSettingsApi.getIntegrationSettings',
  'workflowPolicyApi.getAll',
  'workflowPolicyApi.getForApplication',
  'applicationApi.getAll',
  'applicationApi.getById',
  'securityChecklistApi.getById',
  'securityChecklistApi.getTemplate',
  'reportsApi.getSystemOverview',
  'reportsApi.getTestRequestReport',
  'reportsApi.getQualityHealth',
  'reportsApi.getDeveloperPerformance',
  'reportsApi.getDeveloperBugFixReport',
  'reportsApi.getRequirementReport',
  'reportsApi.getFlowCoverage',
  'reportsApi.getTestCaseReport',
  'reportsApi.getTestRunReport',
  'reportsApi.getChecklistReport',
  'reportsApi.getReleaseReport',
  'reportsApi.getEmergencyPublishReport',
  'reportsApi.getUsersRolesReport',
  'reportsApi.getAuditReport',
  'reportsApi.getAttachmentReport',
  'reportsApi.getPlaywrightReport',
  'reportsApi.getProductQualityOverview',
  'reportsApi.getOpenBugsList',
  'reportsApi.getCommentReport',
  'reportsApi.getTraceabilityReport',
]);

const SINGLE_FLIGHT_OPERATION_POLICIES = new Set([
  ...QUERY_OPERATION_POLICIES,
  'dashboardApi.getStats',
  'releasePublishApi.getPendingDecision',
  'releasePublishApi.getPendingQAReview',
]);

class DomainRpcError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.category = 'DOMAIN_RPC_ERROR';
  }
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function normalizeForFingerprint(value) {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(normalizeForFingerprint);
  }
  if (isPlainObject(value)) {
    return Object.keys(value).sort().reduce((normalized, key) => {
      const child = value[key];
      if (typeof child === 'function' || typeof child === 'symbol' || typeof child === 'undefined') {
        throw new DomainRpcError(`Unsupported RPC argument value for fingerprint: ${key}`, 400);
      }
      normalized[key] = normalizeForFingerprint(child);
      return normalized;
    }, {});
  }
  throw new DomainRpcError(`Unsupported RPC argument type for fingerprint: ${typeof value}`, 400);
}

function safeHeaderValue(headers, name) {
  const value = headers[name];
  return Array.isArray(value) ? value.join(',') : value || '';
}

function parseContextHeader(req) {
  const raw = safeHeaderValue(req.headers, 'x-utms-context');
  if (!raw) return {};
  try {
    return JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  } catch {
    return { invalidContextHeader: true };
  }
}

function buildQueryFingerprint(req, serviceName, methodName, args) {
  const context = parseContextHeader(req);
  const userId = safeHeaderValue(req.headers, 'x-user-id') || context.userId || context.user?.id || 'anonymous';
  return JSON.stringify(normalizeForFingerprint({
    service: serviceName,
    method: methodName,
    args,
    auth: {
      userId,
      role: context.role || safeHeaderValue(req.headers, 'x-user-role') || '',
    },
    context: {
      contextId: context.contextId || '',
      assignmentId: context.assignmentId || '',
      applicationId: context.applicationId || '',
      scope: context.scope || '',
      scopeApplicationIds: context.scopeApplicationIds || [],
    },
    tenant: safeHeaderValue(req.headers, 'x-tenant-id'),
  }));
}

function evictExpiredSingleFlights(now = Date.now()) {
  for (const [key, entry] of inFlightQueries) {
    if (now - entry.startedAt > SINGLE_FLIGHT_MAX_AGE_MS) {
      inFlightQueries.delete(key);
    }
  }
  while (inFlightQueries.size > SINGLE_FLIGHT_MAX_ENTRIES) {
    const oldestKey = inFlightQueries.keys().next().value;
    if (!oldestKey) break;
    inFlightQueries.delete(oldestKey);
  }
}

async function executeSingleFlight(key, executor) {
  evictExpiredSingleFlights();
  const existing = inFlightQueries.get(key);
  if (existing) {
    existing.joined += 1;
    return existing.promise;
  }

  let trackedPromise;
  trackedPromise = Promise.resolve()
    .then(executor)
    .finally(() => {
      const current = inFlightQueries.get(key);
      if (current && current.promise === trackedPromise) {
        inFlightQueries.delete(key);
      }
    });
  inFlightQueries.set(key, {
    promise: trackedPromise,
    startedAt: Date.now(),
    joined: 0,
  });
  return trackedPromise;
}

function isQueryOperation(serviceName, methodName) {
  return QUERY_OPERATION_POLICIES.has(`${serviceName}.${methodName}`);
}

function allowsSingleFlightOperation(serviceName, methodName) {
  return SINGLE_FLIGHT_OPERATION_POLICIES.has(`${serviceName}.${methodName}`);
}

function ensureGeneratedDirectory() {
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
}

function writeEntryFile() {
  const apiPath = path.relative(GENERATED_DIR, path.join(REPOSITORY_ROOT, 'apps', 'web', 'src', 'services', 'api.ts')).replace(/\\/g, '/');
  const reportsPath = path.relative(GENERATED_DIR, path.join(REPOSITORY_ROOT, 'apps', 'web', 'src', 'services', 'reportsApi.ts')).replace(/\\/g, '/');
  const apiUrl = apiPath.startsWith('.') ? apiPath : `./${apiPath}`;
  const reportsUrl = reportsPath.startsWith('.') ? reportsPath : `./${reportsPath}`;
  const entries = SERVICE_NAMES.map(name => `  ${name}: domainApi.${name},`).join('\n');
  const source = [
    `import * as domainApi from ${JSON.stringify(apiUrl)};`,
    `import { reportsApi } from ${JSON.stringify(reportsUrl)};`,
    '',
    'export const services = {',
    entries,
    '  reportsApi,',
    '};',
    'export const persistCurrentDataState = domainApi.persistCurrentDataState;',
    '',
  ].join('\n');
  fs.writeFileSync(ENTRY_FILE, source, 'utf8');
}

function bundleDomainServices() {
  ensureGeneratedDirectory();
  writeEntryFile();
  const esbuild = require('esbuild');
  esbuild.buildSync({
    entryPoints: [ENTRY_FILE],
    outfile: BUNDLE_FILE,
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    sourcemap: false,
    logLevel: 'silent',
    define: {
      'import.meta.env': '{}',
    },
  });
}

function loadServices() {
  if (loadedServices) return loadedServices;
  bundleDomainServices();
  delete require.cache[require.resolve(BUNDLE_FILE)];
  const bundled = require(BUNDLE_FILE);
  loadedServices = {
    services: bundled.services,
    persistCurrentDataState: bundled.persistCurrentDataState,
  };
  return loadedServices;
}

function canHandleDomainRpc(pathname) {
  return pathname === '/api/domain/rpc' || pathname === '/api/domain/health' || pathname === '/api/domain/services';
}

async function handleDomainRpc(req, parsedUrl, body) {
  if (parsedUrl.pathname === '/api/domain/health' && req.method === 'GET') {
    return {
      status: 'ok',
      service: 'utms-domain-rpc',
      mode: 'backend',
      services: [...SERVICE_NAMES, 'reportsApi'],
    };
  }

  if (parsedUrl.pathname === '/api/domain/services' && req.method === 'GET') {
    const { services } = loadServices();
    return Object.fromEntries(
      Object.entries(services).map(([name, service]) => [
        name,
        Object.keys(service).filter(key => typeof service[key] === 'function').sort(),
      ])
    );
  }

  if (parsedUrl.pathname !== '/api/domain/rpc' || req.method !== 'POST') {
    throw new DomainRpcError('Domain RPC endpoint not found.', 404);
  }

  const serviceName = String(body.service || '');
  const methodName = String(body.method || '');
  const args = Array.isArray(body.args) ? body.args : [];
  const { services, persistCurrentDataState } = loadServices();
  const service = services[serviceName];

  if (!service || typeof service !== 'object') {
    throw new DomainRpcError(`Unknown domain service: ${serviceName}`, 404);
  }

  const method = service[methodName];
  if (typeof method !== 'function') {
    throw new DomainRpcError(`Unknown domain method: ${serviceName}.${methodName}`, 404);
  }

  const queryOperation = isQueryOperation(serviceName, methodName);
  const singleFlightOperation = allowsSingleFlightOperation(serviceName, methodName);
  const execute = () => method(...args);
  const data = singleFlightOperation
    ? await executeSingleFlight(buildQueryFingerprint(req, serviceName, methodName, args), execute)
    : await execute();

  if (!queryOperation && typeof persistCurrentDataState === 'function') {
    await persistCurrentDataState();
  }
  return { data };
}

module.exports = {
  canHandleDomainRpc,
  handleDomainRpc,
  __testing: {
    isQueryOperation,
    allowsSingleFlightOperation,
    normalizeForFingerprint,
    buildQueryFingerprint,
  },
};
