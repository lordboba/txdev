import 'server-only';

import { createClient } from 'redis';

type RedisClient = ReturnType<typeof createClient>;

const USER_COUNT_KEY = 'user-count';

const globalForUserCount = globalThis as typeof globalThis & {
  __userCountRedisPromise?: Promise<RedisClient | null>;
};

function normalizeCount(value: number | string | null) {
  if (value === null) {
    return null;
  }

  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

async function getRedisClient() {
  if (globalForUserCount.__userCountRedisPromise) {
    return globalForUserCount.__userCountRedisPromise;
  }

  globalForUserCount.__userCountRedisPromise = (async () => {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      return null;
    }

    const client = createClient({ url: redisUrl });
    client.on('error', () => {});

    try {
      await client.connect();
      return client;
    } catch {
      return null;
    }
  })();

  return globalForUserCount.__userCountRedisPromise;
}

export async function getVisitorCount() {
  const redis = await getRedisClient();
  if (!redis) {
    return null;
  }

  const count = await redis.get(USER_COUNT_KEY);
  return normalizeCount(count);
}

export async function incrementVisitorCount() {
  const redis = await getRedisClient();
  if (!redis) {
    return null;
  }

  const count = await redis.incr(USER_COUNT_KEY);
  return normalizeCount(count);
}
