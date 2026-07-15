const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const executable = process.execPath;
const playwrightCli = path.resolve('node_modules/@playwright/test/cli.js');
const browserCache = process.env.PLAYWRIGHT_BROWSERS_PATH ||
  (process.platform === 'win32' ? path.join(process.env.LOCALAPPDATA || '', 'ms-playwright') : path.join(process.env.HOME || '', '.cache/ms-playwright'));
const hasBrowser = (name) => fs.existsSync(browserCache) && fs.readdirSync(browserCache).some(entry => entry.startsWith(`${name}-`));
const projects = ['compatibility-chromium', 'compatibility-mobile'];
const missing = [];
if (hasBrowser('firefox')) projects.push('compatibility-firefox'); else missing.push('firefox');
if (hasBrowser('webkit')) projects.push('compatibility-webkit'); else missing.push('webkit');

if (missing.length) {
  fs.mkdirSync(path.resolve('artifacts/tests'), { recursive: true });
  fs.writeFileSync(path.resolve('artifacts/tests/compatibility-pending.json'), JSON.stringify({
    gapId: 'GAP-ENGINE-001', missingBrowsers: missing, executedProjects: projects,
    message: 'Install the pinned Playwright browser binaries to complete the cross-engine matrix.',
  }, null, 2));
  console.warn(`GAP-ENGINE-001: ${missing.join(', ')} binaries are not installed; running available Chromium compatibility projects.`);
}

const args = [playwrightCli, 'test', ...projects.flatMap(project => ['--project', project])];
const result = spawnSync(executable, args, { stdio: 'inherit', shell: false });
process.exit(result.status ?? 1);
