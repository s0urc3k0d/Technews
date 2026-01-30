// ===========================================
// Routes API - Articles
// ===========================================

import { FastifyPluginAsync } from 'fastify';
import { 
  createArticleSchema, 
  updateArticleSchema, 
  listArticlesQuerySchema,
  CreateArticleInput,
  UpdateArticleInput,
  ListArticlesQuery,
} from '../schemas/index.js';
import { ArticleStatus } from '@technews/database';
import { createSocialService } from '../services/social.service.js';

const articlesRoutes: FastifyPluginAsync = async (fastify) => {
  const { prisma } = fastify;

  // GET /articles - Liste des articles (public)
  fastify.get<{ Querystring: ListArticlesQuery }>(
    '/',
    {
      schema: {
        querystring: listArticlesQuerySchema,
      },
    },
    async (request, reply) => {
      const { 
        page, limit, status, type, categorySlug, tagSlug, 
        search, source, featured, orderBy, order 
      } = request.query;

      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {};
      
      // Public access: only published articles (unless admin)
      if (!request.user) {
        where.status = ArticleStatus.PUBLISHED;
      } else if (status) {
        where.status = status;
      }

      if (type) where.type = type;
      if (source) where.source = source;
      if (featured !== undefined) where.isFeatured = featured;

      if (categorySlug) {
        where.categories = {
          some: {
            category: { slug: categorySlug },
          },
        };
      }

      if (tagSlug) {
        where.tags = {
          some: {
            tag: { slug: tagSlug },
          },
        };
      }

      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { excerpt: { contains: search, mode: 'insensitive' } },
          { content: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [articles, total] = await Promise.all([
        prisma.article.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [orderBy]: order },
          include: {
            categories: {
              include: { category: true },
            },
            tags: {
              include: { tag: true },
            },
            images: {
              where: { isPrimary: true },
              take: 1,
            },
          },
        }),
        prisma.article.count({ where }),
      ]);

      // Transform response
      const data = articles.map(article => ({
        ...article,
        categories: article.categories.map(c => c.category),
        tags: article.tags.map(t => t.tag),
        featuredImage: article.images[0]?.url || article.featuredImage,
        images: undefined,
      }));

      return reply.send({
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    }
  );

  // GET /articles/featured - Article en une (public)
  fastify.get('/featured', async (request, reply) => {
    const article = await prisma.article.findFirst({
      where: {
        isFeatured: true,
        status: ArticleStatus.PUBLISHED,
      },
      include: {
        categories: {
          include: { category: true },
        },
        tags: {
          include: { tag: true },
        },
      },
    });

    if (!article) {
      return reply.code(404).send({ error: 'No featured article found' });
    }

    return reply.send({
      ...article,
      categories: article.categories.map(c => c.category),
      tags: article.tags.map(t => t.tag),
    });
  });

  // GET /articles/:slug - Détail article (public)
  fastify.get<{ Params: { slug: string } }>(
    '/:slug',
    async (request, reply) => {
      const { slug } = request.params;

      const article = await prisma.article.findUnique({
        where: { slug },
        include: {
          categories: {
            include: { category: true },
          },
          tags: {
            include: { tag: true },
          },
          images: true,
          comments: {
            where: { status: 'APPROVED', parentId: null },
            orderBy: { createdAt: 'desc' },
            include: {
              replies: {
                where: { status: 'APPROVED' },
                orderBy: { createdAt: 'asc' },
              },
            },
          },
        },
      });

      if (!article) {
        return reply.code(404).send({ error: 'Article not found' });
      }

      // Check access for non-published articles
      if (article.status !== ArticleStatus.PUBLISHED && !request.user) {
        return reply.code(404).send({ error: 'Article not found' });
      }

      // Increment view count (async, don't wait)
      prisma.article.update({
        where: { id: article.id },
        data: { viewCount: { increment: 1 } },
      }).catch(() => {});

      return reply.send({
        ...article,
        categories: article.categories.map(c => c.category),
        tags: article.tags.map(t => t.tag),
      });
    }
  );

  // POST /articles - Créer article (admin)
  fastify.post<{ Body: CreateArticleInput }>(
    '/',
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: createArticleSchema,
      },
    },
    async (request, reply) => {
      const { categoryIds, tagIds, ...data } = request.body;

      // If setting as featured, unset other featured articles
      if (data.isFeatured) {
        await prisma.article.updateMany({
          where: { isFeatured: true },
          data: { isFeatured: false, featuredAt: null },
        });
      }

      const article = await prisma.article.create({
        data: {
          ...data,
          featuredAt: data.isFeatured ? new Date() : null,
          publishedAt: data.status === 'PUBLISHED' ? new Date() : data.publishedAt ? new Date(data.publishedAt) : null,
          categories: categoryIds ? {
            create: categoryIds.map(categoryId => ({ categoryId })),
          } : undefined,
          tags: tagIds ? {
            create: tagIds.map(tagId => ({ tagId })),
          } : undefined,
        },
        include: {
          categories: { include: { category: true } },
          tags: { include: { tag: true } },
        },
      });

      return reply.code(201).send({
        ...article,
        categories: article.categories.map(c => c.category),
        tags: article.tags.map(t => t.tag),
      });
    }
  );

  // PUT /articles/:id - Modifier article (admin)
  fastify.put<{ Params: { id: string }; Body: UpdateArticleInput }>(
    '/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: updateArticleSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { categoryIds, tagIds, ...data } = request.body;

      // Check if article exists
      const existing = await prisma.article.findUnique({ where: { id } });
      if (!existing) {
        return reply.code(404).send({ error: 'Article not found' });
      }

      // If setting as featured, unset other featured articles
      if (data.isFeatured && !existing.isFeatured) {
        await prisma.article.updateMany({
          where: { isFeatured: true, id: { not: id } },
          data: { isFeatured: false, featuredAt: null },
        });
      }

      // Handle category updates
      if (categoryIds !== undefined) {
        await prisma.categoriesOnArticles.deleteMany({ where: { articleId: id } });
      }

      // Handle tag updates
      if (tagIds !== undefined) {
        await prisma.tagsOnArticles.deleteMany({ where: { articleId: id } });
      }

      const article = await prisma.article.update({
        where: { id },
        data: {
          ...data,
          featuredAt: data.isFeatured ? new Date() : existing.isFeatured ? existing.featuredAt : null,
          publishedAt: data.status === 'PUBLISHED' && !existing.publishedAt 
            ? new Date() 
            : data.publishedAt ? new Date(data.publishedAt) : undefined,
          categories: categoryIds ? {
            create: categoryIds.map(categoryId => ({ categoryId })),
          } : undefined,
          tags: tagIds ? {
            create: tagIds.map(tagId => ({ tagId })),
          } : undefined,
        },
        include: {
          categories: { include: { category: true } },
          tags: { include: { tag: true } },
        },
      });

      return reply.send({
        ...article,
        categories: article.categories.map(c => c.category),
        tags: article.tags.map(t => t.tag),
      });
    }
  );

  // DELETE /articles/:id - Supprimer article (admin)
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params;

      const existing = await prisma.article.findUnique({ where: { id } });
      if (!existing) {
        return reply.code(404).send({ error: 'Article not found' });
      }

      await prisma.article.delete({ where: { id } });

      return reply.code(204).send();
    }
  );

  // POST /articles/:id/publish - Publier un article draft (admin)
  fastify.post<{ Params: { id: string }; Body: { shareOnPublish?: boolean } }>(
    '/:id/publish',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params;
      const { shareOnPublish } = request.body || {};

      const article = await prisma.article.update({
        where: { id },
        data: {
          status: ArticleStatus.PUBLISHED,
          publishedAt: new Date(),
          shareOnPublish: shareOnPublish ?? false,
        },
      });

      // Partager sur les réseaux sociaux si demandé
      let socialResults = null;
      if (shareOnPublish || article.shareOnPublish) {
        try {
          const socialConfig = {
            twitter: fastify.config.TWITTER_CLIENT_ID && fastify.config.TWITTER_CLIENT_SECRET ? {
              clientId: fastify.config.TWITTER_CLIENT_ID,
              clientSecret: fastify.config.TWITTER_CLIENT_SECRET,
            } : undefined,
            facebook: fastify.config.FACEBOOK_APP_ID && fastify.config.FACEBOOK_APP_SECRET ? {
              appId: fastify.config.FACEBOOK_APP_ID,
              appSecret: fastify.config.FACEBOOK_APP_SECRET,
            } : undefined,
            linkedin: fastify.config.LINKEDIN_CLIENT_ID && fastify.config.LINKEDIN_CLIENT_SECRET ? {
              clientId: fastify.config.LINKEDIN_CLIENT_ID,
              clientSecret: fastify.config.LINKEDIN_CLIENT_SECRET,
            } : undefined,
          };
          
          const socialService = createSocialService(
            prisma, 
            socialConfig, 
            fastify.config.NEXT_PUBLIC_SITE_URL
          );
          
          socialResults = await socialService.shareArticle(id);
          fastify.log.info({ articleId: id, socialResults }, 'Article shared on social media');
        } catch (err) {
          fastify.log.error({ err, articleId: id }, 'Failed to share on social media');
        }
      }

      return reply.send({
        ...article,
        socialShares: socialResults,
      });
    }
  );

  // POST /articles/:id/reject - Rejeter un article RSS (admin)
  fastify.post<{ Params: { id: string } }>(
    '/:id/reject',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params;

      const article = await prisma.article.update({
        where: { id },
        data: { status: ArticleStatus.REJECTED },
      });

      return reply.send(article);
    }
  );
};

export default articlesRoutes;
