// ===========================================
// Routes API - Commentaires
// ===========================================

import { FastifyPluginAsync } from 'fastify';
import {
  createCommentSchema,
  updateCommentStatusSchema,
  listCommentsQuerySchema,
  reportCommentSchema,
  CreateCommentInput,
  UpdateCommentStatusInput,
  ListCommentsQuery,
} from '../schemas/index.js';
import { createSpamService } from '../services/spam.service.js';

const commentsRoutes: FastifyPluginAsync = async (fastify) => {
  const { prisma } = fastify;
  const spamService = createSpamService(prisma);

  // GET /comments - Liste des commentaires (admin)
  fastify.get(
    '/',
    { preHandler: [fastify.requireAdmin] },
    async (request, reply) => {
      const parseResult = listCommentsQuerySchema.safeParse(request.query);
      if (!parseResult.success) {
        return reply.status(400).send({ error: 'Invalid query parameters', details: parseResult.error.issues });
      }
      const { page, limit, status, articleId, orderBy, order } = parseResult.data;
      const skip = (page - 1) * limit;

      const where: any = {};
      if (status) where.status = status;
      if (articleId) where.articleId = articleId;

      const [comments, total] = await Promise.all([
        prisma.comment.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [orderBy]: order },
          include: {
            article: {
              select: { id: true, title: true, slug: true },
            },
            replies: {
              select: { id: true },
            },
          },
        }),
        prisma.comment.count({ where }),
      ]);

      return reply.send({
        data: comments,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    }
  );

  // GET /comments/article/:articleId - Commentaires d'un article (public)
  fastify.get<{ Params: { articleId: string } }>(
    '/article/:articleId',
    async (request, reply) => {
      const { articleId } = request.params;

      const comments = await prisma.comment.findMany({
        where: {
          articleId,
          status: 'APPROVED',
          parentId: null, // Only root comments
        },
        orderBy: { createdAt: 'desc' },
        include: {
          replies: {
            where: { status: 'APPROVED' },
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      return reply.send({ data: comments });
    }
  );

  // POST /comments - Créer commentaire (public)
  fastify.post(
    '/',
    {
      config: {
        rateLimit: {
          max: 3,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const parseResult = createCommentSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({ error: 'Invalid body', details: parseResult.error.issues });
      }
      const { website, ...data } = parseResult.data;
      const ip = request.ip;
      const userAgent = request.headers['user-agent'] || '';

      // Check if article exists and is published
      const article = await prisma.article.findUnique({
        where: { id: data.articleId },
        select: { status: true },
      });

      if (!article || article.status !== 'PUBLISHED') {
        return reply.code(404).send({ error: 'Article not found' });
      }

      // Check if parent comment exists
      if (data.parentId) {
        const parent = await prisma.comment.findUnique({
          where: { id: data.parentId },
          select: { articleId: true, status: true },
        });

        if (!parent || parent.articleId !== data.articleId || parent.status !== 'APPROVED') {
          return reply.code(400).send({ error: 'Invalid parent comment' });
        }
      }

      // Spam check
      const spamCheck = await spamService.checkSpam(
        data.content,
        data.authorEmail,
        ip,
        website // honeypot
      );

      if (spamCheck.isSpam) {
        console.warn('Spam comment blocked:', { reason: spamCheck.reason, ip });
        // Don't reveal spam detection to user
        return reply.code(201).send({ 
          message: 'Comment submitted for moderation',
          // Return fake success
        });
      }

      const comment = await prisma.comment.create({
        data: {
          ...data,
          status: 'APPROVED', // Auto-approve (modération a posteriori)
          ipAddress: ip,
          userAgent,
        },
      });

      return reply.code(201).send(comment);
    }
  );

  // PUT /comments/:id/status - Modifier statut (admin)
  fastify.put<{ Params: { id: string } }>(
    '/:id/status',
    { preHandler: [fastify.requireAdmin] },
    async (request, reply) => {
      const { id } = request.params;
      const parseResult = updateCommentStatusSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({ error: 'Invalid body', details: parseResult.error.issues });
      }
      const { status } = parseResult.data;

      const existing = await prisma.comment.findUnique({ where: { id } });
      if (!existing) {
        return reply.code(404).send({ error: 'Comment not found' });
      }

      const comment = await prisma.comment.update({
        where: { id },
        data: { status },
      });

      return reply.send(comment);
    }
  );

  // POST /comments/:id/report - Signaler commentaire (public)
  fastify.post<{ Params: { id: string } }>(
    '/:id/report',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 hour',
        },
      },
    },
    async (request, reply) => {
      const parseResult = reportCommentSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({ error: 'Invalid body', details: parseResult.error.issues });
      }
      const { id } = request.params;

      const existing = await prisma.comment.findUnique({ where: { id } });
      if (!existing) {
        return reply.code(404).send({ error: 'Comment not found' });
      }

      // Increment report count
      const comment = await prisma.comment.update({
        where: { id },
        data: {
          reportCount: { increment: 1 },
          reportedAt: new Date(),
          // Auto-pending if too many reports
          status: existing.reportCount >= 2 ? 'PENDING' : existing.status,
        },
      });

      return reply.send({ message: 'Comment reported successfully' });
    }
  );

  // DELETE /comments/:id - Supprimer commentaire (admin)
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.requireAdmin] },
    async (request, reply) => {
      const { id } = request.params;

      const existing = await prisma.comment.findUnique({ where: { id } });
      if (!existing) {
        return reply.code(404).send({ error: 'Comment not found' });
      }

      await prisma.comment.delete({ where: { id } });

      return reply.code(204).send();
    }
  );
};

export default commentsRoutes;
