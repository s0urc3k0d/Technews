// ===========================================
// Routes API - Admin (Dashboard & Stats)
// ===========================================

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createRSSParserService, DEFAULT_RSS_FEED_URL } from '../services/rss.service.js';
import { createNewsletterAIService } from '../services/newsletter-ai.service.js';
import { createAutoPublishService } from '../services/auto-publish.service.js';
import {
  WEBHOOK_EVENTS,
  getWebhookSettings,
  saveWebhookSettings,
} from '../services/webhook.service.js';

const adminRoutes: FastifyPluginAsync = async (fastify) => {
  const { prisma, config } = fastify;

  // All admin routes require authentication
  fastify.addHook('preHandler', fastify.requireAdmin);

  // GET /admin/stats - Statistiques dashboard
  fastify.get('/stats', async (request, reply) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(today);
    thisWeek.setDate(thisWeek.getDate() - 7);
    const thisMonth = new Date(today);
    thisMonth.setMonth(thisMonth.getMonth() - 1);

    const [
      totalArticles,
      publishedArticles,
      draftArticles,
      totalComments,
      pendingComments,
      totalSubscribers,
      activeSubscribers,
      articlesToday,
      articlesThisWeek,
      articlesThisMonth,
      recentComments,
      topArticles,
    ] = await Promise.all([
      prisma.article.count(),
      prisma.article.count({ where: { status: 'PUBLISHED' } }),
      prisma.article.count({ where: { status: 'DRAFT' } }),
      prisma.comment.count(),
      prisma.comment.count({ where: { status: 'PENDING' } }),
      prisma.subscriber.count(),
      prisma.subscriber.count({ where: { isActive: true, isConfirmed: true } }),
      prisma.article.count({
        where: { createdAt: { gte: today } },
      }),
      prisma.article.count({
        where: { createdAt: { gte: thisWeek } },
      }),
      prisma.article.count({
        where: { createdAt: { gte: thisMonth } },
      }),
      prisma.comment.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          article: { select: { title: true, slug: true } },
        },
      }),
      prisma.article.findMany({
        where: { status: 'PUBLISHED' },
        take: 10,
        orderBy: { viewCount: 'desc' },
        select: {
          id: true,
          title: true,
          slug: true,
          viewCount: true,
          publishedAt: true,
        },
      }),
    ]);

    return reply.send({
      articles: {
        total: totalArticles,
        published: publishedArticles,
        draft: draftArticles,
        today: articlesToday,
        thisWeek: articlesThisWeek,
        thisMonth: articlesThisMonth,
      },
      comments: {
        total: totalComments,
        pending: pendingComments,
        recent: recentComments,
      },
      subscribers: {
        total: totalSubscribers,
        active: activeSubscribers,
      },
      topArticles,
    });
  });

  // GET /admin/rss/status - Voir le statut du flux RSS
  fastify.get('/rss/status', async (request, reply) => {
    const rssUrl = config.RSS_FEED_URL || DEFAULT_RSS_FEED_URL;
    
    // Récupérer les derniers logs RSS
    const recentLogs = await prisma.cronJobLog.findMany({
      where: { jobName: 'rss-parser' },
      orderBy: { startedAt: 'desc' },
      take: 10,
    });

    // Compter les articles importés par source
    const articlesBySource = await prisma.article.groupBy({
      by: ['sourceName'],
      where: { source: 'RSS' },
      _count: { id: true },
    });

    // Articles en brouillon (à valider)
    const draftFromRss = await prisma.article.count({
      where: { 
        source: 'RSS',
        status: 'DRAFT',
      },
    });

    return reply.send({
      feedUrl: rssUrl,
      isDefaultFeed: rssUrl === DEFAULT_RSS_FEED_URL,
      recentLogs,
      articlesBySource,
      pendingValidation: draftFromRss,
    });
  });

  // POST /admin/rss/parse - Déclencher le parser RSS manuellement
  fastify.post('/rss/parse', async (request, reply) => {
    // Utiliser l'URL configurée ou TechPulse par défaut
    const rssUrl = config.RSS_FEED_URL || DEFAULT_RSS_FEED_URL;
    
    const rssService = createRSSParserService(
      prisma,
      rssUrl,
      parseInt(config.RSS_MAX_AGE_DAYS, 10) || 10
    );
    
    // Log start
    const log = await prisma.cronJobLog.create({
      data: {
        jobName: 'rss-parser',
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    try {
      const result = await rssService.parseFeed();

      // Log success
      await prisma.cronJobLog.update({
        where: { id: log.id },
        data: {
          status: result.success ? 'SUCCESS' : 'FAILED',
          completedAt: new Date(),
          duration: Date.now() - log.startedAt.getTime(),
          message: result.success 
            ? `Imported ${result.imported}, updated ${result.updated}, skipped ${result.skipped}` 
            : result.errors.join(', '),
          details: result as object,
        },
      });

      return reply.send(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      
      await prisma.cronJobLog.update({
        where: { id: log.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          duration: Date.now() - log.startedAt.getTime(),
          message,
        },
      });

      return reply.code(500).send({ error: message });
    }
  });

  // POST /admin/newsletter/generate - Générer newsletter IA
  fastify.post('/newsletter/generate', async (request, reply) => {
    const aiService = createNewsletterAIService(
      prisma,
      config.MISTRAL_API_KEY,
      config.NEXT_PUBLIC_SITE_URL
    );

    // Log start
    const log = await prisma.cronJobLog.create({
      data: {
        jobName: 'newsletter-generate',
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    try {
      const content = await aiService.generateDailyNewsletter();

      if (!content) {
        await prisma.cronJobLog.update({
          where: { id: log.id },
          data: {
            status: 'SUCCESS',
            completedAt: new Date(),
            duration: Date.now() - log.startedAt.getTime(),
            message: 'No articles to include in newsletter',
          },
        });

        return reply.send({ message: 'No articles available for newsletter today' });
      }

      // Create newsletter draft
      const newsletter = await prisma.newsletter.create({
        data: {
          subject: content.subject,
          previewText: content.previewText,
          htmlContent: content.htmlContent,
          selectedArticles: content.selectedArticleIds,
          status: 'DRAFT',
          aiGenerated: true,
        },
      });

      await prisma.cronJobLog.update({
        where: { id: log.id },
        data: {
          status: 'SUCCESS',
          completedAt: new Date(),
          duration: Date.now() - log.startedAt.getTime(),
          message: `Generated newsletter with ${content.selectedArticleIds.length} articles`,
          details: { newsletterId: newsletter.id },
        },
      });

      return reply.send({
        message: 'Newsletter generated successfully',
        newsletter,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';

      await prisma.cronJobLog.update({
        where: { id: log.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          duration: Date.now() - log.startedAt.getTime(),
          message,
        },
      });

      return reply.code(500).send({ error: message });
    }
  });

  // POST /admin/auto-publish/run - Déclencher auto-publication IA manuellement
  fastify.post('/auto-publish/run', async (request, reply) => {
    const parseResult = z.object({
      dryRun: z.boolean().optional(),
    }).safeParse(request.body || {});

    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Invalid body', details: parseResult.error.issues });
    }

    const autoPublishService = createAutoPublishService({
      prisma,
      redis: fastify.redis,
      mistralApiKey: config.MISTRAL_API_KEY,
      uploadPath: config.UPLOAD_PATH,
      siteUrl: config.NEXT_PUBLIC_SITE_URL,
      lookbackHours: parseInt(config.AUTO_PUBLISH_LOOKBACK_HOURS, 10) || 3,
      intervalMinMinutes: parseInt(config.AUTO_PUBLISH_INTERVAL_MIN_MINUTES, 10) || 90,
      intervalMaxMinutes: parseInt(config.AUTO_PUBLISH_INTERVAL_MAX_MINUTES, 10) || 120,
      dryRun: parseResult.data.dryRun ?? (String(config.AUTO_PUBLISH_DRY_RUN).toLowerCase() === 'true'),
    });

    const log = await prisma.cronJobLog.create({
      data: {
        jobName: 'auto-publish-manual',
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    try {
      const result = await autoPublishService.run({
        ignoreCooldown: true,
        setCooldown: false,
      });

      await prisma.cronJobLog.update({
        where: { id: log.id },
        data: {
          status: result.success ? 'SUCCESS' : 'FAILED',
          completedAt: new Date(),
          duration: Date.now() - log.startedAt.getTime(),
          message: result.reason || result.status,
          details: result as object,
        },
      });

      return reply.send({ data: result });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';

      await prisma.cronJobLog.update({
        where: { id: log.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          duration: Date.now() - log.startedAt.getTime(),
          message,
        },
      });

      return reply.status(500).send({ error: message });
    }
  });

  // GET /admin/auto-publish/status - Voir la configuration active auto-publish
  fastify.get('/auto-publish/status', async (request, reply) => {
    const enabled = String(config.AUTO_PUBLISH_ENABLED).toLowerCase() === 'true';
    const dryRun = String(config.AUTO_PUBLISH_DRY_RUN).toLowerCase() === 'true';
    const lookbackHours = parseInt(config.AUTO_PUBLISH_LOOKBACK_HOURS, 10) || 3;
    const intervalMinMinutes = parseInt(config.AUTO_PUBLISH_INTERVAL_MIN_MINUTES, 10) || 90;
    const intervalMaxMinutes = parseInt(config.AUTO_PUBLISH_INTERVAL_MAX_MINUTES, 10) || 120;

    const cooldownValue = await fastify.redis.get('autopublish:next_allowed_at');
    const cooldownUntil = cooldownValue ? new Date(Number(cooldownValue)) : null;
    const hasValidCooldown = Boolean(cooldownUntil && !Number.isNaN(cooldownUntil.getTime()));

    return reply.send({
      data: {
        enabled,
        dryRun,
        lookbackHours,
        intervalMinMinutes,
        intervalMaxMinutes,
        cooldownUntil: hasValidCooldown ? cooldownUntil?.toISOString() : null,
        mistralConfigured: Boolean(config.MISTRAL_API_KEY),
      },
    });
  });

  // GET /admin/logs - Logs des cron jobs
  fastify.get<{ Querystring: { page?: number; limit?: number; jobName?: string } }>(
    '/logs',
    async (request, reply) => {
      const parseResult = z.object({
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().positive().max(100).default(20),
        jobName: z.string().optional(),
      }).safeParse(request.query);

      if (!parseResult.success) {
        return reply.code(400).send({ error: 'Invalid query parameters', details: parseResult.error.issues });
      }

      const { page, limit, jobName } = parseResult.data;
      const skip = (page - 1) * limit;

      const where: any = {};
      if (jobName) where.jobName = jobName;

      const [logs, total] = await Promise.all([
        prisma.cronJobLog.findMany({
          where,
          skip,
          take: limit,
          orderBy: { startedAt: 'desc' },
        }),
        prisma.cronJobLog.count({ where }),
      ]);

      return reply.send({
        data: logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    }
  );

  // GET /admin/webhooks - Webhook settings
  fastify.get('/webhooks', async (request, reply) => {
    const settings = await getWebhookSettings(fastify.redis, config.DISCORD_WEBHOOK_URL);
    return reply.send({
      data: settings,
      events: WEBHOOK_EVENTS,
    });
  });

  // PUT /admin/webhooks - Save webhook settings
  fastify.put('/webhooks', async (request, reply) => {
    const parseResult = z.object({
      enabled: z.boolean().default(false),
      url: z.string().url().or(z.literal('')).default(''),
      events: z.array(z.enum(WEBHOOK_EVENTS)).default([]),
    }).safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Invalid body', details: parseResult.error.issues });
    }

    const saved = await saveWebhookSettings(fastify.redis, parseResult.data);
    return reply.send({ data: saved });
  });

  // POST /admin/webhooks/test - Send test notification
  fastify.post('/webhooks/test', async (request, reply) => {
    const settings = await getWebhookSettings(fastify.redis, config.DISCORD_WEBHOOK_URL);
    if (!settings.enabled || !settings.url) {
      return reply.status(400).send({
        error: 'Webhook not sent',
        message: 'Vérifiez que le webhook est activé et qu’une URL est configurée.',
      });
    }

    try {
      await fetch(settings.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [
            {
              title: 'Test webhook Revue Tech',
              description: 'Ce message confirme que votre webhook Discord est opérationnel.',
              color: 0x22c55e,
              timestamp: new Date().toISOString(),
              footer: { text: 'Revue Tech • manual-test' },
            },
          ],
        }),
      });
    } catch {
      return reply.status(500).send({ error: 'Failed to send test webhook' });
    }

    return reply.send({ success: true, message: 'Notification de test envoyée.' });
  });
};

export default adminRoutes;
