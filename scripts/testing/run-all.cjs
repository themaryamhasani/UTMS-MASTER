const { spawnSync } = require('node:child_process');
const path = require('node:path');

const npmCli = process.env.npm_execpath || (process.platform === 'win32'
  ? path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js')
  : 'npm');
const npmCommand = npmCli.endsWith('.js') ? process.execPath : npmCli;
const npmPrefix = npmCli.endsWith('.js') ? [npmCli] : [];
const suites = [
  'test:smoke',
  'test:integration',
  'test:security',
  'test:structural',
  'test:e2e',
  'test:system',
  'test:accessibility',
  'test:regression',
  'test:uat',
  'test:compatibility',
];

for (const suite of suites) {
  const result = spawnSync(npmCommand, [...npmPrefix, 'run', suite], { stdio: 'inherit', shell: false });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
