import { createClient } from 'redis';

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error('REDIS_URL is not set');
}
const redis = await createClient({ url: redisUrl }).connect();

const userCountKey = 'user-count';

async function incrementCount(): Promise<number | null> {
  const count = (await redis.incr(userCountKey)) as number;
  return count ?? null;
}

async function getCount(): Promise<number | null> {
  const count = (await redis.get(userCountKey)) as number | null;
  return count ?? null;
}

export async function POST() {
  const result: number | null = await incrementCount();
  if (result === null) {
    return Response.json(
      { error: 'Unable to increment count', count: null },
      { status: 503 },
    );
  }

  return Response.json({ count: result });
}

export async function GET() {
  const result = await getCount();
  if (result === null) {
    return Response.json(
      { error: 'Unable to get count', count: null },
      { status: 503 },
    );
  }
  return Response.json({ count: result });
}
