// ===========================================
// Service de Publication sur Réseaux Sociaux
// ===========================================

import { PrismaClient, SocialPlatform, SocialShareStatus, Article } from '@prisma/client';

interface SocialConfig {
  twitter?: {
    clientId: string;
    clientSecret: string;
  };
  facebook?: {
    appId: string;
    appSecret: string;
  };
  linkedin?: {
    clientId: string;
    clientSecret: string;
  };
  bluesky?: {
    // Bluesky utilise des credentials directs, pas OAuth
  };
}

interface ShareResult {
  platform: SocialPlatform;
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
}

interface ArticleWithConnections extends Article {
  categories?: Array<{ category: { name: string } }>;
}

export class SocialService {
  private prisma: PrismaClient;
  private config: SocialConfig;
  private siteUrl: string;

  constructor(prisma: PrismaClient, config: SocialConfig, siteUrl: string) {
    this.prisma = prisma;
    this.config = config;
    this.siteUrl = siteUrl;
  }

  /**
   * Partager un article sur tous les réseaux sociaux connectés
   */
  async shareArticle(articleId: string): Promise<ShareResult[]> {
    const article = await this.prisma.article.findUnique({
      where: { id: articleId },
      include: {
        categories: {
          include: { category: true },
        },
      },
    });

    if (!article) {
      throw new Error('Article not found');
    }

    // Récupérer toutes les connexions actives
    const connections = await this.prisma.socialConnection.findMany({
      where: { isActive: true },
    });

    const results: ShareResult[] = [];

    for (const connection of connections) {
      // Vérifier si déjà partagé sur cette plateforme
      const existingShare = await this.prisma.socialShare.findUnique({
        where: {
          articleId_platform: {
            articleId,
            platform: connection.platform,
          },
        },
      });

      if (existingShare && existingShare.status === SocialShareStatus.PUBLISHED) {
        results.push({
          platform: connection.platform,
          success: true,
          postId: existingShare.postId || undefined,
          postUrl: existingShare.postUrl || undefined,
        });
        continue;
      }

      // Créer ou mettre à jour le share record
      const share = await this.prisma.socialShare.upsert({
        where: {
          articleId_platform: {
            articleId,
            platform: connection.platform,
          },
        },
        create: {
          articleId,
          connectionId: connection.id,
          platform: connection.platform,
          status: SocialShareStatus.PENDING,
        },
        update: {
          status: SocialShareStatus.PENDING,
          error: null,
        },
      });

      try {
        const result = await this.postToplatform(
          connection.platform,
          connection.accessToken,
          article as ArticleWithConnections
        );

        await this.prisma.socialShare.update({
          where: { id: share.id },
          data: {
            status: SocialShareStatus.PUBLISHED,
            postId: result.postId,
            postUrl: result.postUrl,
            sharedAt: new Date(),
          },
        });

        // Mettre à jour lastUsedAt sur la connexion
        await this.prisma.socialConnection.update({
          where: { id: connection.id },
          data: { lastUsedAt: new Date(), lastError: null },
        });

        results.push({
          platform: connection.platform,
          success: true,
          postId: result.postId,
          postUrl: result.postUrl,
        });
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Unknown error';

        await this.prisma.socialShare.update({
          where: { id: share.id },
          data: {
            status: SocialShareStatus.FAILED,
            error,
          },
        });

        await this.prisma.socialConnection.update({
          where: { id: connection.id },
          data: { lastError: error },
        });

        results.push({
          platform: connection.platform,
          success: false,
          error,
        });
      }
    }

    return results;
  }

  /**
   * Poster sur une plateforme spécifique
   */
  private async postToplatform(
    platform: SocialPlatform,
    accessToken: string,
    article: ArticleWithConnections
  ): Promise<{ postId: string; postUrl: string }> {
    const articleUrl = `${this.siteUrl}/article/${article.slug}`;
    const text = this.generateShareText(article, platform);

    switch (platform) {
      case SocialPlatform.TWITTER:
        return this.postToTwitter(accessToken, text, articleUrl);
      case SocialPlatform.FACEBOOK:
        return this.postToFacebook(accessToken, text, articleUrl);
      case SocialPlatform.LINKEDIN:
        return this.postToLinkedIn(accessToken, text, articleUrl, article);
      case SocialPlatform.BLUESKY:
        return this.postToBluesky(accessToken, text, articleUrl);
      default:
        throw new Error(`Platform ${platform} not supported`);
    }
  }

  /**
   * Générer le texte de partage adapté à la plateforme
   */
  private generateShareText(article: ArticleWithConnections, platform: SocialPlatform): string {
    const maxLength = platform === SocialPlatform.TWITTER ? 250 : 500;
    const hashtags = this.generateHashtags(article);
    
    let text = article.title;
    
    if (article.excerpt) {
      const excerpt = article.excerpt.length > 150 
        ? article.excerpt.substring(0, 147) + '...' 
        : article.excerpt;
      text += `\n\n${excerpt}`;
    }

    if (hashtags && text.length + hashtags.length + 2 < maxLength) {
      text += `\n\n${hashtags}`;
    }

    return text.substring(0, maxLength);
  }

