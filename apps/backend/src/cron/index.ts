// ===========================================
// Cron Jobs (RSS Parser, Newsletter, Shorts)
// ===========================================

import * as cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { createRSSParserService, DEFAULT_RSS_FEED_URL } from '../services/rss.service.js';
import { createNewsletterAIService } from '../services/newsletter-ai.service.js';
import { createEmailService } from '../services/email.service.js';
import { createShortsService } from '../services/shorts.service.js';
import * as path from 'path';

interface CronConfig {
  prisma: PrismaClient;
  rssUrl?: string;
  rssMaxAgeDays?: number;
  mistralApiKey?: string;
  resendApiKey?: string;
  resendFromEmail?: string;
  discordWebhookUrl?: string;
  siteUrl: string;
  shortsDir?: string;
}

const sendDiscordWebhook = async (
  webhookUrl: string | undefined,
  title: string,
  description: string,
  color: number = 0x0ea5e9
) => {
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [
          {
            title,
            description,
            color,
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });
  } catch (err) {
    console.error('[CRON] Discord webhook error:', err);
  }
};

export const setupCronJobs = (config: CronConfig) => {
  const { prisma, mistralApiKey, resendApiKey, resendFromEmail, discordWebhookUrl, siteUrl, shortsDir } = config;
  
  // Utiliser l'URL TechPulse par défaut si non spécifiée
  const rssUrl = config.rssUrl || DEFAULT_RSS_FEED_URL;
  const rssMaxAgeDays = config.rssMaxAgeDays ?? 10;

  // RSS Parser - Toutes les 2 heures (pour récupérer les news fraîches)
  cron.schedule('0 */2 * * *', async () => {
    console.log('[CRON] Starting RSS parser (TechPulse)...');
    const rssService = createRSSParserService(prisma, rssUrl, rssMaxAgeDays);

    const log = await prisma.cronJobLog.create({
      data: {
        jobName: 'rss-parser',
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    try {
      const result = await rssService.parseFeed();

      await prisma.cronJobLog.update({
        where: { id: log.id },
        data: {
          status: result.success ? 'SUCCESS' : 'FAILED',
          completedAt: new Date(),
          duration: Date.now() - log.startedAt.getTime(),
          message: `Imported ${result.imported}, updated ${result.updated}, skipped ${result.skipped}`,
          details: result as object,
        },
      });

      console.log('[CRON] RSS parser completed:', result);

      // Send admin notification if new articles imported
      if (result.imported > 0 && resendApiKey) {
        const emailService = createEmailService(resendApiKey, resendFromEmail, siteUrl);
        await emailService.sendAdminNotification(
          `${result.imported} nouveaux articles importés de TechPulse`,
          `Le parser RSS a importé ${result.imported} nouveaux articles depuis TechPulse.\n` +
          `${result.updated} articles mis à jour, ${result.skipped} ignorés.\n\n` +
          `Connectez-vous à l'admin pour les valider et publier.`
        );
      }

      if (result.imported > 0) {
        await sendDiscordWebhook(
          discordWebhookUrl,
          'RSS import terminé',
          `${result.imported} nouveaux articles importés\n${result.updated} mis à jour • ${result.skipped} ignorés`
        );
      }
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
      console.error('[CRON] RSS parser failed:', err);
      await sendDiscordWebhook(
        discordWebhookUrl,
        'RSS import échoué',
        message,
        0xef4444
      );
    }
  });

  console.log(`📰 RSS Parser cron job scheduled (every 2 hours) - Source: ${rssUrl}`);

  // Newsletter Generation - Daily at 5:30 PM
  cron.schedule('30 17 * * *', async () => {
    console.log('[CRON] Starting newsletter generation...');
    const aiService = createNewsletterAIService(prisma, mistralApiKey, siteUrl);

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
            message: 'No articles to include',
          },
        });
        console.log('[CRON] Newsletter: No articles for today');
        return;
      }

      // Create newsletter (ready to send)
      const newsletter = await prisma.newsletter.create({
        data: {
          subject: content.subject,
          previewText: content.previewText,
          htmlContent: content.htmlContent,
          selectedArticles: content.selectedArticleIds,
          status: 'SCHEDULED',
          scheduledAt: new Date(Date.now() + 30 * 60 * 1000), // Send in 30 min
          aiGenerated: true,
        },
      });

      await prisma.cronJobLog.update({
        where: { id: log.id },
        data: {
          status: 'SUCCESS',
          completedAt: new Date(),
          duration: Date.now() - log.startedAt.getTime(),
          message: `Generated with ${content.selectedArticleIds.length} articles`,
          details: { newsletterId: newsletter.id },
        },
      });

      console.log('[CRON] Newsletter generated:', newsletter.id);
      await sendDiscordWebhook(
        discordWebhookUrl,
        'Newsletter générée',
        `Newsletter ${newsletter.id} planifiée avec ${content.selectedArticleIds.length} articles`
      );
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
      console.error('[CRON] Newsletter generation failed:', err);
      await sendDiscordWebhook(
        discordWebhookUrl,
        'Génération newsletter échouée',
        message,
        0xef4444
      );
    }
  });

  console.log('📧 Newsletter generation cron job scheduled (daily at 5:30 PM)');

  // Newsletter Sender - Check every 5 minutes for scheduled newsletters
  if (resendApiKey) {
    cron.schedule('*/5 * * * *', async () => {
      const scheduledNewsletters = await prisma.newsletter.findMany({
        where: {
          status: 'SCHEDULED',
          scheduledAt: { lte: new Date() },
        },
      });

      for (const newsletter of scheduledNewsletters) {
        console.log(`[CRON] Sending scheduled newsletter: ${newsletter.id}`);

        const log = await prisma.cronJobLog.create({
          data: {
            jobName: 'newsletter-send',
            status: 'RUNNING',
            startedAt: new Date(),
            details: { newsletterId: newsletter.id },
          },
        });

        try {
          const emailService = createEmailService(resendApiKey, resendFromEmail, siteUrl);

          // Get subscribers
          const subscribers = await prisma.subscriber.findMany({
            where: { isActive: true, isConfirmed: true },
          });

          await prisma.newsletter.update({
            where: { id: newsletter.id },
            data: { status: 'SENDING', totalRecipients: subscribers.length },
          });

          let successful = 0;
          let failed = 0;

          for (const subscriber of subscribers) {
            const result = await emailService.sendNewsletter(
              subscriber.email,
              subscriber.firstName,
              newsletter.subject,
              newsletter.htmlContent,
              subscriber.unsubscribeToken || '',
              newsletter.id
            );

            await prisma.newsletterRecipient.create({
              data: {
                newsletterId: newsletter.id,
                subscriberId: subscriber.id,
                resendId: result.id,
              },
            });

            if (result.success) successful++;
            else failed++;
          }

          await prisma.newsletter.update({
            where: { id: newsletter.id },
            data: { status: 'SENT', sentAt: new Date() },
          });

          await prisma.cronJobLog.update({
            where: { id: log.id },
            data: {
              status: 'SUCCESS',
              completedAt: new Date(),
              duration: Date.now() - log.startedAt.getTime(),
              message: `Sent to ${successful}/${subscribers.length} subscribers`,
            },
          });

          console.log(`[CRON] Newsletter sent: ${successful}/${subscribers.length}`);
          await sendDiscordWebhook(
            discordWebhookUrl,
            'Newsletter envoyée',
            `${successful}/${subscribers.length} emails envoyés (${newsletter.id})`
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';

          await prisma.newsletter.update({
            where: { id: newsletter.id },
            data: { status: 'FAILED' },
          });

          await prisma.cronJobLog.update({
            where: { id: log.id },
            data: {
              status: 'FAILED',
              completedAt: new Date(),
              duration: Date.now() - log.startedAt.getTime(),
              message,
            },
          });

          console.error('[CRON] Newsletter send failed:', err);
          await sendDiscordWebhook(
            discordWebhookUrl,
            'Envoi newsletter échoué',
            message,
            0xef4444
          );
        }
      }
    });

    console.log('📬 Newsletter sender cron job scheduled (every 5 minutes)');
  }

  // Shorts Video Generation - Daily at 10 PM
  if (mistralApiKey && shortsDir) {
    cron.schedule('0 22 * * *', async () => {
      console.log('[CRON] Starting daily shorts video generation...');

      const log = await prisma.cronJobLog.create({
        data: {
          jobName: 'shorts-generate',
          status: 'RUNNING',
          startedAt: new Date(),
        },
      });

      try {
        const shortsService = createShortsService(prisma, {
          mistralApiKey,
          shortsDir,
          backgroundsDir: path.join(shortsDir, 'backgrounds'),
          tempDir: path.join(shortsDir, 'temp'),
        });

        const result = await shortsService.generateDailyShort();

        if (result) {
          await prisma.cronJobLog.update({
            where: { id: log.id },
            data: {
              status: 'SUCCESS',
              completedAt: new Date(),
              duration: Date.now() - log.startedAt.getTime(),
              message: `Generated shorts video with ${result.slides.length} slides`,
            },
          });

          console.log(`[CRON] Shorts video generated: ${result.slides.length} slides, duration: ${result.duration}s`);
          await sendDiscordWebhook(
            discordWebhookUrl,
            'Short généré',
            `${result.slides.length} slides • durée ${result.duration}s`
          );
        } else {
          await prisma.cronJobLog.update({
            where: { id: log.id },
            data: {
              status: 'SUCCESS',
              completedAt: new Date(),
              duration: Date.now() - log.startedAt.getTime(),
              message: 'No articles available for shorts generation',
            },
          });
          console.log('[CRON] No articles available for shorts generation');
        }
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

        console.error('[CRON] Shorts generation failed:', err);
        await sendDiscordWebhook(
          discordWebhookUrl,
          'Génération short échouée',
          message,
          0xef4444
        );
      }
    });

    console.log('🎬 Shorts video cron job scheduled (daily at 10 PM)');
  }
};
