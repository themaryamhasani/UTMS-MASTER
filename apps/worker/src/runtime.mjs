import { Worker } from 'bullmq';
import IORedis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const apiBaseUrl = String(process.env.UTMS_API_BASE_URL || 'http://127.0.0.1:4174').replace(/\/$/, '');
const jobToken = process.env.UTMS_INTERNAL_JOB_TOKEN || (process.env.NODE_ENV === 'production' ? '' : 'utms-development-jobs');

if (!jobToken) throw new Error('UTMS_INTERNAL_JOB_TOKEN is required in production.');

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
    throw new Error(`Snapshot worker cannot reach Redis at ${redisLabel(redisUrl)}. Start Redis or run npm run dev:all.`, { cause: error });
  }
}

const connection = await connectRedis();

async function internalPost(path) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    headers: { 'x-utms-job-token': jobToken, accept: 'application/json' },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error?.message || `UTMS internal API returned HTTP ${response.status}.`);
    error.code = payload?.error?.category || 'INTERNAL_JOB_FAILED';
    throw error;
  }
  return payload;
}

const worker = new Worker('utms-playwright-snapshots', async job => {
  if (job.name !== 'materialize' || !job.data?.snapshotId) throw new Error('Invalid snapshot job.');
  return internalPost(`/api/internal/playwright/snapshots/${encodeURIComponent(job.data.snapshotId)}/materialize`);
}, {
  connection,
  concurrency: Math.max(1, Math.min(4, Number(process.env.SNAPSHOT_WORKER_CONCURRENCY || 2))),
  lockDuration: 120_000,
});

worker.on('failed', (job, error) => {
  console.error(JSON.stringify({ event: 'snapshot-job-failed', jobId: job?.id, code: error.code || 'ERROR', message: error.message }));
});
worker.on('error', error => {
  console.error(JSON.stringify({ event: 'snapshot-worker-error', message: error.message }));
});

const cleanup = setInterval(() => {
  internalPost('/api/internal/playwright/snapshots/purge').catch(error => {
    console.error(JSON.stringify({ event: 'snapshot-purge-failed', message: error.message }));
  });
}, Math.max(60_000, Number(process.env.SNAPSHOT_PURGE_INTERVAL_MS || 15 * 60_000)));
cleanup.unref();

async function shutdown() {
  clearInterval(cleanup);
  await worker.close();
  await connection.quit();
  process.exit(0);
}

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
console.log(JSON.stringify({ event: 'worker-ready', queue: 'utms-playwright-snapshots' }));
