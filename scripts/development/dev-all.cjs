'use strict';

const { spawn, spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const net = require('node:net');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { RedisMemoryServer } = require('redis-memory-server');
const { HeadBucketCommand, S3Client } = require('@aws-sdk/client-s3');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const envFile = path.join(repositoryRoot, '.env');
if (existsSync(envFile) && typeof process.loadEnvFile === 'function') process.loadEnvFile(envFile);

const children = new Map();
let embeddedRedis;
let stopping = false;

function positivePort(value, fallback) {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : fallback;
}

function configuredRedisUrl() {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;
  const port = positivePort(process.env.REDIS_PORT, 6379);
  const password = process.env.REDIS_PASSWORD;
  return password
    ? `redis://:${encodeURIComponent(password)}@127.0.0.1:${port}`
    : `redis://127.0.0.1:${port}`;
}

function configuredCouchDbUrl() {
  if (process.env.COUCHDB_URL) return process.env.COUCHDB_URL;
  return `http://127.0.0.1:${positivePort(process.env.COUCHDB_PORT, 5984)}`;
}

function configuredCouchDbCredentials() {
  return {
    username: String(process.env.COUCHDB_USERNAME || (process.env.NODE_ENV === 'production' ? '' : 'utms')),
    password: String(process.env.COUCHDB_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : 'utms-couchdb-development')),
  };
}

function configuredS3Endpoint() {
  return process.env.S3_ENDPOINT || `http://127.0.0.1:${positivePort(process.env.MINIO_PORT, 9000)}`;
}

function redisAddress(redisUrl) {
  try {
    const parsed = new URL(redisUrl);
    return {
      host: parsed.hostname || '127.0.0.1',
      port: positivePort(parsed.port, parsed.protocol === 'rediss:' ? 6380 : 6379),
      label: `${parsed.protocol}//${parsed.hostname}:${positivePort(parsed.port, parsed.protocol === 'rediss:' ? 6380 : 6379)}`,
    };
  } catch {
    throw new Error('REDIS_URL must be a valid redis:// or rediss:// URL.');
  }
}

function canConnect({ host, port }, timeoutMs = 750) {
  return new Promise(resolve => {
    const socket = net.createConnection({ host, port });
    const finish = available => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(available);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

function errorMessage(error) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim()) return error.trim();
  return 'The dependency exited before it became ready.';
}

function startComposeService(serviceName) {
  const docker = spawnSync('docker', ['compose', 'up', '-d', serviceName], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 180_000,
  });
  if (docker.error || docker.status !== 0) {
    const detail = String(docker.stderr || docker.stdout || docker.error?.message || '').trim();
    throw new Error(`${serviceName} could not be started with Docker Compose.${detail ? ` ${detail}` : ''}`);
  }
}

async function waitForAddress(address, attempts = 40) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await canConnect(address, 500)) return true;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return false;
}

