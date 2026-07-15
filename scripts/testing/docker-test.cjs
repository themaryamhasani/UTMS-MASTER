const { spawnSync } = require('node:child_process');
const path = require('node:path');

const compose = ['compose', '-p', 'utms-test', '-f', 'infrastructure/compose/docker-compose.test.yml'];
function run(args, allowFailure = false) {
  const result = spawnSync('docker', [...compose, ...args], { stdio: 'inherit', shell: false });
  if (!allowFailure && result.status !== 0) throw new Error(`docker ${args.join(' ')} failed`);
  return result.status ?? 1;
}

let status = 1;
try {
  run(['up', '-d', '--build', 'postgres-test', 'redis-test', 'api-test', 'web-test']);
  const npmCli = process.env.npm_execpath || (process.platform === 'win32'
    ? path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js')
    : 'npm');
  const npmCommand = npmCli.endsWith('.js') ? process.execPath : npmCli;
  const npmPrefix = npmCli.endsWith('.js') ? [npmCli] : [];
  const wait = spawnSync(npmCommand, [...npmPrefix, 'run', 'test:stack:wait'], { stdio: 'inherit', shell: false });
  if (wait.status !== 0) throw new Error('Docker test stack did not become healthy');
  status = run(['run', '--rm', 'qa-tests'], true);
  run(['logs', '--no-color', 'api-test', 'web-test'], true);
} finally {
  run(['down', '-v', '--remove-orphans'], true);
}
process.exit(status);
