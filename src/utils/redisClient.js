/**
 * Shared Redis client (rate limits, cache). Safe across Railway replicas.
 */

import Redis from 'ioredis';
import config from '../config/index.js';

const redis = new Redis(config.redis.url, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    return Math.min(times * 100, 3000);
  },
});

redis.on('error', (err) => {
  // Avoid crashing the process on transient Redis blips
  console.error('Redis error:', err?.message || err);
});

/** Ping Redis so startup fails loudly if rate-limit store is down. */
export async function ensureRedis() {
  await redis.ping();
  return redis;
}

export default redis;
