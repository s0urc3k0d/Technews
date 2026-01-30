// ===========================================
// Service Newsletter IA (Mistral)
// ===========================================

import { PrismaClient, ArticleStatus } from '@prisma/client';

interface MistralResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

interface ArticleForSelection {
  id: string;
  title: string;
  excerpt: string | null;
  categories: Array<{ name: string }>;
  viewCount: number;
  publishedAt: Date | null;
}

interface NewsletterContent {
  subject: string;
  previewText: string;
  selectedArticleIds: string[];
  htmlContent: string;
}

export class NewsletterAIService {
  private prisma: PrismaClient;
  private apiKey: string;
  private siteUrl: string;

  constructor(prisma: PrismaClient, apiKey: string, siteUrl: string) {
    this.prisma = prisma;
    this.apiKey = apiKey;
    this.siteUrl = siteUrl;
  }

  async generateDailyNewsletter(): Promise<NewsletterContent | null> {
    // Get articles published today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const articles = await this.prisma.article.findMany({
      where: {
        status: ArticleStatus.PUBLISHED,
        publishedAt: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: {
        categories: {
          include: {
            category: true,
          },
        },
      },
      orderBy: { viewCount: 'desc' },
      take: 20, // Get top 20 for AI selection
    });

    if (articles.length === 0) {
      return null;
    }

    // Format articles for AI
    const articlesForAI: ArticleForSelection[] = articles.map(a => ({
      id: a.id,
      title: a.title,
      excerpt: a.excerpt,
      categories: a.categories.map(c => ({ name: c.category.name })),
      viewCount: a.viewCount,
      publishedAt: a.publishedAt,
    }));

    // Call Mistral API for selection
    const selectedIds = await this.selectArticlesWithAI(articlesForAI);

    // Get full articles
    const selectedArticles = await this.prisma.article.findMany({
      where: { id: { in: selectedIds } },
      include: {
        categories: {
          include: { category: true },
        },
      },
    });

    // Generate newsletter content
    const subject = await this.generateSubject(selectedArticles);
    const htmlContent = this.generateHtmlContent(selectedArticles);

    return {
      subject,
      previewText: `${selectedArticles.length} articles sélectionnés pour vous`,
      selectedArticleIds: selectedIds,
      htmlContent,
    };
  }

  private async selectArticlesWithAI(articles: ArticleForSelection[]): Promise<string[]> {
    if (!this.apiKey) {
      // Fallback: select top 5-7 by view count
      return articles.slice(0, Math.min(7, articles.length)).map(a => a.id);
    }

    const prompt = `Tu es un éditeur de newsletter tech. Sélectionne les 5 à 7 articles les plus pertinents et diversifiés pour une newsletter quotidienne.

Critères de sélection:
- Pertinence et actualité
- Diversité thématique (éviter de répéter les mêmes catégories)
- Potentiel d'engagement

Articles disponibles:
${articles.map((a, i) => `${i + 1}. [ID: ${a.id}] ${a.title} - Catégories: ${a.categories.map(c => c.name).join(', ')} - Vues: ${a.viewCount}`).join('\n')}

Réponds UNIQUEMENT avec les IDs des articles sélectionnés, séparés par des virgules. Exemple: id1,id2,id3,id4,id5`;

    try {
      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'mistral-small-latest',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 200,
        }),
      });

      if (!response.ok) {
        throw new Error(`Mistral API error: ${response.status}`);
      }

      const data = await response.json() as MistralResponse;
      const content = data.choices[0]?.message?.content || '';
      
      // Parse IDs from response
      const ids = content
        .split(',')
        .map(id => id.trim())
        .filter(id => articles.some(a => a.id === id));

      if (ids.length >= 3) {
        return ids;
      }
    } catch (err) {
      console.error('Mistral API error:', err);
    }

    // Fallback
    return articles.slice(0, Math.min(5, articles.length)).map(a => a.id);
  }

  private async generateSubject(articles: Array<{ title: string }>): Promise<string> {
    if (!this.apiKey || articles.length === 0) {
      const today = new Date().toLocaleDateString('fr-FR', { 
        day: 'numeric', 
        month: 'long' 
      });
      return `TechNews du ${today} - ${articles.length} actus tech`;
    }

    const prompt = `Génère un objet d'email accrocheur pour une newsletter tech contenant ces articles:
${articles.slice(0, 3).map(a => `- ${a.title}`).join('\n')}

L'objet doit:
- Faire moins de 60 caractères
- Être en français
- Être accrocheur et informatif
- Ne pas contenir d'emoji

Réponds UNIQUEMENT avec l'objet, sans guillemets.`;

    try {
      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'mistral-small-latest',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 100,
        }),
      });

      if (response.ok) {
        const data = await response.json() as MistralResponse;
        const subject = data.choices[0]?.message?.content?.trim();
        if (subject && subject.length <= 70) {
          return subject;
        }
      }
    } catch (err) {
      console.error('Subject generation error:', err);
    }

    // Fallback
    const today = new Date().toLocaleDateString('fr-FR', { 
      day: 'numeric', 
      month: 'long' 
    });
    return `TechNews du ${today}`;
  }

  private generateHtmlContent(
    articles: Array<{
      id: string;
      title: string;
      slug: string;
      excerpt: string | null;
      featuredImage: string | null;
      categories: Array<{ category: { name: string; color: string | null } }>;
    }>
  ): string {
    const articleCards = articles.map(article => {
      const categoryBadges = article.categories
        .slice(0, 2)
        .map(c => `<span style="background-color: ${c.category.color || '#6366f1'}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-right: 4px;">${c.category.name}</span>`)
        .join('');

      const imageUrl = article.featuredImage 
        ? `${this.siteUrl}${article.featuredImage}` 
        : '';

      return `
        <div style="margin-bottom: 24px; border-bottom: 1px solid #eee; padding-bottom: 24px;">
          ${imageUrl ? `<img src="${imageUrl}" alt="${article.title}" style="width: 100%; max-height: 200px; object-fit: cover; border-radius: 8px; margin-bottom: 12px;">` : ''}
          <div style="margin-bottom: 8px;">${categoryBadges}</div>
          <h3 style="margin: 0 0 8px 0; font-size: 18px;">
            <a href="${this.siteUrl}/articles/${article.slug}" style="color: #1a1a1a; text-decoration: none;">${article.title}</a>
          </h3>
          <p style="color: #666; font-size: 14px; margin: 0 0 12px 0;">${article.excerpt || ''}</p>
          <a href="${this.siteUrl}/articles/${article.slug}" style="color: #0ea5e9; font-size: 14px; text-decoration: none; font-weight: 500;">Lire l'article →</a>
        </div>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
        <div style="background-color: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #0ea5e9; margin: 0; font-size: 28px;">TechNews</h1>
            <p style="color: #666; margin: 8px 0 0 0;">Votre dose quotidienne d'actualités tech</p>
          </div>
          
          <p style="font-size: 16px;">Bonjour {{firstName}} ! 👋</p>
          
          <p>Voici les ${articles.length} articles sélectionnés pour vous aujourd'hui :</p>
          
          <div style="margin-top: 24px;">
            ${articleCards}
          </div>
          
          <div style="text-align: center; margin-top: 32px;">
            <a href="${this.siteUrl}" style="background-color: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
              Voir tous les articles
            </a>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

export const createNewsletterAIService = (
  prisma: PrismaClient,
  apiKey: string | undefined,
  siteUrl: string
): NewsletterAIService => {
  return new NewsletterAIService(prisma, apiKey || '', siteUrl);
};
