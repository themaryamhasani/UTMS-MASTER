import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { chmod, chown, lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { hostname, tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const { Pool } = pg;
const MAGIC = Buffer.from('UTMSENC1');
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

function redisLabel(value) {
  try {
    const parsed = new URL(value);
    return `${parsed.protocol}//${parsed.hostname}:${parsed.port || (parsed.protocol === 'rediss:' ? '6380' : '6379')}`;
  } catch {
    return 'the configured Redis endpoint';
  }
}

async function connectRedis() {
  let startupComplete = false;
  const client = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    enableOfflineQueue: false,
    connectTimeout: 1500,
    retryStrategy: attempts => (startupComplete ? Math.min(attempts * 100, 2000) : null),
  });
  const ignoreInitialError = () => {};
  client.on('error', ignoreInitialError);
  try {
    await client.connect();
    await client.ping();
    startupComplete = true;
    client.off('error', ignoreInitialError);
    return client;
  } catch (error) {
    client.disconnect();
    throw new Error(`Playwright runner cannot reach Redis at ${redisLabel(redisUrl)}. Start Redis or run npm run dev:all.`, { cause: error });
  }
}

const connection = await connectRedis();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const s3 = new S3Client({
  region: process.env.S3_REGION || 'us-east-1',
  endpoint: process.env.S3_ENDPOINT || 'http://minio:9000',
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || 'utms-minio',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || 'utms-minio-development',
  },
});
const bucket = process.env.S3_BUCKET || 'utms-private';
const runnerId = `${hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`;
const playwrightCli = process.env.PLAYWRIGHT_CLI_PATH || '/test-runtime/node_modules/@playwright/test/cli.js';

function encryptionKey() {
  const value = process.env.UTMS_OBJECT_ENCRYPTION_KEY || '';
  if (process.env.NODE_ENV === 'production' && value.length < 32) throw new Error('UTMS_OBJECT_ENCRYPTION_KEY is required.');
  return createHash('sha256').update(value || 'utms-development-object-key').digest();
}

function decryptObject(value) {
  const input = Buffer.from(value);
  if (!input.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('Snapshot encryption header is invalid.');
  const iv = input.subarray(MAGIC.length, MAGIC.length + 12);
  const tag = input.subarray(MAGIC.length + 12, MAGIC.length + 28);
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(input.subarray(MAGIC.length + 28)), decipher.final()]);
}

async function encryptedSnapshot(key) {
  const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return JSON.parse(decryptObject(Buffer.from(await response.Body.transformToByteArray())).toString('utf8'));
}

function within(root, unsafeRelative) {
  const candidate = resolve(root, String(unsafeRelative).replaceAll('\\', '/'));
  const prefix = resolve(root) + sep;
  if (candidate !== resolve(root) && !candidate.startsWith(prefix)) throw new Error('Snapshot path escaped the run workspace.');
  return candidate;
}

async function writeReadOnlyFile(root, path, source) {
  const target = within(root, path);
  await mkdir(dirname(target), { recursive: true, mode: 0o755 });
  await writeFile(target, String(source), { mode: 0o444 });
  await chmod(target, 0o444);
}

async function makeTreeReadOnly(path) {
  const stat = await lstat(path);
  if (!stat.isDirectory()) return chmod(path, 0o444);
  for (const entry of await readdir(path)) await makeTreeReadOnly(join(path, entry));
  await chmod(path, 0o555);
}

function safeInteger(value, fallback, min, max) {
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max ? number : fallback;
}

function configSource(run, paths) {
  const projects = (run.projects || ['chromium']).filter(value => ['chromium', 'firefox', 'webkit'].includes(value));
  const trace = ['off', 'on', 'retain-on-failure', 'on-first-retry'].includes(run.trace) ? run.trace : 'retain-on-failure';
  return `'use strict';
const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests',
  outputDir: ${JSON.stringify(paths.results)},
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  forbidOnly: true,
  workers: ${safeInteger(run.workers, 1, 1, 16)},
  retries: ${safeInteger(run.retries, 0, 0, 3)},
  maxFailures: ${safeInteger(run.maxFailures, 0, 0, 10000)},
  reporter: [['json', { outputFile: ${JSON.stringify(paths.report)} }], ['line']],
  use: {
    baseURL: process.env.BASE_URL,
    trace: ${JSON.stringify(trace)},
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ignoreHTTPSErrors: false,
  },
  projects: ${JSON.stringify(projects.map(name => ({ name, use: { browserName: name } })))},
});
`;
}

async function collectFiles(root, current = root) {
  const files = [];
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const path = join(current, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(root, path));
    else if (entry.isFile()) files.push({ path, relativePath: relative(root, path).replaceAll('\\', '/') });
  }
  return files;
}

async function uploadArtifact(runId, root, artifact) {
  const body = await readFile(artifact.path);
  if (body.length > 128 * 1024 * 1024) return null;
  const key = `artifacts/${runId}/${artifact.relativePath}.enc`;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(body), cipher.final()]);
  const payload = Buffer.concat([MAGIC, iv, cipher.getAuthTag(), encrypted]);
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: payload, ContentType: 'application/octet-stream' }));
  return key;
}

