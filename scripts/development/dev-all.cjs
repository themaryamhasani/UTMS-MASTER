'use strict';

const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const envFile = path.join(repositoryRoot, '.env');
if (existsSync(envFile) && typeof process.loadEnvFile === 'function') process.loadEnvFile(envFile);

const children = new Set();
let stopping = false;

function npmInvocation(script) {
  const npmCli = process.env.npm_execpath;
  if (npmCli && npmCli.endsWith('.js')) return [process.execPath, [npmCli, 'run', script]];
  if (process.platform === 'win32') {
    const installed = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
    if (existsSync(installed)) return [process.execPath, [installed, 'run', script]];
  }
  return [process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', script]];
}

function start(script) {
  const [command, args] = npmInvocation(script);
  const child = spawn(command, args, { cwd: repositoryRoot, env: process.env, stdio: 'inherit', shell: false });
  children.add(child);
  child.once('error', error => { console.error(`[dev:all] ${script}: ${error.message}`); void shutdown(1); });
  child.once('exit', code => { children.delete(child); if (!stopping) void shutdown(code || 1); });
}

async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === 'win32') {
    await new Promise(resolve => {
      const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
      killer.once('error', resolve); killer.once('exit', resolve);
    });
  } else child.kill('SIGTERM');
}

async function shutdown(code = 0) {
  if (stopping) return; stopping = true;
  await Promise.allSettled([...children].map(stop));
  process.exit(code);
}

start('dev:api');
start('dev:web');
process.once('SIGINT', () => void shutdown(0));
process.once('SIGTERM', () => void shutdown(0));
