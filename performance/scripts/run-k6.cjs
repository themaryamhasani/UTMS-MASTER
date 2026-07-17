const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const K6_IMAGE = 'grafana/k6:0.54.0';
const profiles = {
  smoke: 'performance/scenarios/smoke/api-console-smoke.js',
  baseline: 'performance/scenarios/baseline/baseline.js',
  load: 'performance/scenarios/load/load.js',
  stress: 'performance/scenarios/stress/stress.js',
  spike: 'performance/scenarios/spike/spike.js',
  soak: 'performance/scenarios/soak/soak.js',
  breakpoint: 'performance/scenarios/breakpoint/breakpoint.js',
  scalability: 'performance/scenarios/scalability/scalability.js',
  recovery: 'performance/scenarios/recovery/recovery.js',
  frontend: 'performance/scenarios/frontend/frontend.js',
};

function commandExists(command) {
  const result = spawnSync(process.platform === 'win32' ? 'where.exe' : 'command', process.platform === 'win32' ? [command] : ['-v', command], { stdio: 'ignore' });
  return result.status === 0;
}

function dockerAvailable() {
  if (!commandExists('docker')) return false;
  return spawnSync('docker', ['version', '--format', '{{.Server.Version}}'], { stdio: 'ignore' }).status === 0;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: false, ...options });
  if (result.status !== 0) process.exit(result.status || 1);
}

const profile = process.argv[2] || process.env.PERF_PROFILE || 'smoke';
const script = profiles[profile];
if (!script) {
  console.error(`Unknown performance profile "${profile}". Known profiles: ${Object.keys(profiles).join(', ')}`);
  process.exit(1);
}

const runId = process.env.PERF_RUN_ID || `${profile}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
const outputDir = process.env.PERF_OUTPUT_DIR || path.join('artifacts', 'performance', runId);
fs.mkdirSync(outputDir, { recursive: true });

const env = {
  ...process.env,
  PERF_PROFILE: profile,
  PERF_RUN_ID: runId,
  PERF_OUTPUT_DIR: process.env.PERF_OUTPUT_DIR || `artifacts/performance/${runId}`,
};

const summaryExport = path.posix.join(env.PERF_OUTPUT_DIR.replace(/\\/g, '/'), 'summary-export.json');
const args = ['run', '--summary-export', summaryExport, script];

if (commandExists('k6')) {
  run('k6', args, { env });
  process.exit(0);
}

if (dockerAvailable()) {
  const workdir = process.cwd();
  const dockerRunEnv = { ...env };
  for (const key of ['PERF_BASE_URL', 'PERF_WEB_URL']) {
    dockerRunEnv[key] = String(dockerRunEnv[key] || '')
      .replace('http://localhost:', 'http://host.docker.internal:')
      .replace('http://127.0.0.1:', 'http://host.docker.internal:');
  }
  const dockerEnv = Object.entries(dockerRunEnv)
    .filter(([key]) => key.startsWith('PERF_'))
    .flatMap(([key, value]) => ['-e', `${key}=${value}`]);
  run('docker', [
    'run',
    '--rm',
    '-i',
    '--add-host=host.docker.internal:host-gateway',
    '-v',
    `${workdir.replace(/\\/g, '/')}:/workspace`,
    '-w',
    '/workspace',
    ...dockerEnv,
    K6_IMAGE,
    ...args,
  ], { env });
}

console.error('k6 is not installed and Docker is not available. Install k6 or start Docker Desktop, then rerun this command.');
process.exit(1);
