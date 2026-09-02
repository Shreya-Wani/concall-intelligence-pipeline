import Redis from 'ioredis';
import { env } from '../config/env';

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  retryStrategy() {
    return 1000;
  },
});

redis.on('error', () => {
  // Suppress error logging during offline checks
});

export async function checkRedisHealth(): Promise<boolean> {
  try {
    if (redis.status !== 'ready' && redis.status !== 'connecting') {
      await redis.connect().catch(() => {});
    }
    const ping = await redis.ping();
    return ping === 'PONG';
  } catch (_error) {
    return false;
  }
}
