const { spawnSync } = require('node:child_process');

const DEFAULT_DATABASE_URL = 'postgresql://postgres:1234@localhost:5432/UTMS?schema=public';
const task = process.argv[2];
const root = process.cwd();

const commands = {
  generate: ['generate'],
  migrate: ['migrate', 'deploy'],
  'migrate:status': ['migrate', 'status'],
  seed: ['db', 'seed'],
};

if (!commands[task]) {
  console.error(`Unsupported database task: ${task || '(missing)'}`);
  console.error(`Supported tasks: ${Object.keys(commands).join(', ')}`);
  process.exit(1);
}

const prismaCli = require.resolve('prisma/build/index.js');
const env = {
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
};

const result = spawnSync(process.execPath, [prismaCli, ...commands[task]], {
  cwd: root,
  env,
  stdio: 'inherit',
  shell: false,
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
