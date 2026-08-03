const { randomUUID } = require('crypto');
const Redis = require('ioredis');

const memoryLocks = new Set();
let redis;

function getRedis() {
  if (redis) return redis;
  redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 1500,
  });
  redis.on('error', () => undefined);
  return redis;
}

async function acquireMemory(key) {
  if (memoryLocks.has(key)) return null;
  memoryLocks.add(key);
  return async () => memoryLocks.delete(key);
}

async function acquireCdeWriteLock(key, ttlMs = 30_000) {
  const name = `utms:cde-write-lock:${key}`;
  const token = randomUUID();
  try {
    const client = getRedis();
    if (client.status === 'wait') await client.connect();
    const acquired = await client.set(name, token, 'PX', ttlMs, 'NX');
    if (acquired !== 'OK') return null;
    return async () => {
      await client.eval(
        "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
        1,
        name,
        token
      ).catch(() => undefined);
    };
  } catch (error) {
    if (process.env.NODE_ENV === 'production') throw error;
    return acquireMemory(name);
  }
}

module.exports = { acquireCdeWriteLock };
