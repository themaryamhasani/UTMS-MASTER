const { spawnSync } = require('node:child_process');

const compose = ['compose', '-p', 'utms-test', '-f', 'infrastructure/compose/docker-compose.test.yml'];
const action = process.argv[2];

function docker(args, options = {}) {
  const result = spawnSync('docker', [...compose, ...args], { stdio: 'inherit', shell: false });
  if (result.status !== 0) {
    if (options.logsOnFailure) {
      spawnSync('docker', [...compose, 'ps'], { stdio: 'inherit', shell: false });
      spawnSync('docker', [...compose, 'logs', '--no-color', '--tail', '200', 'postgres-test', 'redis-test', 'api-test', 'web-test'], {
        stdio: 'inherit',
        shell: false,
      });
    }
    process.exit(result.status ?? 1);
  }
}

async function waitFor(url, label) {
  const deadline = Date.now() + Number(process.env.UTMS_STACK_WAIT_MS || 180_000);
  let lastError = '';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        console.log(`${label} healthy: ${url}`);
        return;
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise(resolve => setTimeout(resolve, 1_000));
  }
  throw new Error(`${label} did not become healthy: ${lastError}`);
}

async function main() {
  if (action === 'up') return docker(['up', '-d', '--build', 'postgres-test', 'redis-test', 'api-test', 'web-test'], { logsOnFailure: true });
  if (action === 'down') return docker(['down', '--remove-orphans']);
  if (action === 'clean') return docker(['down', '-v', '--remove-orphans']);
  if (action === 'wait') {
    await waitFor(process.env.UTMS_TEST_API_URL || 'http://127.0.0.1:14174/api/health', 'api-test');
    await waitFor(process.env.UTMS_TEST_WEB_URL || 'http://127.0.0.1:15173', 'web-test');
    return;
  }
  if (action === 'reset') {
    const base = process.env.UTMS_TEST_API_URL || 'http://127.0.0.1:14174';
    const response = await fetch(`${base}/api/api-console/__test/reset`, { method: 'POST' });
    if (!response.ok) throw new Error(`Test reset failed with HTTP ${response.status}`);
    console.log(JSON.stringify(await response.json()));
    return;
  }
  if (action === 'seed') {
    const base = process.env.UTMS_TEST_API_URL || 'http://127.0.0.1:14174';
    const response = await fetch(`${base}/api/api-console/__test/reset`, { method: 'POST' });
    if (!response.ok) throw new Error(`Test seed/reset failed with HTTP ${response.status}`);
    console.log('Isolated test seed reset complete.');
    return;
  }
  throw new Error('Usage: node scripts/testing/stack.cjs <up|wait|reset|seed|down|clean>');
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
