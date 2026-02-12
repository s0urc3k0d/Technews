// ===========================================
// Plugin Prisma pour Fastify
// ===========================================

import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

const prismaPlugin: FastifyPluginAsync = async (fastify) => {
  const prisma = new PrismaClient({
    log: fastify.config.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn'] 
      : ['error'],
  });

  const maxAttempts = 10;
  const retryDelayMs = 3000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await prisma.$connect();
      fastify.log.info('✅ Prisma connected');
      break;
    } catch (error) {
      const isLastAttempt = attempt === maxAttempts;

      fastify.log.error(
        { err: error, attempt, maxAttempts },
        '❌ Prisma connection failed'
      );

      if (isLastAttempt) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  fastify.decorate('prisma', prisma);

  fastify.addHook('onClose', async (instance) => {
    await instance.prisma.$disconnect();
  });
};

export default fp(prismaPlugin, {
  name: 'prisma',
});
