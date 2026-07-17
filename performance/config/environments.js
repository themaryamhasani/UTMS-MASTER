const productionHostHints = [
  'prod',
  'production',
  'utms.ir',
  'medu.ir',
  'prostage',
];

function env(name, fallback) {
  return __ENV[name] || fallback;
}

function integer(name, fallback) {
  const value = Number(env(name, String(fallback)));
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative number.`);
  }
  return Math.floor(value);
}

function decimal(name, fallback) {
  const value = Number(env(name, String(fallback)));
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative number.`);
  }
  return value;
}

function bool(name, fallback = false) {
  const value = String(env(name, fallback ? 'true' : 'false')).toLowerCase();
  return ['1', 'true', 'yes', 'y'].includes(value);
}

function normalizeUrl(value, name) {
  if (!value) throw new Error(`${name} is required.`);
  if (!/^https?:\/\/[^/]+/i.test(value)) {
    throw new Error(`${name} must be an absolute http(s) URL.`);
  }
  return String(value).replace(/\/$/, '');
}

function parseHost(value) {
  const match = String(value).match(/^https?:\/\/([^/:]+)(?::\d+)?(?:\/|$)/i);
  if (!match) throw new Error(`Invalid URL: ${value}`);
  return match[1];
}

export function loadEnvironment(profile = env('PERF_PROFILE', 'smoke')) {
  const baseUrl = normalizeUrl(env('PERF_BASE_URL', 'http://localhost:4174'), 'PERF_BASE_URL');
  const webUrl = normalizeUrl(env('PERF_WEB_URL', 'http://localhost:5173'), 'PERF_WEB_URL');
  const outputDir = env('PERF_OUTPUT_DIR', `artifacts/performance/${env('PERF_RUN_ID', `perf-${Date.now()}`)}`);
  return {
    profile,
    baseUrl,
    webUrl,
    environment: env('PERF_ENVIRONMENT', 'local'),
    runId: env('PERF_RUN_ID', `perf-${Date.now()}`),
    seed: integer('PERF_SEED', 20260717),
    role: env('PERF_ROLE', 'DEVELOPER'),
    appId: env('PERF_APP_ID', 'app-1'),
    scope: env('PERF_SCOPE', 'SYSTEMS'),
    vus: integer('PERF_VUS', 2),
    rate: integer('PERF_RATE', 4),
    duration: env('PERF_DURATION', '1m'),
    rampDuration: env('PERF_RAMP_DURATION', '30s'),
    peakRate: integer('PERF_PEAK_RATE', 12),
    maxVus: integer('PERF_MAX_VUS', 20),
    thinkTimeMin: decimal('PERF_THINK_TIME_MIN', 0.3),
    thinkTimeMax: decimal('PERF_THINK_TIME_MAX', 1.5),
    datasetSize: integer('PERF_DATASET_SIZE', 20),
    p95Budget: integer('PERF_P95_BUDGET', 1500),
    p99Budget: integer('PERF_P99_BUDGET', 3000),
    errorRate: decimal('PERF_ERROR_RATE', 0.01),
    allowWrites: bool('PERF_ALLOW_WRITES', profile === 'smoke' || profile === 'baseline' || profile === 'load'),
    allowDestructive: bool('PERF_ALLOW_DESTRUCTIVE_TESTS', false),
    outputDir,
  };
}

export function assertSafeTarget(config, options = {}) {
  const hostname = parseHost(config.baseUrl);
  const localHosts = new Set(['localhost', '127.0.0.1', 'host.docker.internal', 'api', 'api-test']);
  const safeEnvironment = ['local', 'test', 'performance', 'ci'].includes(String(config.environment).toLowerCase());
  const productionLike = productionHostHints.some(hint => hostname.toLowerCase().includes(hint));
  if ((!localHosts.has(hostname) && !safeEnvironment) || productionLike || config.environment === 'production') {
    throw new Error(`Refusing to run performance tests against unsafe target ${config.baseUrl}. Set PERF_ENVIRONMENT=local/test/performance/ci and use an isolated URL.`);
  }
  if (options.requiresWrites && !config.allowWrites) {
    throw new Error('This profile performs writes. Set PERF_ALLOW_WRITES=true for an isolated performance environment.');
  }
  if (options.destructive && !config.allowDestructive) {
    throw new Error('This profile is destructive/capacity oriented. Set PERF_ALLOW_DESTRUCTIVE_TESTS=true explicitly.');
  }
}

export function redactedConfig(config) {
  return {
    profile: config.profile,
    baseUrl: config.baseUrl,
    webUrl: config.webUrl,
    environment: config.environment,
    runId: config.runId,
    seed: config.seed,
    role: config.role,
    appId: config.appId,
    scope: config.scope,
    vus: config.vus,
    rate: config.rate,
    duration: config.duration,
    maxVus: config.maxVus,
    allowWrites: config.allowWrites,
    allowDestructive: config.allowDestructive,
    outputDir: config.outputDir,
  };
}
