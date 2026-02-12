import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import fastifyMultipart from '@fastify/multipart';
import * as path from 'path';

// Plugins
import configPlugin from './plugins/config.js';
import prismaPlugin from './plugins/prisma.js';
import redisPlugin from './plugins/redis.js';
import authPlugin from './plugins/auth.js';

// Routes
import {
  articlesRoutes,
  categoriesRoutes,
  tagsRoutes,
  commentsRoutes,
  newsletterRoutes,
  imagesRoutes,
  adminRoutes,
  metricsRoutes,
  trackResponseTime,
  socialRoutes,
  shortsRoutes,
} from './routes/index.js';

// Cron jobs
import { setupCronJobs } from './cron/index.js';

const envToLogger = {
  development: {
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  },
  production: true,
  test: false,
};

const environment = (process.env.NODE_ENV || 'development') as keyof typeof envToLogger;

const fastify = Fastify({
  logger: envToLogger[environment] ?? true,
  pluginTimeout: 60000,
});

async function buildServer() {
  // Register plugins in order
  await fastify.register(configPlugin);
  await fastify.register(prismaPlugin);
  await fastify.register(redisPlugin);
  await fastify.register(authPlugin);

  // Security headers
  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        scriptSrc: ["'self'"],
      },
    },
  });

  // CORS
  await fastify.register(cors, {
    origin: [
      fastify.config.NEXT_PUBLIC_SITE_URL,
      'http://localhost:3000',
    ],
    credentials: true,
  });

  // Rate limiting global
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // File uploads
  await fastify.register(fastifyMultipart, {
    limits: {
      fileSize: parseInt(fastify.config.UPLOAD_MAX_SIZE_MB) * 1024 * 1024,
    },
  });

  // Static files (uploads)
  await fastify.register(fastifyStatic, {
    root: fastify.config.UPLOAD_PATH,
    prefix: '/uploads/',
    decorateReply: false,
  });

  // Track response times for metrics
  trackResponseTime(fastify);

  // Health check
  fastify.get('/health', async () => {
    return { 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });

  // API v1 info
  fastify.get('/api/v1', async () => {
    return { 
      message: 'RevueTech API v1',
      version: '1.0.0',
      endpoints: [
        '/api/v1/articles',
        '/api/v1/categories',
        '/api/v1/tags',
        '/api/v1/comments',
        '/api/v1/newsletter',
        '/api/v1/images',
        '/api/v1/admin',
        '/api/v1/social',
        '/api/v1/shorts',
        '/metrics',
      ],
    };
  });

  // Register API routes
  await fastify.register(articlesRoutes, { prefix: '/api/v1/articles' });
  await fastify.register(categoriesRoutes, { prefix: '/api/v1/categories' });
  await fastify.register(tagsRoutes, { prefix: '/api/v1/tags' });
  await fastify.register(commentsRoutes, { prefix: '/api/v1/comments' });
  await fastify.register(newsletterRoutes, { prefix: '/api/v1/newsletter' });
  await fastify.register(imagesRoutes, { prefix: '/api/v1/images' });
  await fastify.register(adminRoutes, { prefix: '/api/v1/admin' });
  await fastify.register(socialRoutes, { prefix: '/api/v1/social' });
  await fastify.register(shortsRoutes, { prefix: '/api/v1/shorts' });
  await fastify.register(metricsRoutes, { prefix: '/metrics' });

  return fastify;
}

async function start() {
  try {
    const server = await buildServer();
    const port = parseInt(server.config.PORT, 10);
    const host = server.config.HOST;

    // Setup cron jobs (single instance recommended in production)
    if (server.config.ENABLE_CRON === 'true') {
      setupCronJobs({
        prisma: server.prisma,
        rssUrl: server.config.RSS_FEED_URL,
        mistralApiKey: server.config.MISTRAL_API_KEY,
        resendApiKey: server.config.RESEND_API_KEY,
        resendFromEmail: server.config.RESEND_FROM_EMAIL,
        siteUrl: server.config.NEXT_PUBLIC_SITE_URL,
        shortsDir: server.config.SHORTS_DIR,
      });
      server.log.info('✅ Cron jobs enabled');
    } else {
      server.log.info('ℹ️ Cron jobs disabled (ENABLE_CRON=false)');
    }

    await server.listen({ port, host });
    console.log(`🚀 Server running at http://${host}:${port}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

start();
