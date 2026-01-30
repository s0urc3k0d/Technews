// ===========================================
// Plugin Redis pour Fastify
// ===========================================

import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { Redis } from 'ioredis';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
    cache: {
      get: <T>(key: string) => Promise<T | null>;
      set: (key: string, value: unknown, ttlSeconds?: number) => Promise<void>;
      del: (key: string) => Promise<void>;
      exists: (key: string) => Promise<boolean>;
    };
  }
}

const redisPlugin: FastifyPluginAsync = async (fastify) => {
  const redis = new Redis(fastify.config.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => {
      if (times > 3) return null;
      return Math.min(times * 100, 3000);
    },
  });

  redis.on('error', (err: Error) => {
    console.error('Redis connection error:', err);
  });

  redis.on('connect', () => {
    console.log('✅ Redis connected');
  });

  // Cache helper methods
  const cache = {
    get: async <T>(key: string): Promise<T | null> => {
      const data = await redis.get(key);
      if (!data) return null;
      try {
        return JSON.parse(data) as T;
      } catch {
        return data as T;
      }
    },

    set: async (key: string, value: unknown, ttlSeconds = 3600): Promise<void> => {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      await redis.setex(key, ttlSeconds, serialized);
    },

    del: async (key: string): Promise<void> => {
      await redis.del(key);
    },

    exists: async (key: string): Promise<boolean> => {
      const result = await redis.exists(key);
      return result === 1;
    },
  };

  fastify.decorate('redis', redis);
  fastify.decorate('cache', cache);

  fastify.addHook('onClose', async () => {
    await redis.quit();
  });
};

export default fp(redisPlugin, {
  name: 'redis',
});
