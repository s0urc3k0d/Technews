// ===========================================
// Routes API - Réseaux Sociaux
// ===========================================

import { FastifyPluginAsync } from 'fastify';
import { SocialPlatform } from '@prisma/client';
import { createSocialService } from '../services/social.service.js';
import crypto from 'crypto';

const socialRoutes: FastifyPluginAsync = async (fastify) => {
  const { prisma, config } = fastify;

  // Configuration du service social
  const socialConfig = {
    twitter: config.TWITTER_CLIENT_ID && config.TWITTER_CLIENT_SECRET ? {
      clientId: config.TWITTER_CLIENT_ID,
      clientSecret: config.TWITTER_CLIENT_SECRET,
    } : undefined,
    facebook: config.FACEBOOK_APP_ID && config.FACEBOOK_APP_SECRET ? {
      appId: config.FACEBOOK_APP_ID,
      appSecret: config.FACEBOOK_APP_SECRET,
    } : undefined,
    linkedin: config.LINKEDIN_CLIENT_ID && config.LINKEDIN_CLIENT_SECRET ? {
      clientId: config.LINKEDIN_CLIENT_ID,
      clientSecret: config.LINKEDIN_CLIENT_SECRET,
    } : undefined,
  };

  const socialService = createSocialService(prisma, socialConfig, config.NEXT_PUBLIC_SITE_URL);

  // Toutes les routes nécessitent l'authentification admin
  fastify.addHook('preHandler', fastify.requireAdmin);

  // ===========================================
  // CONNEXIONS
  // ===========================================

  // GET /social/connections - Liste des connexions
  fastify.get('/connections', async (request, reply) => {
    const connections = await prisma.socialConnection.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        platform: true,
        accountId: true,
        accountName: true,
        accountUrl: true,
        accountImage: true,
        isActive: true,
        lastUsedAt: true,
        lastError: true,
        createdAt: true,
      },
    });

    // Ajouter les plateformes configurées mais non connectées
    const configuredPlatforms: Array<{
      platform: SocialPlatform;
      configured: boolean;
      connected: boolean;
    }> = [];

    const allPlatforms: SocialPlatform[] = [
      SocialPlatform.TWITTER,
      SocialPlatform.FACEBOOK,
      SocialPlatform.LINKEDIN,
      SocialPlatform.BLUESKY,
    ];

    for (const platform of allPlatforms) {
      const connection = connections.find(c => c.platform === platform);
      const isConfigured = platform === SocialPlatform.TWITTER ? !!socialConfig.twitter :
                          platform === SocialPlatform.FACEBOOK ? !!socialConfig.facebook :
                          platform === SocialPlatform.LINKEDIN ? !!socialConfig.linkedin :
                          platform === SocialPlatform.BLUESKY ? true : false;

      configuredPlatforms.push({
        platform,
        configured: isConfigured,
        connected: !!connection,
      });
    }

    return reply.send({
      connections,
      platforms: configuredPlatforms,
    });
  });

  // GET /social/auth/:platform - Obtenir l'URL d'autorisation OAuth
  fastify.get<{
    Params: { platform: string };
  }>('/auth/:platform', async (request, reply) => {
    const { platform } = request.params;
    const platformEnum = platform.toUpperCase() as SocialPlatform;

    if (!Object.values(SocialPlatform).includes(platformEnum)) {
      return reply.code(400).send({ error: 'Invalid platform' });
    }

    // Bluesky n'utilise pas OAuth
    if (platformEnum === SocialPlatform.BLUESKY) {
      return reply.send({
        type: 'credentials',
        message: 'Bluesky utilise un App Password. Entrez vos identifiants directement.',
      });
    }

    const state = crypto.randomBytes(16).toString('hex');
    const redirectUri = `${config.NEXT_PUBLIC_SITE_URL}/api/social/callback/${platform.toLowerCase()}`;

    try {
      const authUrl = socialService.getAuthUrl(platformEnum, redirectUri, state);

      // Stocker le state en session/cookie pour vérification
      reply.setCookie(`social_state_${platform}`, state, {
        httpOnly: true,
        secure: config.NODE_ENV === 'production',
        maxAge: 600, // 10 minutes
        path: '/',
      });

      return reply.send({ authUrl, state });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return reply.code(400).send({ error: message });
    }
  });

  // GET /social/callback/:platform - Callback OAuth
  fastify.get<{
    Params: { platform: string };
    Querystring: { code?: string; state?: string; error?: string };
  }>('/callback/:platform', async (request, reply) => {
    const { platform } = request.params;
    const { code, state, error } = request.query;
    const platformEnum = platform.toUpperCase() as SocialPlatform;

    if (error) {
      return reply.redirect(`/admin/social?error=${encodeURIComponent(error)}`);
    }

    if (!code) {
      return reply.redirect('/admin/social?error=no_code');
    }

    // Vérifier le state
    const savedState = request.cookies[`social_state_${platform}`];
    if (savedState && savedState !== state) {
      return reply.redirect('/admin/social?error=invalid_state');
    }

    const redirectUri = `${config.NEXT_PUBLIC_SITE_URL}/api/social/callback/${platform.toLowerCase()}`;

    try {
      const tokens = await socialService.exchangeCode(platformEnum, code, redirectUri);

      // Sauvegarder ou mettre à jour la connexion
      await prisma.socialConnection.upsert({
        where: { platform: platformEnum },
        create: {
          platform: platformEnum,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken || null,
          tokenExpiry: tokens.expiresIn 
            ? new Date(Date.now() + tokens.expiresIn * 1000) 
            : null,
          accountId: tokens.accountId,
          accountName: tokens.accountName,
          accountUrl: tokens.accountUrl || null,
          accountImage: tokens.accountImage || null,
          isActive: true,
        },
        update: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken || null,
          tokenExpiry: tokens.expiresIn 
            ? new Date(Date.now() + tokens.expiresIn * 1000) 
            : null,
          accountId: tokens.accountId,
          accountName: tokens.accountName,
          accountUrl: tokens.accountUrl || null,
          accountImage: tokens.accountImage || null,
          isActive: true,
          lastError: null,
        },
      });

      // Supprimer le cookie state
      reply.clearCookie(`social_state_${platform}`);

      return reply.redirect(`/admin/social?success=${platform}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[Social] OAuth callback error for ${platform}:`, err);
      return reply.redirect(`/admin/social?error=${encodeURIComponent(message)}`);
    }
  });

  // POST /social/connect/bluesky - Connexion Bluesky (credentials)
  fastify.post<{
    Body: { handle: string; appPassword: string };
  }>('/connect/bluesky', async (request, reply) => {
    const { handle, appPassword } = request.body;

    if (!handle || !appPassword) {
      return reply.code(400).send({ error: 'Handle and app password required' });
    }

    try {
      // Tester la connexion
      const sessionResponse = await fetch(
        'https://bsky.social/xrpc/com.atproto.server.createSession',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identifier: handle,
            password: appPassword,
          }),
        }
      );

      if (!sessionResponse.ok) {
        const error = await sessionResponse.json();
        throw new Error(error.message || 'Invalid credentials');
      }

      const session = await sessionResponse.json();

      // Sauvegarder la connexion
      await prisma.socialConnection.upsert({
        where: { platform: SocialPlatform.BLUESKY },
        create: {
          platform: SocialPlatform.BLUESKY,
          accessToken: `${handle}:${appPassword}`, // Stocké ensemble
          accountId: session.did,
          accountName: `@${session.handle}`,
          accountUrl: `https://bsky.app/profile/${session.handle}`,
          isActive: true,
        },
        update: {
          accessToken: `${handle}:${appPassword}`,
          accountId: session.did,
          accountName: `@${session.handle}`,
          accountUrl: `https://bsky.app/profile/${session.handle}`,
          isActive: true,
          lastError: null,
        },
      });

      return reply.send({
        success: true,
        account: {
          handle: session.handle,
          did: session.did,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return reply.code(400).send({ error: message });
    }
  });

  // DELETE /social/connections/:platform - Déconnecter un réseau
  fastify.delete<{
    Params: { platform: string };
  }>('/connections/:platform', async (request, reply) => {
    const { platform } = request.params;
    const platformEnum = platform.toUpperCase() as SocialPlatform;

    await prisma.socialConnection.delete({
      where: { platform: platformEnum },
    }).catch(() => {
      // Ignore if not found
    });

    return reply.send({ success: true });
  });

  // PATCH /social/connections/:platform/toggle - Activer/Désactiver
  fastify.patch<{
    Params: { platform: string };
    Body: { isActive: boolean };
  }>('/connections/:platform/toggle', async (request, reply) => {
    const { platform } = request.params;
    const { isActive } = request.body;
    const platformEnum = platform.toUpperCase() as SocialPlatform;

    const connection = await prisma.socialConnection.update({
      where: { platform: platformEnum },
      data: { isActive },
    });

    return reply.send(connection);
  });

  // ===========================================
  // PARTAGE
  // ===========================================

  // POST /social/share/:articleId - Partager un article manuellement
  fastify.post<{
    Params: { articleId: string };
    Body: { platforms?: string[] };
  }>('/share/:articleId', async (request, reply) => {
    const { articleId } = request.params;
    const { platforms } = request.body;

    try {
      const results = await socialService.shareArticle(articleId);

      // Si des plateformes spécifiques sont demandées, filtrer
      const filteredResults = platforms 
        ? results.filter(r => platforms.includes(r.platform.toLowerCase()))
        : results;

      return reply.send({
        success: filteredResults.every(r => r.success),
        results: filteredResults,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return reply.code(500).send({ error: message });
    }
  });

  // GET /social/shares/:articleId - Historique des partages d'un article
  fastify.get<{
    Params: { articleId: string };
  }>('/shares/:articleId', async (request, reply) => {
    const { articleId } = request.params;

    const shares = await prisma.socialShare.findMany({
      where: { articleId },
      include: {
        connection: {
          select: {
            accountName: true,
            accountUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return reply.send(shares);
  });
};

export default socialRoutes;
