const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const SNAPSHOT_QUEUE = 'utms-playwright-snapshots';
const RUN_QUEUE = 'utms-playwright-runs';
let connection;
let snapshotQueue;
let runQueue;

function redisConnection() {
  if (!connection) connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', { maxRetriesPerRequest: null });
  return connection;
}

function queues() {
  snapshotQueue ||= new Queue(SNAPSHOT_QUEUE, { connection: redisConnection() });
  runQueue ||= new Queue(RUN_QUEUE, { connection: redisConnection() });
  return { snapshotQueue, runQueue };
}

async function enqueueSnapshot(snapshotId, runId) {
  return queues().snapshotQueue.add('materialize', { snapshotId, runId }, {
    jobId: `snapshot-${snapshotId}`,
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 200,
    removeOnFail: 500,
  });
}

async function enqueueRun(runId, snapshotId) {
  return queues().runQueue.add('execute', { runId, snapshotId }, {
    jobId: `run-${runId}`,
    attempts: 1,
    removeOnComplete: 200,
    removeOnFail: 500,
  });
}

async function cancelQueuedRun(runId, snapshotId) {
  const { snapshotQueue: snapshots, runQueue: runs } = queues();
  for (const job of [await snapshots.getJob(`snapshot-${snapshotId}`), await runs.getJob(`run-${runId}`)]) {
    if (job && ['waiting', 'delayed', 'paused'].includes(await job.getState())) await job.remove();
  }
  await redisConnection().set(`utms:playwright:cancel:${runId}`, '1', 'EX', 3600);
}

module.exports = {
  RUN_QUEUE,
  SNAPSHOT_QUEUE,
  cancelQueuedRun,
  enqueueRun,
  enqueueSnapshot,
  redisConnection,
};
