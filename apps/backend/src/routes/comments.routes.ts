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
  fastify.get<{ Querystring: ListCommentsQuery }>(
    '/',
    {
      preHandler: [fastify.authenticate],
      schema: { querystring: listCommentsQuerySchema },
    },
    async (request, reply) => {
      const { page, limit, status, articleId, orderBy, order } = request.query;
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
  fastify.post<{ Body: CreateCommentInput }>(
    '/',
    {
      config: {
        rateLimit: {
          max: 3,
          timeWindow: '1 minute',
        },
      },
      schema: { body: createCommentSchema },
    },
    async (request, reply) => {
      const { website, ...data } = request.body;
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
  fastify.put<{ Params: { id: string }; Body: UpdateCommentStatusInput }>(
    '/:id/status',
    {
      preHandler: [fastify.authenticate],
      schema: { body: updateCommentStatusSchema },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { status } = request.body;

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
  fastify.post<{ Params: { id: string }; Body: { reason?: string } }>(
    '/:id/report',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 hour',
        },
      },
      schema: { body: reportCommentSchema },
    },
    async (request, reply) => {
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
    { preHandler: [fastify.authenticate] },
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
