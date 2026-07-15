const { spawnSync } = require('node:child_process');

const executable = process.execPath;
const playwrightCli = require('node:path').resolve('node_modules/@playwright/test/cli.js');
const repeat = process.env.UTMS_REPEAT_COUNT || '10';
const result = spawnSync(
  executable,
  [playwrightCli, 'test', '--project=smoke-chromium', '--project=security-chromium', `--repeat-each=${repeat}`],
  { stdio: 'inherit', shell: false }
);
process.exit(result.status ?? 1);
