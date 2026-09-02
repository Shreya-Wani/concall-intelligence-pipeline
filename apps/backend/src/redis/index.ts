import Redis from 'ioredis';
import { env } from '../config/env';

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  retryStrategy(times) {
    if (times > 3) return null;
    return Math.min(times * 100, 2000);
  },
});

redis.on('error', (err) => {
  console.error('Redis client error:', err.message);
});

export async function checkRedisHealth(): Promise<boolean> {
  try {
    if (redis.status !== 'ready' && redis.status !== 'connecting') {
      await redis.connect();
    }
    const ping = await redis.ping();
    return ping === 'PONG';
  } catch (error) {
    console.error('Redis health check failed:', error);
    return false;
  }
}
