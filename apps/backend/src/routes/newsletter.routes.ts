// ===========================================
// Routes API - Newsletter
// ===========================================

import { FastifyPluginAsync } from 'fastify';
import { randomBytes } from 'crypto';
import {
  subscribeSchema,
  createNewsletterSchema,
  updateNewsletterSchema,
  listNewslettersQuerySchema,
  listSubscribersQuerySchema,
  SubscribeInput,
  CreateNewsletterInput,
  UpdateNewsletterInput,
  ListNewslettersQuery,
  ListSubscribersQuery,
} from '../schemas/index.js';
import { createEmailService } from '../services/email.service.js';

const newsletterRoutes: FastifyPluginAsync = async (fastify) => {
  const { prisma, config } = fastify;
  const emailService = createEmailService(
    config.RESEND_API_KEY,
    config.RESEND_FROM_EMAIL,
    config.NEXT_PUBLIC_SITE_URL
  );

  // ============================================
  // PUBLIC ROUTES
  // ============================================

  // POST /newsletter/subscribe - S'inscrire à la newsletter
  fastify.post(
    '/subscribe',
    {
      config: {
        rateLimit: { max: 5, timeWindow: '1 hour' },
      },
    },
    async (request, reply) => {
      const parseResult = subscribeSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({ error: 'Invalid body', details: parseResult.error.issues });
      }
      const { email, firstName, source } = parseResult.data;

      // Check if already subscribed
      const existing = await prisma.subscriber.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (existing) {
        if (existing.isConfirmed && existing.isActive) {
          return reply.send({ message: 'Already subscribed' });
        }

        // Resend confirmation if not confirmed
        if (!existing.isConfirmed) {
          const confirmToken = randomBytes(32).toString('hex');
          await prisma.subscriber.update({
            where: { id: existing.id },
            data: { confirmToken },
          });

          await emailService.sendSubscriptionConfirmation(
            email,
            firstName || existing.firstName,
            confirmToken
          );

          return reply.send({ message: 'Confirmation email resent' });
        }

        // Reactivate if unsubscribed
        if (!existing.isActive) {
          const confirmToken = randomBytes(32).toString('hex');
          await prisma.subscriber.update({
            where: { id: existing.id },
            data: {
              isActive: true,
              isConfirmed: false,
              confirmToken,
              unsubscribedAt: null,
              firstName: firstName || existing.firstName,
            },
          });

          await emailService.sendSubscriptionConfirmation(email, firstName ?? null, confirmToken);

          return reply.send({ message: 'Please confirm your subscription' });
        }
      }

      // Create new subscriber
      const confirmToken = randomBytes(32).toString('hex');
      const unsubscribeToken = randomBytes(32).toString('hex');

      await prisma.subscriber.create({
        data: {
          email: email.toLowerCase(),
          firstName,
          source,
          confirmToken,
          unsubscribeToken,
        },
      });

      // Send confirmation email
      await emailService.sendSubscriptionConfirmation(email, firstName || null, confirmToken);

      return reply.code(201).send({ 
        message: 'Please check your email to confirm your subscription' 
      });
    }
  );

  // GET /newsletter/confirm - Confirmer inscription
  fastify.get<{ Querystring: { token: string } }>(
    '/confirm',
    async (request, reply) => {
      const { token } = request.query;

      if (!token) {
        return reply.code(400).send({ error: 'Missing confirmation token' });
      }

      const subscriber = await prisma.subscriber.findUnique({
        where: { confirmToken: token },
      });

      if (!subscriber) {
        return reply.code(404).send({ error: 'Invalid or expired token' });
      }

      await prisma.subscriber.update({
        where: { id: subscriber.id },
        data: {
          isConfirmed: true,
          confirmedAt: new Date(),
          confirmToken: null,
        },
      });

      return reply.send({ message: 'Subscription confirmed successfully!' });
    }
  );

  // GET /newsletter/unsubscribe - Se désinscrire
  fastify.get<{ Querystring: { token: string } }>(
    '/unsubscribe',
    async (request, reply) => {
      const { token } = request.query;

      if (!token) {
        return reply.code(400).send({ error: 'Missing unsubscribe token' });
      }

      const subscriber = await prisma.subscriber.findUnique({
        where: { unsubscribeToken: token },
      });

      if (!subscriber) {
        return reply.code(404).send({ error: 'Invalid token' });
      }

      await prisma.subscriber.update({
        where: { id: subscriber.id },
        data: {
          isActive: false,
          unsubscribedAt: new Date(),
        },
      });

      return reply.send({ message: 'You have been unsubscribed successfully' });
    }
  );

  // ============================================
  // ADMIN ROUTES
  // ============================================

  // GET /newsletter/subscribers - Liste des abonnés (admin)
  fastify.get(
    '/subscribers',
    { preHandler: [fastify.requireAdmin] },
    async (request, reply) => {
      const parseResult = listSubscribersQuerySchema.safeParse(request.query);
      if (!parseResult.success) {
        return reply.status(400).send({ error: 'Invalid query parameters', details: parseResult.error.issues });
      }
      const { page, limit, isActive, isConfirmed, search } = parseResult.data;
      const skip = (page - 1) * limit;

      const where: any = {};
      if (isActive !== undefined) where.isActive = isActive;
      if (isConfirmed !== undefined) where.isConfirmed = isConfirmed;
      if (search) {
        where.OR = [
          { email: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [subscribers, total] = await Promise.all([
        prisma.subscriber.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            email: true,
            firstName: true,
            isConfirmed: true,
            isActive: true,
            source: true,
            createdAt: true,
            confirmedAt: true,
            unsubscribedAt: true,
          },
        }),
        prisma.subscriber.count({ where }),
      ]);

      // Stats
      const stats = await prisma.subscriber.aggregate({
        where: { isActive: true, isConfirmed: true },
        _count: true,
      });

      return reply.send({
        data: subscribers,
        stats: {
          activeSubscribers: stats._count,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    }
  );

  // GET /newsletter/newsletters - Liste des newsletters (admin)
  fastify.get(
    '/newsletters',
    { preHandler: [fastify.requireAdmin] },
    async (request, reply) => {
      const parseResult = listNewslettersQuerySchema.safeParse(request.query);
      if (!parseResult.success) {
        return reply.status(400).send({ error: 'Invalid query parameters', details: parseResult.error.issues });
      }
      const { page, limit, status } = parseResult.data;
      const skip = (page - 1) * limit;

      const where: any = {};
      if (status) where.status = status;

      const [newsletters, total] = await Promise.all([
        prisma.newsletter.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.newsletter.count({ where }),
      ]);

      return reply.send({
        data: newsletters,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    }
  );

  // POST /newsletter/newsletters - Créer newsletter (admin)
  fastify.post(
    '/newsletters',
    { preHandler: [fastify.requireAdmin] },
    async (request, reply) => {
      const parseResult = createNewsletterSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({ error: 'Invalid body', details: parseResult.error.issues });
      }
      const data = parseResult.data;

      const newsletter = await prisma.newsletter.create({
        data: {
          ...data,
          status: data.scheduledAt ? 'SCHEDULED' : 'DRAFT',
          scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        },
      });

      return reply.code(201).send(newsletter);
    }
  );

  // PUT /newsletter/newsletters/:id - Modifier newsletter (admin)
  fastify.put<{ Params: { id: string } }>(
    '/newsletters/:id',
    { preHandler: [fastify.requireAdmin] },
    async (request, reply) => {
      const { id } = request.params;
      const parseResult = updateNewsletterSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({ error: 'Invalid body', details: parseResult.error.issues });
      }
      const data = parseResult.data;

      const existing = await prisma.newsletter.findUnique({ where: { id } });
      if (!existing) {
        return reply.code(404).send({ error: 'Newsletter not found' });
      }

      if (existing.status === 'SENT' || existing.status === 'SENDING') {
        return reply.code(400).send({ error: 'Cannot modify sent newsletter' });
      }

      const newsletter = await prisma.newsletter.update({
        where: { id },
        data: {
          ...data,
          scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
        },
      });

      return reply.send(newsletter);
    }
  );

  // POST /newsletter/newsletters/:id/send - Envoyer newsletter (admin)
  fastify.post<{ Params: { id: string } }>(
    '/newsletters/:id/send',
    { preHandler: [fastify.requireAdmin] },
    async (request, reply) => {
      const { id } = request.params;

      const newsletter = await prisma.newsletter.findUnique({ where: { id } });
      if (!newsletter) {
        return reply.code(404).send({ error: 'Newsletter not found' });
      }

      if (newsletter.status === 'SENT' || newsletter.status === 'SENDING') {
        return reply.code(400).send({ error: 'Newsletter already sent' });
      }

      // Get active subscribers
      const subscribers = await prisma.subscriber.findMany({
        where: { isActive: true, isConfirmed: true },
      });

      if (subscribers.length === 0) {
        return reply.code(400).send({ error: 'No active subscribers' });
      }

      // Update status to sending
      await prisma.newsletter.update({
        where: { id },
        data: { status: 'SENDING', totalRecipients: subscribers.length },
      });

      // Send emails (async)
      const sendPromises = subscribers.map(async (subscriber) => {
        const result = await emailService.sendNewsletter(
          subscriber.email,
          subscriber.firstName,
          newsletter.subject,
          newsletter.htmlContent,
          subscriber.unsubscribeToken || '',
          newsletter.id
        );

        // Create recipient record
        await prisma.newsletterRecipient.create({
          data: {
            newsletterId: newsletter.id,
            subscriberId: subscriber.id,
            resendId: result.id,
          },
        });

        return result;
      });

      // Wait for all sends
      const results = await Promise.allSettled(sendPromises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      // Update newsletter status
      await prisma.newsletter.update({
        where: { id },
        data: {
          status: failed > successful ? 'FAILED' : 'SENT',
          sentAt: new Date(),
        },
      });

      return reply.send({
        message: 'Newsletter sent',
        stats: { successful, failed, total: subscribers.length },
      });
    }
  );

  // DELETE /newsletter/newsletters/:id - Supprimer newsletter (admin)
  fastify.delete<{ Params: { id: string } }>(
    '/newsletters/:id',
    { preHandler: [fastify.requireAdmin] },
    async (request, reply) => {
      const { id } = request.params;

      const existing = await prisma.newsletter.findUnique({ where: { id } });
      if (!existing) {
        return reply.code(404).send({ error: 'Newsletter not found' });
      }

      if (existing.status === 'SENT') {
        return reply.code(400).send({ error: 'Cannot delete sent newsletter' });
      }

      await prisma.newsletter.delete({ where: { id } });

      return reply.code(204).send();
    }
  );
};

export default newsletterRoutes;
