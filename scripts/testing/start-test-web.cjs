const { spawn } = require('node:child_process');
const path = require('node:path');

const webBaseUrl = new URL(process.env.UTMS_WEB_BASE_URL || 'http://127.0.0.1:5173');
const webPort = webBaseUrl.port || (webBaseUrl.protocol === 'https:' ? '443' : '80');

// Calling npm.cmd from a Node child process can fail with EINVAL on Windows
// (notably with newer Node releases). Invoke Vite through the current Node
// executable so Playwright's webServer remains portable and deterministic.
const viteCli = path.resolve(__dirname, '../../node_modules/vite/bin/vite.js');
const child = spawn(process.execPath, [viteCli, '--host', '0.0.0.0', '--port', webPort, '--strictPort'], {
  cwd: path.resolve(__dirname, '../../apps/web'),
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'test',
    VITE_DEV_API_PROXY_TARGET: process.env.VITE_DEV_API_PROXY_TARGET || 'http://127.0.0.1:4174',
  },
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
child.on('exit', code => process.exit(code ?? 1));
