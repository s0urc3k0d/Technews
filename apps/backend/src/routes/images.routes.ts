// ===========================================
// Routes API - Images (Upload)
// ===========================================

import { FastifyPluginAsync } from 'fastify';
import { createImageService } from '../services/image.service.js';

const imagesRoutes: FastifyPluginAsync = async (fastify) => {
  const { prisma, config } = fastify;
  const imageService = createImageService(
    config.UPLOAD_PATH,
    parseInt(config.UPLOAD_MAX_SIZE_MB)
  );

  // POST /images/upload - Upload image (admin)
  fastify.post(
    '/upload',
    { preHandler: [fastify.requireAdmin] },
    async (request, reply) => {
      const data = await request.file();

      if (!data) {
        return reply.code(400).send({ error: 'No file uploaded' });
      }

      // Validate file type
      if (!imageService.validateFileType(data.mimetype)) {
        return reply.code(400).send({ 
          error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP' 
        });
      }

      // Get buffer
      const buffer = await data.toBuffer();

      // Validate file size
      if (!imageService.validateFileSize(buffer.length)) {
        return reply.code(400).send({ 
          error: `File too large. Maximum size: ${config.UPLOAD_MAX_SIZE_MB}MB` 
        });
      }

      // Process image
      const processed = await imageService.processImage(buffer, data.filename);

      // Get additional fields from multipart
      const fields = data.fields;
      const articleId = (fields.articleId as any)?.value;
      const alt = (fields.alt as any)?.value;
      const caption = (fields.caption as any)?.value;
      const isPrimary = (fields.isPrimary as any)?.value === 'true';

      // Save to database
      const image = await prisma.articleImage.create({
        data: {
          articleId: articleId || undefined,
          url: processed.url,
          thumbnail: processed.thumbnail,
          medium: processed.medium,
          alt,
          caption,
          width: processed.width,
          height: processed.height,
          size: processed.size,
          mimeType: processed.mimeType,
          isPrimary,
        },
      });

      // If primary, update article's featuredImage
      if (isPrimary && articleId) {
        await prisma.article.update({
          where: { id: articleId },
          data: { featuredImage: processed.url },
        });

        // Unset other primary images for this article
        await prisma.articleImage.updateMany({
          where: { 
            articleId, 
            id: { not: image.id },
            isPrimary: true,
          },
          data: { isPrimary: false },
        });
      }

      return reply.code(201).send(image);
    }
  );

  // GET /images/:id - Get image info (public)
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    async (request, reply) => {
      const { id } = request.params;

      const image = await prisma.articleImage.findUnique({
        where: { id },
      });

      if (!image) {
        return reply.code(404).send({ error: 'Image not found' });
      }

      return reply.send(image);
    }
  );

  // DELETE /images/:id - Delete image (admin)
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.requireAdmin] },
    async (request, reply) => {
      const { id } = request.params;

      const image = await prisma.articleImage.findUnique({
        where: { id },
      });

      if (!image) {
        return reply.code(404).send({ error: 'Image not found' });
      }

      // Delete files
      const filename = image.url.split('/').pop();
      if (filename) {
        await imageService.deleteImage(filename);
      }

      // Delete from database
      await prisma.articleImage.delete({ where: { id } });

      return reply.code(204).send();
    }
  );

  // GET /images/article/:articleId - Get images for article (public)
  fastify.get<{ Params: { articleId: string } }>(
    '/article/:articleId',
    async (request, reply) => {
      const { articleId } = request.params;

      const images = await prisma.articleImage.findMany({
        where: { articleId },
        orderBy: [
          { isPrimary: 'desc' },
          { order: 'asc' },
        ],
      });

      return reply.send({ data: images });
    }
  );
};

export default imagesRoutes;