async function couchDbReadiness(origin, timeoutMs = 1_000) {
  const { username, password } = configuredCouchDbCredentials();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const headers = {};
  if (username || password) headers.authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  try {
    const response = await fetch(`${origin}/_up`, { headers, redirect: 'error', signal: controller.signal });
    return { reachable: true, ready: response.ok, status: response.status };
  } catch {
    return { reachable: false, ready: false };
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForCouchDb(origin, attempts = 40) {
  let readiness = { reachable: false, ready: false };
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    readiness = await couchDbReadiness(origin);
    if (readiness.ready || readiness.status === 401 || readiness.status === 403) return readiness;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return readiness;
}

function assertCouchDbReadiness(readiness, origin) {
  if (readiness.ready) return;
  if (readiness.status === 401 || readiness.status === 403) {
    throw new Error(
      `CouchDB at ${origin} rejected COUCHDB_USERNAME/COUCHDB_PASSWORD (HTTP ${readiness.status}). Update those values in .env to match the running service.`,
    );
  }
  if (readiness.reachable) throw new Error(`CouchDB readiness check at ${origin}/_up returned HTTP ${readiness.status}.`);
  throw new Error(`CouchDB is unavailable at ${origin}. Start the configured CouchDB service before running UTMS.`);
}

async function assertDevelopmentPortsAvailable() {
  const ports = [
    { name: 'web', host: 'localhost', port: positivePort(process.env.WEB_PORT, 5173) },
    { name: 'API', host: '127.0.0.1', port: positivePort(process.env.API_CONSOLE_PORT, 4174) },
  ];
  const checks = await Promise.all(ports.map(async service => ({
    ...service,
    occupied: await canConnect(service),
  })));
  const occupied = checks.filter(service => service.occupied);
  if (!occupied.length) return;
  const labels = occupied.map(service => `${service.name} port ${service.port}`).join(', ');
  throw new Error(
    `${labels} ${occupied.length === 1 ? 'is' : 'are'} already in use. UTMS may already be running; stop the previous dev:all process before starting another one.`,
  );
}

async function prepareRedis() {
  const requestedUrl = configuredRedisUrl();
  const requestedAddress = redisAddress(requestedUrl);
  if (await canConnect(requestedAddress)) {
    console.log(`[dev:all] Using Redis at ${requestedAddress.label}.`);
    return requestedUrl;
  }

  if (process.env.REDIS_URL || process.env.UTMS_DEV_REDIS === 'external') {
    throw new Error(
      `Redis is unavailable at ${requestedAddress.label}. Start the configured Redis service or unset REDIS_URL to use the embedded development server.`,
    );
  }

  try {
    embeddedRedis = new RedisMemoryServer({
      binary: {
        // Memurai cannot resolve its developer license from a path containing
        // non-ASCII characters, so keep its downloaded runtime in Windows temp.
        downloadDir: path.join(tmpdir(), 'utms-redis-memory-server'),
      },
      instance: {
        ip: '127.0.0.1',
        port: requestedAddress.port,
        args: ['--maxmemory', process.env.UTMS_DEV_REDIS_MAXMEMORY || '64mb', '--maxmemory-policy', 'noeviction'],
      },
    });
    const host = await embeddedRedis.getHost();
    const port = await embeddedRedis.getPort();
    const embeddedUrl = `redis://${host}:${port}`;
    console.log(`[dev:all] Started an ephemeral local Redis server at redis://${host}:${port}.`);
    return embeddedUrl;
  } catch (embeddedError) {
    if (embeddedRedis) await embeddedRedis.stop().catch(() => {});
    embeddedRedis = undefined;
    console.warn(`[dev:all] Embedded Redis could not start: ${errorMessage(embeddedError)}`);
  }

  console.log('[dev:all] Starting the local Compose redis service instead.');
  startComposeService('redis');
  if (!(await waitForAddress(requestedAddress))) {
    throw new Error(`The local Redis container did not become reachable at ${requestedAddress.label}. Check "docker compose logs redis".`);
  }
  const password = process.env.REDIS_PASSWORD || 'utms-redis-development';
  const composeUrl = `redis://:${encodeURIComponent(password)}@127.0.0.1:${requestedAddress.port}`;
  console.log(`[dev:all] Started Redis at ${requestedAddress.label}.`);
  return composeUrl;
}

async function prepareCouchDb() {
  const requestedUrl = configuredCouchDbUrl();
  let parsed;
  try {
    parsed = new URL(requestedUrl);
  } catch {
    throw new Error('COUCHDB_URL must be a valid http:// or https:// URL.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('COUCHDB_URL must use http:// or https://.');
  const address = {
    host: parsed.hostname || '127.0.0.1',
    port: positivePort(parsed.port, parsed.protocol === 'https:' ? 443 : 80),
  };
  if (await canConnect(address)) {
    assertCouchDbReadiness(await couchDbReadiness(parsed.origin), parsed.origin);
    console.log(`[dev:all] Using CouchDB at ${parsed.origin}.`);
    return requestedUrl;
  }
  if (process.env.COUCHDB_URL || process.env.UTMS_DEV_COUCHDB === 'external') {
    throw new Error(`CouchDB is unavailable at ${parsed.origin}. Start the configured CouchDB service before running UTMS.`);
  }
  if (process.env.UTMS_DEV_COUCHDB === 'optional') {
    console.warn(`[dev:all] CouchDB is unavailable at ${parsed.origin}; Playwright file storage will return COUCHDB_UNAVAILABLE.`);
    return requestedUrl;
  }
  console.log('[dev:all] CouchDB is not running; starting the local Compose couchdb service.');
  try {
    startComposeService('couchdb');
  } catch (error) {
    throw new Error(`CouchDB could not be started. ${errorMessage(error)}`);
  }
  if (await waitForAddress(address)) {
    assertCouchDbReadiness(await waitForCouchDb(parsed.origin), parsed.origin);
    console.log(`[dev:all] Started CouchDB at ${parsed.origin}.`);
    return requestedUrl;
  }
  throw new Error(`The local CouchDB container did not become reachable at ${parsed.origin}. Check "docker compose logs couchdb".`);
}

async function prepareObjectStorage() {
  const endpoint = configuredS3Endpoint();
  let parsed;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new Error('S3_ENDPOINT must be a valid http:// or https:// URL.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('S3_ENDPOINT must use http:// or https://.');
  const address = {
    host: parsed.hostname || '127.0.0.1',
    port: positivePort(parsed.port, parsed.protocol === 'https:' ? 443 : 80),
  };
  if (!(await canConnect(address))) {
    if (process.env.S3_ENDPOINT || process.env.UTMS_DEV_OBJECT_STORAGE === 'external') {
      throw new Error(`Object storage is unavailable at ${parsed.origin}. Start the configured S3-compatible service.`);
    }
    console.log('[dev:all] MinIO is not running; starting the local Compose minio service.');
    startComposeService('minio');
    if (!(await waitForAddress(address))) {
      throw new Error(`MinIO could not become reachable at ${parsed.origin}. Check "docker compose logs minio".`);
    }
  } else {
    console.log(`[dev:all] Using object storage at ${parsed.origin}.`);
  }

  startComposeService('minio-init');
  const bucket = process.env.S3_BUCKET || 'utms-private';
  const client = new S3Client({
    region: process.env.S3_REGION || 'us-east-1',
    endpoint,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || 'utms-minio',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || 'utms-minio-development',
    },
  });
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
      client.destroy();
      console.log(`[dev:all] Object storage bucket ${bucket} is ready.`);
      return endpoint;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  client.destroy();
  throw new Error(`Object storage bucket ${bucket} was not initialized.`);
}

function npmInvocation(script) {
  const npmCli = process.env.npm_execpath;
  if (npmCli && npmCli.endsWith('.js')) return [process.execPath, [npmCli, 'run', script]];
  if (process.platform === 'win32') {
    const installedNpmCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
    if (existsSync(installedNpmCli)) return [process.execPath, [installedNpmCli, 'run', script]];
  }
  return [process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', script]];
}

function startService(name, redisUrl, couchdbUrl, s3Endpoint) {
  const [command, args] = npmInvocation(name);
  const child = spawn(command, args, {
    cwd: repositoryRoot,
    env: { ...process.env, REDIS_URL: redisUrl, COUCHDB_URL: couchdbUrl, S3_ENDPOINT: s3Endpoint },
    stdio: 'inherit',
    shell: false,
  });
  children.set(name, child);
  child.once('error', error => {
    console.error(`[dev:all] ${name} could not start: ${error.message}`);
    void shutdown(1);
  });
  child.once('exit', (code, signal) => {
    children.delete(name);
    if (!stopping) {
      console.error(`[dev:all] ${name} exited unexpectedly (${signal || code || 0}).`);
      void shutdown(code || 1);
    }
  });
}

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === 'win32') {
    await new Promise(resolve => {
      const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
      killer.once('error', resolve);
      killer.once('exit', resolve);
    });
    return;
  }
  child.kill('SIGTERM');
  await new Promise(resolve => {
    const timeout = setTimeout(resolve, 3000);
    child.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function shutdown(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  await Promise.allSettled([...children.values()].map(stopChild));
  if (embeddedRedis) await embeddedRedis.stop().catch(() => {});
  process.exit(exitCode);
}

async function main() {
  await assertDevelopmentPortsAvailable();
  const redisUrl = await prepareRedis();
  const couchdbUrl = await prepareCouchDb();
  const s3Endpoint = await prepareObjectStorage();
  for (const name of ['dev:web', 'dev:api', 'dev:worker', 'dev:runner']) startService(name, redisUrl, couchdbUrl, s3Endpoint);
}

process.once('SIGINT', () => void shutdown(0));
process.once('SIGTERM', () => void shutdown(0));
process.once('SIGHUP', () => void shutdown(0));

main().catch(error => {
  console.error(`[dev:all] Startup failed: ${errorMessage(error)}`);
  void shutdown(1);
});
