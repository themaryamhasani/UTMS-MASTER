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

class DomainRpcError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.category = 'DOMAIN_RPC_ERROR';
  }
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

  const data = await method(...args);
  if (typeof persistCurrentDataState === 'function') {
    await persistCurrentDataState();
  }
  return { data };
}

module.exports = {
  canHandleDomainRpc,
  handleDomainRpc,
};
