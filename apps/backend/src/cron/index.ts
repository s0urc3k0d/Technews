// ===========================================
// Cron Jobs (RSS Parser, Newsletter)
// ===========================================

import * as cron from 'node-cron';
import { PrismaClient } from '@technews/database';
import { createRSSParserService, DEFAULT_RSS_FEED_URL } from '../services/rss.service.js';
import { createNewsletterAIService } from '../services/newsletter-ai.service.js';
import { createEmailService } from '../services/email.service.js';

interface CronConfig {
  prisma: PrismaClient;
  rssUrl?: string;
  mistralApiKey?: string;
  resendApiKey?: string;
  resendFromEmail?: string;
  siteUrl: string;
}

export const setupCronJobs = (config: CronConfig) => {
  const { prisma, mistralApiKey, resendApiKey, resendFromEmail, siteUrl } = config;
  
  // Utiliser l'URL TechPulse par défaut si non spécifiée
  const rssUrl = config.rssUrl || DEFAULT_RSS_FEED_URL;

  // RSS Parser - Toutes les 2 heures (pour récupérer les news fraîches)
  cron.schedule('0 */2 * * *', async () => {
    console.log('[CRON] Starting RSS parser (TechPulse)...');
    const rssService = createRSSParserService(prisma, rssUrl);

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
        }
      }
    });

    console.log('📬 Newsletter sender cron job scheduled (every 5 minutes)');
  }
};
