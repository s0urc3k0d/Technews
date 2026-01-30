// ===========================================
// Routes API pour les Shorts vidéo
// ===========================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createShortsService } from '../services/shorts.service.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { pipeline } from 'stream/promises';

export async function shortsRoutes(fastify: FastifyInstance) {
  const prisma = fastify.prisma;
  
  const shortsService = createShortsService(prisma, {
    mistralApiKey: fastify.config.MISTRAL_API_KEY || '',
    shortsDir: fastify.config.SHORTS_DIR || '/var/www/revuetech/shorts',
    backgroundsDir: fastify.config.SHORTS_DIR 
      ? path.join(fastify.config.SHORTS_DIR, 'backgrounds')
      : '/var/www/revuetech/shorts/backgrounds',
    tempDir: fastify.config.SHORTS_DIR
      ? path.join(fastify.config.SHORTS_DIR, 'temp')
      : '/var/www/revuetech/shorts/temp',
  });

  // GET /shorts/current - Récupérer les infos du short actuel
  fastify.get(
    '/current',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const metadata = await shortsService.getCurrentShort();
      
      if (!metadata) {
        return reply.status(404).send({ 
          error: 'Aucun short disponible',
          message: 'Aucune vidéo n\'a encore été générée'
        });
      }

      const exists = await shortsService.shortExists();
      
      return reply.send({
        ...metadata,
        available: exists,
        videoUrl: '/api/v1/shorts/video',
        thumbnailUrl: '/api/v1/shorts/thumbnail',
      });
    }
  );

  // GET /shorts/video - Télécharger la vidéo
  fastify.get(
    '/video',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const exists = await shortsService.shortExists();
      
      if (!exists) {
        return reply.status(404).send({ error: 'Vidéo non disponible' });
      }

      const videoPath = shortsService.getVideoPath();
      const stat = await fs.stat(videoPath);
      
      reply.header('Content-Type', 'video/mp4');
      reply.header('Content-Length', stat.size);
      reply.header('Content-Disposition', `attachment; filename="revuetech-daily-${new Date().toISOString().split('T')[0]}.mp4"`);
      
      const stream = await fs.open(videoPath, 'r');
      return reply.send(stream.createReadStream());
    }
  );

  // GET /shorts/thumbnail - Récupérer la miniature
  fastify.get(
    '/thumbnail',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const thumbnailPath = shortsService.getThumbnailPath();
      
      try {
        await fs.access(thumbnailPath);
        const stat = await fs.stat(thumbnailPath);
        
        reply.header('Content-Type', 'image/png');
        reply.header('Content-Length', stat.size);
        
        const stream = await fs.open(thumbnailPath, 'r');
        return reply.send(stream.createReadStream());
      } catch {
        return reply.status(404).send({ error: 'Miniature non disponible' });
      }
    }
  );

  // POST /shorts/generate - Forcer la génération d'un short
  fastify.post(
    '/generate',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        fastify.log.info('Génération manuelle du short demandée');
        
        const result = await shortsService.generateDailyShort();
        
        if (!result) {
          return reply.status(400).send({
            error: 'Génération impossible',
            message: 'Aucun article publié aujourd\'hui'
          });
        }

        return reply.send({
          success: true,
          message: 'Short généré avec succès',
          data: {
            slidesCount: result.slides.length,
            duration: result.duration,
            generatedAt: result.generatedAt,
          }
        });
      } catch (error) {
        fastify.log.error(error, 'Erreur génération short');
        return reply.status(500).send({
          error: 'Erreur de génération',
          message: error instanceof Error ? error.message : 'Erreur inconnue'
        });
      }
    }
  );

  // GET /shorts/backgrounds - Lister les images de fond
  fastify.get(
    '/backgrounds',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const backgrounds = await shortsService.listBackgrounds();
      
      return reply.send({
        backgrounds: backgrounds.map(filename => ({
          filename,
          url: `/api/v1/shorts/backgrounds/${filename}`,
        })),
        count: backgrounds.length,
      });
    }
  );

  // GET /shorts/backgrounds/:filename - Récupérer une image de fond
  fastify.get<{ Params: { filename: string } }>(
    '/backgrounds/:filename',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { filename } = request.params;
      const backgroundsDir = fastify.config.SHORTS_DIR 
        ? path.join(fastify.config.SHORTS_DIR, 'backgrounds')
        : '/var/www/revuetech/shorts/backgrounds';
      
      const filePath = path.join(backgroundsDir, filename);
      
      // Sécurité : vérifier que le fichier est bien dans le dossier
      if (!filePath.startsWith(backgroundsDir)) {
        return reply.status(403).send({ error: 'Accès refusé' });
      }

      try {
        await fs.access(filePath);
        const stat = await fs.stat(filePath);
        
        const ext = path.extname(filename).toLowerCase();
        const mimeTypes: Record<string, string> = {
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.webp': 'image/webp',
        };
        
        reply.header('Content-Type', mimeTypes[ext] || 'application/octet-stream');
        reply.header('Content-Length', stat.size);
        
        const stream = await fs.open(filePath, 'r');
        return reply.send(stream.createReadStream());
      } catch {
        return reply.status(404).send({ error: 'Image non trouvée' });
      }
    }
  );

  // POST /shorts/backgrounds - Uploader une image de fond
  fastify.post(
    '/backgrounds',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const data = await request.file();
      
      if (!data) {
        return reply.status(400).send({ error: 'Aucun fichier uploadé' });
      }

      // Vérifier le type de fichier
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(data.mimetype)) {
        return reply.status(400).send({ 
          error: 'Type de fichier non autorisé',
          message: 'Formats acceptés: JPG, PNG, WebP'
        });
      }

      // Vérifier la taille (max 5 Mo)
      const maxSize = 5 * 1024 * 1024;
      const chunks: Buffer[] = [];
      
      for await (const chunk of data.file) {
        chunks.push(chunk);
        if (Buffer.concat(chunks).length > maxSize) {
          return reply.status(400).send({
            error: 'Fichier trop volumineux',
            message: 'Taille maximum: 5 Mo'
          });
        }
      }

      const buffer = Buffer.concat(chunks);
      
      // Générer un nom de fichier sécurisé
      const ext = path.extname(data.filename).toLowerCase();
      const safeName = `bg_${Date.now()}${ext}`;
      
      await shortsService.addBackground(safeName, buffer);

      return reply.send({
        success: true,
        filename: safeName,
        url: `/api/v1/shorts/backgrounds/${safeName}`,
      });
    }
  );

  // DELETE /shorts/backgrounds/:filename - Supprimer une image de fond
  fastify.delete<{ Params: { filename: string } }>(
    '/backgrounds/:filename',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { filename } = request.params;

      // Protection contre les noms de fichiers malveillants
      if (filename.includes('..') || filename.includes('/')) {
        return reply.status(400).send({ error: 'Nom de fichier invalide' });
      }

      try {
        await shortsService.removeBackground(filename);
        return reply.send({ success: true, message: 'Image supprimée' });
      } catch {
        return reply.status(404).send({ error: 'Image non trouvée' });
      }
    }
  );

  // GET /shorts/preview - Prévisualisation des articles du jour
  fastify.get(
    '/preview',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const articles = await shortsService.getTodayArticles();
      
      return reply.send({
        articles: articles.map(a => ({
          id: a.id,
          title: a.title,
          excerpt: a.excerpt,
          category: a.categories?.[0]?.category?.name || 'Non catégorisé',
          publishedAt: a.publishedAt,
        })),
        count: articles.length,
        estimatedDuration: articles.length * 5, // 5 secondes par slide
      });
    }
  );

  // GET /shorts/tags - Générer les tags sans créer la vidéo
  fastify.get(
    '/tags',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const metadata = await shortsService.getCurrentShort();
      
      if (!metadata) {
        return reply.status(404).send({ 
          error: 'Aucun short disponible',
          message: 'Générez d\'abord une vidéo pour obtenir les tags'
        });
      }

      return reply.send({
        tiktok: {
          tags: metadata.tagsTikTok,
          formatted: metadata.tagsTikTok.map(t => `#${t}`).join(' '),
          caption: `📱 L'actu tech du jour en 1 minute ! ${metadata.tagsTikTok.slice(0, 5).map(t => `#${t}`).join(' ')}`,
        },
        youtube: {
          tags: metadata.tagsYouTube,
          formatted: metadata.tagsYouTube.join(', '),
          title: `🔥 Actu Tech du ${new Date().toLocaleDateString('fr-FR')} - Résumé Express #Shorts`,
          description: `Les ${metadata.slides.length} actus tech les plus importantes du jour résumées en moins d'une minute !

📰 Articles du jour :
${metadata.slides.map((s, i) => `${i + 1}. ${s.title}`).join('\n')}

🔗 Plus d'infos sur RevueTech.fr

#shorts #tech #actualité`,
        },
      });
    }
  );
}

export default shortsRoutes;
