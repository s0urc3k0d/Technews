// ===========================================
// Routes API - Catégories
// ===========================================

import { FastifyPluginAsync } from 'fastify';
import {
  createCategorySchema,
  updateCategorySchema,
  CreateCategoryInput,
  UpdateCategoryInput,
} from '../schemas/index.js';

const categoriesRoutes: FastifyPluginAsync = async (fastify) => {
  const { prisma } = fastify;

  // GET /categories - Liste des catégories (public)
  fastify.get('/', async (request, reply) => {
    const categories = await prisma.category.findMany({
      orderBy: { order: 'asc' },
      include: {
        _count: {
          select: {
            articles: {
              where: { article: { status: 'PUBLISHED' } },
            },
          },
        },
      },
    });

    return reply.send({ data: categories });
  });

  // GET /categories/:slug - Détail catégorie (public)
  fastify.get<{ Params: { slug: string } }>(
    '/:slug',
    async (request, reply) => {
      const { slug } = request.params;

      const category = await prisma.category.findUnique({
        where: { slug },
        include: {
          _count: {
            select: {
              articles: {
                where: { article: { status: 'PUBLISHED' } },
              },
            },
          },
        },
      });

      if (!category) {
        return reply.code(404).send({ error: 'Category not found' });
      }

      return reply.send(category);
    }
  );

  // POST /categories - Créer catégorie (admin)
  fastify.post(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const parseResult = createCategorySchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({ error: 'Invalid body', details: parseResult.error.issues });
      }
      const data = parseResult.data;

      // Check unique constraints
      const existing = await prisma.category.findFirst({
        where: {
          OR: [{ slug: data.slug }, { name: data.name }],
        },
      });

      if (existing) {
        return reply.code(409).send({ 
          error: 'Category with this name or slug already exists' 
        });
      }

      const category = await prisma.category.create({ data });

      return reply.code(201).send(category);
    }
  );

  // PUT /categories/:id - Modifier catégorie (admin)
  fastify.put<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params;
      const parseResult = updateCategorySchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({ error: 'Invalid body', details: parseResult.error.issues });
      }
      const data = parseResult.data;

      const existing = await prisma.category.findUnique({ where: { id } });
      if (!existing) {
        return reply.code(404).send({ error: 'Category not found' });
      }

      // Check unique constraints for updates
      if (data.slug || data.name) {
        const conflict = await prisma.category.findFirst({
          where: {
            id: { not: id },
            OR: [
              data.slug ? { slug: data.slug } : {},
              data.name ? { name: data.name } : {},
            ].filter(o => Object.keys(o).length > 0),
          },
        });

        if (conflict) {
          return reply.code(409).send({ 
            error: 'Category with this name or slug already exists' 
          });
        }
      }

      const category = await prisma.category.update({
        where: { id },
        data,
      });

      return reply.send(category);
    }
  );

  // DELETE /categories/:id - Supprimer catégorie (admin)
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params;

      const existing = await prisma.category.findUnique({ where: { id } });
      if (!existing) {
        return reply.code(404).send({ error: 'Category not found' });
      }

      await prisma.category.delete({ where: { id } });

      return reply.code(204).send();
    }
  );
};

export default categoriesRoutes;