  /**
   * Générer des hashtags à partir des catégories
   */
  private generateHashtags(article: ArticleWithConnections): string {
    const tags: string[] = ['#Tech', '#RevueTech'];
    
    if (article.categories) {
      for (const cat of article.categories.slice(0, 3)) {
        const tag = cat.category.name
          .replace(/[^a-zA-Z0-9À-ÿ]/g, '')
          .replace(/\s+/g, '');
        if (tag) {
          tags.push(`#${tag}`);
        }
      }
    }

    return tags.join(' ');
  }

  // ===========================================
  // TWITTER / X
  // ===========================================

  private async postToTwitter(
    accessToken: string,
    text: string,
    url: string
  ): Promise<{ postId: string; postUrl: string }> {
    const response = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: `${text}\n\n${url}`,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Twitter API error: ${error.detail || error.title || 'Unknown'}`);
    }

    const data = await response.json();
    return {
      postId: data.data.id,
      postUrl: `https://twitter.com/i/web/status/${data.data.id}`,
    };
  }

  // ===========================================
  // FACEBOOK
  // ===========================================

  private async postToFacebook(
    accessToken: string,
    text: string,
    url: string
  ): Promise<{ postId: string; postUrl: string }> {
    // Récupérer l'ID de la page
    const meResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`
    );
    
    if (!meResponse.ok) {
      throw new Error('Failed to get Facebook pages');
    }

    const pages = await meResponse.json();
    if (!pages.data || pages.data.length === 0) {
      throw new Error('No Facebook pages found');
    }

    const page = pages.data[0];
    const pageAccessToken = page.access_token;
    const pageId = page.id;

    // Publier sur la page
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${pageId}/feed`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: text,
          link: url,
          access_token: pageAccessToken,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Facebook API error: ${error.error?.message || 'Unknown'}`);
    }

    const data = await response.json();
    return {
      postId: data.id,
      postUrl: `https://facebook.com/${data.id}`,
    };
  }

  // ===========================================
  // LINKEDIN
  // ===========================================

  private async postToLinkedIn(
    accessToken: string,
    text: string,
    url: string,
    article: ArticleWithConnections
  ): Promise<{ postId: string; postUrl: string }> {
    // Récupérer l'ID du profil
    const profileResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!profileResponse.ok) {
      throw new Error('Failed to get LinkedIn profile');
    }

    const profile = await profileResponse.json();
    const authorUrn = `urn:li:person:${profile.sub}`;

    // Créer le post avec article
    const postBody = {
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: text,
          },
          shareMediaCategory: 'ARTICLE',
          media: [
            {
              status: 'READY',
              originalUrl: url,
              title: {
                text: article.title,
              },
              description: {
                text: article.excerpt || article.title,
              },
            },
          ],
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    };

    const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(postBody),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`LinkedIn API error: ${error.message || 'Unknown'}`);
    }

    const data = await response.json();
    const postId = data.id;
    // LinkedIn ne retourne pas directement l'URL du post
    const postUrl = `https://www.linkedin.com/feed/update/${postId}`;

    return { postId, postUrl };
  }

  // ===========================================
  // BLUESKY
  // ===========================================

  private async postToBluesky(
    credentials: string, // Format: "handle:app-password"
    text: string,
    url: string
  ): Promise<{ postId: string; postUrl: string }> {
    const [handle, appPassword] = credentials.split(':');
    
    // Créer une session
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
      throw new Error('Failed to authenticate with Bluesky');
    }

    const session = await sessionResponse.json();

    // Créer le post avec la facet pour le lien
    const fullText = `${text}\n\n${url}`;
    const linkStart = fullText.indexOf(url);
    const linkEnd = linkStart + url.length;

    const postResponse = await fetch(
      'https://bsky.social/xrpc/com.atproto.repo.createRecord',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.accessJwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repo: session.did,
          collection: 'app.bsky.feed.post',
          record: {
            $type: 'app.bsky.feed.post',
            text: fullText,
            facets: [
              {
                index: {
                  byteStart: Buffer.from(fullText.substring(0, linkStart)).length,
                  byteEnd: Buffer.from(fullText.substring(0, linkEnd)).length,
                },
                features: [
                  {
                    $type: 'app.bsky.richtext.facet#link',
                    uri: url,
                  },
                ],
              },
            ],
            createdAt: new Date().toISOString(),
          },
        }),
      }
    );

    if (!postResponse.ok) {
      const error = await postResponse.json();
      throw new Error(`Bluesky API error: ${error.message || 'Unknown'}`);
    }

    const postData = await postResponse.json();
    const rkey = postData.uri.split('/').pop();
    
    return {
      postId: postData.uri,
      postUrl: `https://bsky.app/profile/${handle}/post/${rkey}`,
    };
  }

  // ===========================================
  // OAUTH UTILITIES
  // ===========================================

  /**
   * Générer l'URL d'autorisation OAuth pour une plateforme
   */
  getAuthUrl(platform: SocialPlatform, redirectUri: string, state: string): string {
    switch (platform) {
      case SocialPlatform.TWITTER:
        return this.getTwitterAuthUrl(redirectUri, state);
      case SocialPlatform.FACEBOOK:
        return this.getFacebookAuthUrl(redirectUri, state);
      case SocialPlatform.LINKEDIN:
        return this.getLinkedInAuthUrl(redirectUri, state);
      default:
        throw new Error(`OAuth not supported for ${platform}`);
    }
  }

  private getTwitterAuthUrl(redirectUri: string, state: string): string {
    if (!this.config.twitter) throw new Error('Twitter not configured');
    
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.twitter.clientId,
      redirect_uri: redirectUri,
      scope: 'tweet.read tweet.write users.read offline.access',
      state,
      code_challenge: 'challenge', // En prod, utiliser PKCE
      code_challenge_method: 'plain',
    });

    return `https://twitter.com/i/oauth2/authorize?${params}`;
  }

  private getFacebookAuthUrl(redirectUri: string, state: string): string {
    if (!this.config.facebook) throw new Error('Facebook not configured');

    const params = new URLSearchParams({
      client_id: this.config.facebook.appId,
      redirect_uri: redirectUri,
      scope: 'pages_manage_posts,pages_read_engagement',
      state,
    });

    return `https://www.facebook.com/v18.0/dialog/oauth?${params}`;
  }

  private getLinkedInAuthUrl(redirectUri: string, state: string): string {
    if (!this.config.linkedin) throw new Error('LinkedIn not configured');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.linkedin.clientId,
      redirect_uri: redirectUri,
      scope: 'openid profile w_member_social',
      state,
    });

    return `https://www.linkedin.com/oauth/v2/authorization?${params}`;
  }

  /**
   * Échanger un code OAuth contre un access token
   */
  async exchangeCode(
    platform: SocialPlatform,
    code: string,
    redirectUri: string
  ): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
    accountId: string;
    accountName: string;
    accountUrl?: string;
    accountImage?: string;
  }> {
    switch (platform) {
      case SocialPlatform.TWITTER:
        return this.exchangeTwitterCode(code, redirectUri);
      case SocialPlatform.FACEBOOK:
        return this.exchangeFacebookCode(code, redirectUri);
      case SocialPlatform.LINKEDIN:
        return this.exchangeLinkedInCode(code, redirectUri);
      default:
        throw new Error(`OAuth not supported for ${platform}`);
    }
  }

  private async exchangeTwitterCode(code: string, redirectUri: string) {
    if (!this.config.twitter) throw new Error('Twitter not configured');

    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(
          `${this.config.twitter.clientId}:${this.config.twitter.clientSecret}`
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code_verifier: 'challenge',
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json();
      throw new Error(`Twitter token error: ${error.error_description || error.error}`);
    }

    const tokens = await tokenResponse.json();

    // Récupérer les infos du compte
    const userResponse = await fetch('https://api.twitter.com/2/users/me?user.fields=profile_image_url', {
      headers: { 'Authorization': `Bearer ${tokens.access_token}` },
    });

    const user = await userResponse.json();

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
      accountId: user.data.id,
      accountName: `@${user.data.username}`,
      accountUrl: `https://twitter.com/${user.data.username}`,
      accountImage: user.data.profile_image_url,
    };
  }

  private async exchangeFacebookCode(code: string, redirectUri: string) {
    if (!this.config.facebook) throw new Error('Facebook not configured');

    const tokenResponse = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token?` +
      `client_id=${this.config.facebook.appId}&` +
      `client_secret=${this.config.facebook.appSecret}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `code=${code}`
    );

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json();
      throw new Error(`Facebook token error: ${error.error?.message}`);
    }

    const tokens = await tokenResponse.json();

    // Récupérer les infos de la page
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?access_token=${tokens.access_token}`
    );
    const pages = await pagesResponse.json();
    const page = pages.data?.[0];

    if (!page) {
      throw new Error('No Facebook page found. You need a Facebook Page to share.');
    }

    return {
      accessToken: tokens.access_token,
      expiresIn: tokens.expires_in,
      accountId: page.id,
      accountName: page.name,
      accountUrl: `https://facebook.com/${page.id}`,
    };
  }

  private async exchangeLinkedInCode(code: string, redirectUri: string) {
    if (!this.config.linkedin) throw new Error('LinkedIn not configured');

    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: this.config.linkedin.clientId,
        client_secret: this.config.linkedin.clientSecret,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json();
      throw new Error(`LinkedIn token error: ${error.error_description}`);
    }

    const tokens = await tokenResponse.json();

    // Récupérer les infos du profil
    const profileResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { 'Authorization': `Bearer ${tokens.access_token}` },
    });
    const profile = await profileResponse.json();

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
      accountId: profile.sub,
      accountName: profile.name,
      accountUrl: `https://linkedin.com/in/${profile.sub}`,
      accountImage: profile.picture,
    };
  }
}

export const createSocialService = (
  prisma: PrismaClient,
  config: SocialConfig,
  siteUrl: string
): SocialService => {
  return new SocialService(prisma, config, siteUrl);
};