function reportCounts(report) {
  const counts = { totalTests: 0, passedTests: 0, failedTests: 0, skippedTests: 0, cancelledTests: 0 };
  const visitSuite = suite => {
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        counts.totalTests += 1;
        const status = test.status || test.results?.at(-1)?.status || 'failed';
        if (status === 'expected' || status === 'passed') counts.passedTests += 1;
        else if (status === 'skipped') counts.skippedTests += 1;
        else if (status === 'interrupted') counts.cancelledTests += 1;
        else counts.failedTests += 1;
      }
    }
    for (const child of suite.suites || []) visitSuite(child);
  };
  for (const suite of report?.suites || []) visitSuite(suite);
  return counts;
}

async function terminateTree(child, signal = 'SIGTERM') {
  if (!child?.pid) return;
  try { process.kill(-child.pid, signal); } catch { try { child.kill(signal); } catch { /* already exited */ } }
}

async function executeRun(job) {
  const run = await prisma.playwrightRun.findUnique({
    where: { id: String(job.data.runId) },
    include: { snapshot: true, environmentProfile: true },
  });
  if (!run || !run.snapshot || !run.environmentProfile) throw new Error('Run, snapshot, or environment no longer exists.');
  if (run.status === 'CANCELLED') return { cancelled: true };
  if (run.snapshot.status !== 'READY' || !run.snapshot.objectKey) throw new Error('Run snapshot is not ready.');
  const bundle = await encryptedSnapshot(run.snapshot.objectKey);
  if (bundle.contentHash !== run.snapshot.contentHash) throw new Error('Snapshot content hash does not match its database manifest.');
  const workspace = await mkdtemp(join(process.env.RUNNER_TEMP_ROOT || tmpdir(), `utms-${run.id}-`));
  const sourceRoot = join(workspace, 'project-sources');
  const paths = {
    report: join(workspace, 'artifacts', 'report.json'),
    results: join(workspace, 'artifacts', 'test-results'),
    logs: join(workspace, 'artifacts', 'runner.log'),
    home: join(workspace, 'home'),
  };
  const testUid = safeInteger(process.env.PLAYWRIGHT_TEST_UID, 1001, 1, 65535);
  const testGid = safeInteger(process.env.PLAYWRIGHT_TEST_GID, 1001, 1, 65535);
  let heartbeat;
  let pollCancellation;
  let timeout;
  let child;
  let cancelled = false;
  let timedOut = false;
  const started = Date.now();
  try {
    await chmod(workspace, 0o755);
    await mkdir(sourceRoot, { recursive: true, mode: 0o755 });
    await mkdir(dirname(paths.report), { recursive: true, mode: 0o777 });
    await mkdir(paths.results, { recursive: true, mode: 0o777 });
    await mkdir(paths.home, { recursive: true, mode: 0o700 });
    if (process.getuid?.() === 0) {
      await chown(dirname(paths.report), testUid, testGid);
      await chown(paths.results, testUid, testGid);
      await chown(paths.home, testUid, testGid);
    }
    for (const file of bundle.files || []) {
      if (file.path.startsWith('tests/')) await writeReadOnlyFile(workspace, file.path, file.code);
      else await writeReadOnlyFile(sourceRoot, file.path, file.code);
    }
    const selectedTest = within(workspace, `tests/${String(run.testFilePath).replace(/^tests\//, '')}`);
    await lstat(selectedTest);
    const configPath = join(workspace, 'playwright.config.cjs');
    await writeReadOnlyFile(workspace, 'playwright.config.cjs', configSource(run, paths));
    const testNodeModules = process.env.PLAYWRIGHT_TEST_NODE_MODULES || '/test-runtime/node_modules';
    try { await symlink(testNodeModules, join(workspace, 'node_modules'), 'dir'); } catch { /* local development may resolve parent modules */ }
    if (await lstat(join(workspace, 'tests')).catch(() => null)) await makeTreeReadOnly(join(workspace, 'tests'));
    await makeTreeReadOnly(sourceRoot);
    const args = ['test', relative(workspace, selectedTest).replaceAll('\\', '/'), '--config', configPath];
    await prisma.playwrightRun.update({
      where: { id: run.id },
      data: {
        status: 'RUNNING', queueStatus: 'DISPATCHED', runnerId, dispatchedAt: new Date(), startedAt: new Date(),
        lastHeartbeatAt: new Date(), workingDirectory: `isolated://${run.id}`, command: JSON.stringify([process.execPath, playwrightCli, ...args]),
      },
    });
    const childEnv = {
      PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
      HOME: paths.home,
      CI: '1',
      BASE_URL: run.environmentProfile.webBaseUrl,
      API_BASE_URL: run.environmentProfile.apiBaseUrl || '',
      GATEWAY_BASE_URL: run.environmentProfile.gatewayBaseUrl || '',
      UTMS_SOURCE_ROOT: sourceRoot,
      PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || '/ms-playwright',
      NODE_PATH: testNodeModules,
    };
    child = spawn(process.execPath, [playwrightCli, ...args], {
      cwd: workspace,
      env: childEnv,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...(process.getuid?.() === 0 ? { uid: testUid, gid: testGid } : {}),
    });
    let logs = '';
    const append = chunk => { logs = `${logs}${chunk}`.slice(-8 * 1024 * 1024); };
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    heartbeat = setInterval(() => prisma.playwrightRun.updateMany({
      where: { id: run.id, status: 'RUNNING' }, data: { lastHeartbeatAt: new Date() },
    }).catch(() => {}), 5000);
    pollCancellation = setInterval(async () => {
      if (await connection.get(`utms:playwright:cancel:${run.id}`)) {
        cancelled = true;
        await terminateTree(child);
      }
    }, 1000);
    timeout = setTimeout(async () => {
      timedOut = true;
      await terminateTree(child);
      setTimeout(() => terminateTree(child, 'SIGKILL'), 5000).unref();
    }, safeInteger(run.timeoutSeconds, 600, 30, 3600) * 1000);
    const exit = await new Promise((resolveExit, rejectExit) => {
      child.once('error', rejectExit);
      child.once('exit', (code, signal) => resolveExit({ code, signal }));
    });
    clearInterval(heartbeat);
    clearInterval(pollCancellation);
    clearTimeout(timeout);
    await writeFile(paths.logs, logs, { mode: 0o600 });
    const report = JSON.parse(await readFile(paths.report, 'utf8').catch(() => '{}'));
    const counts = reportCounts(report);
    const artifactFiles = await collectFiles(dirname(paths.report));
    const artifactPaths = (await Promise.all(artifactFiles.map(file => uploadArtifact(run.id, dirname(paths.report), file)))).filter(Boolean);
    const latest = await prisma.playwrightRun.findUnique({ where: { id: run.id }, select: { status: true } });
    cancelled ||= latest?.status === 'CANCELLED';
    const status = cancelled ? 'CANCELLED' : timedOut ? 'ERROR' : exit.code === 0 ? 'PASSED' : 'FAILED';
    const reportArtifact = artifactPaths.find(path => path.endsWith('/report.json.enc')) || '';
    const persistedReport = {
      reporter: 'json',
      fileName: 'report.json',
      mimeType: 'application/json',
      storagePath: reportArtifact,
      generatedAt: new Date().toISOString(),
      status,
      totalTests: counts.totalTests,
      passedTests: counts.passedTests,
      failedTests: counts.failedTests,
      skippedTests: counts.skippedTests,
      cancelledTests: counts.cancelledTests,
      durationMs: Date.now() - started,
      failures: [],
      passed: [],
      skipped: [],
      cancelled: [],
      content: JSON.stringify(report, null, 2),
    };
    await prisma.playwrightRun.update({
      where: { id: run.id },
      data: {
        status,
        queueStatus: status === 'ERROR' ? 'FAILED' : 'DONE',
        completedAt: new Date(),
        duration: Date.now() - started,
        report: persistedReport,
        logs: `${logs}${timedOut ? '\nRun exceeded its configured timeout.' : ''}`.slice(-8 * 1024 * 1024),
        artifactPaths,
        ...counts,
      },
    });
    await connection.del(`utms:playwright:cancel:${run.id}`);
    return { status, exit, artifactCount: artifactPaths.length, ...counts };
  } catch (error) {
    await terminateTree(child, 'SIGKILL');
    await prisma.playwrightRun.updateMany({
      where: { id: run.id, status: { not: 'CANCELLED' } },
      data: { status: 'ERROR', queueStatus: 'FAILED', completedAt: new Date(), duration: Date.now() - started, logs: `Runner failure: ${String(error.message || error).slice(0, 4000)}` },
    });
    throw error;
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    if (pollCancellation) clearInterval(pollCancellation);
    if (timeout) clearTimeout(timeout);
    await rm(workspace, { recursive: true, force: true }).catch(() => {});
  }
}

const worker = new Worker('utms-playwright-runs', executeRun, {
  connection,
  concurrency: Math.max(1, Math.min(4, Number(process.env.PLAYWRIGHT_RUNNER_CONCURRENCY || 1))),
  lockDuration: 120_000,
  stalledInterval: 30_000,
  maxStalledCount: 1,
});

worker.on('failed', (job, error) => {
  console.error(JSON.stringify({ event: 'playwright-run-failed', jobId: job?.id, message: error.message }));
});
worker.on('error', error => {
  console.error(JSON.stringify({ event: 'playwright-runner-error', message: error.message }));
});

async function shutdown() {
  await worker.close();
  await prisma.$disconnect();
  await pool.end();
  await connection.quit();
  process.exit(0);
}

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
console.log(JSON.stringify({ event: 'runner-ready', runnerId, queue: 'utms-playwright-runs' }));
