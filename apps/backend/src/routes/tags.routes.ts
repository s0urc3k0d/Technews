// ===========================================
// Routes API - Tags
// ===========================================

import { FastifyPluginAsync } from 'fastify';
import {
  createTagSchema,
  updateTagSchema,
  CreateTagInput,
  UpdateTagInput,
} from '../schemas/index.js';

const tagsRoutes: FastifyPluginAsync = async (fastify) => {
  const { prisma } = fastify;

  // GET /tags - Liste des tags (public)
  fastify.get('/', async (request, reply) => {
    const tags = await prisma.tag.findMany({
      orderBy: { name: 'asc' },
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

    return reply.send({ data: tags });
  });

  // GET /tags/:slug - Détail tag (public)
  fastify.get<{ Params: { slug: string } }>(
    '/:slug',
    async (request, reply) => {
      const { slug } = request.params;

      const tag = await prisma.tag.findUnique({
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

      if (!tag) {
        return reply.code(404).send({ error: 'Tag not found' });
      }

      return reply.send(tag);
    }
  );

  // POST /tags - Créer tag (admin)
  fastify.post<{ Body: CreateTagInput }>(
    '/',
    {
      preHandler: [fastify.authenticate],
      schema: { body: createTagSchema },
    },
    async (request, reply) => {
      const data = request.body;

      const existing = await prisma.tag.findFirst({
        where: {
          OR: [{ slug: data.slug }, { name: data.name }],
        },
      });

      if (existing) {
        return reply.code(409).send({ 
          error: 'Tag with this name or slug already exists' 
        });
      }

      const tag = await prisma.tag.create({ data });

      return reply.code(201).send(tag);
    }
  );

  // PUT /tags/:id - Modifier tag (admin)
  fastify.put<{ Params: { id: string }; Body: UpdateTagInput }>(
    '/:id',
    {
      preHandler: [fastify.authenticate],
      schema: { body: updateTagSchema },
    },
    async (request, reply) => {
      const { id } = request.params;
      const data = request.body;

      const existing = await prisma.tag.findUnique({ where: { id } });
      if (!existing) {
        return reply.code(404).send({ error: 'Tag not found' });
      }

      const tag = await prisma.tag.update({
        where: { id },
        data,
      });

      return reply.send(tag);
    }
  );

  // DELETE /tags/:id - Supprimer tag (admin)
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params;

      const existing = await prisma.tag.findUnique({ where: { id } });
      if (!existing) {
        return reply.code(404).send({ error: 'Tag not found' });
      }

      await prisma.tag.delete({ where: { id } });

      return reply.code(204).send();
    }
  );
};

export default tagsRoutes;
