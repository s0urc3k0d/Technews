// ===========================================
// Service RSS Parser - TechPulse Integration
// ===========================================

import Parser from 'rss-parser';
import { PrismaClient, ArticleStatus, ArticleSource } from '@prisma/client';

// Interface étendue pour TechPulse RSS
interface TechPulseItem {
  title?: string;
  link?: string;
  content?: string;
  contentSnippet?: string;
  'content:encoded'?: string;
  pubDate?: string;
  categories?: string[];
  category?: string;  // TechPulse utilise un seul champ category
  creator?: string;
  guid?: string;
  source?: {
    url?: string;
    name?: string;
  };
  // Champs personnalisés TechPulse
  'techpulse:originalTitle'?: string;
  'techpulse:savedAt'?: string;
  'techpulse:savedBy'?: string;
}

interface ParseResult {
  success: boolean;
  imported: number;
  skipped: number;
  updated: number;
  errors: string[];
}

// Mapping des catégories TechPulse vers les catégories RevueTech
const CATEGORY_MAPPING: Record<string, string> = {
  'Cybersécurité': 'securite',
  'Science & Espace': 'science',
  'Software & Apps': 'logiciels',
  'Mobile & Telecom': 'mobile',
  'Hardware': 'hardware',
  'Gaming': 'gaming',
  'IA & Machine Learning': 'ia',
  'Cloud & DevOps': 'cloud',
  'Blockchain & Crypto': 'blockchain',
  'Startup & Business': 'business',
};

export class RSSParserService {
  private parser: Parser<any, TechPulseItem>;
  private prisma: PrismaClient;
  private feedUrl: string;

  constructor(prisma: PrismaClient, feedUrl: string) {
    this.parser = new Parser({
      customFields: {
        item: [
          ['content:encoded', 'content:encoded'],
          ['category', 'category'],
          ['source', 'source'],
          ['techpulse:originalTitle', 'techpulse:originalTitle'],
          ['techpulse:savedAt', 'techpulse:savedAt'],
          ['techpulse:savedBy', 'techpulse:savedBy'],
        ],
      },
    });
    this.prisma = prisma;
    this.feedUrl = feedUrl;
  }

  async parseFeed(): Promise<ParseResult> {
    const result: ParseResult = {
      success: false,
      imported: 0,
      skipped: 0,
      updated: 0,
      errors: [],
    };

    try {
      console.log(`[RSS] Fetching feed from: ${this.feedUrl}`);
      const feed = await this.parser.parseURL(this.feedUrl);
      console.log(`[RSS] Found ${feed.items.length} items in feed`);

      for (const item of feed.items) {
        try {
          const importResult = await this.importItem(item);
          if (importResult === 'imported') {
            result.imported++;
          } else if (importResult === 'updated') {
            result.updated++;
          } else {
            result.skipped++;
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          result.errors.push(`Failed to import "${item.title}": ${message}`);
          console.error(`[RSS] Error importing item:`, err);
        }
      }

      result.success = true;
      console.log(`[RSS] Import complete: ${result.imported} new, ${result.updated} updated, ${result.skipped} skipped`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      result.errors.push(`Failed to fetch feed: ${message}`);
      console.error('[RSS] Error fetching feed:', err);
    }

    return result;
  }

  private async importItem(item: TechPulseItem): Promise<'imported' | 'updated' | 'skipped'> {
    if (!item.link || !item.title) {
      return 'skipped';
    }

    // Vérifier si l'article existe déjà (par sourceUrl)
    const existing = await this.prisma.article.findUnique({
      where: { sourceUrl: item.link },
    });

    if (existing) {
      // Si l'article existe et est en brouillon, on peut le mettre à jour
      if (existing.status === ArticleStatus.DRAFT) {
        await this.updateExistingArticle(existing.id, item);
        return 'updated';
      }
      return 'skipped'; // Skip published/archived articles
    }

    // Générer le slug
    const slug = this.generateSlug(item.title);
    let finalSlug = slug;
    let counter = 1;
    while (await this.prisma.article.findUnique({ where: { slug: finalSlug } })) {
      finalSlug = `${slug}-${counter}`;
      counter++;
    }

    // Extraire le contenu
    const rawContent = item['content:encoded'] || item.content || item.contentSnippet || '';
    const content = this.cleanContent(rawContent);
    const excerpt = this.generateExcerpt(item.contentSnippet || content);

    // Extraire la source
    const sourceName = this.extractSourceName(item);

    // Créer l'article en brouillon
    const article = await this.prisma.article.create({
      data: {
        title: item.title,
        slug: finalSlug,
        content,
        excerpt,
        status: ArticleStatus.DRAFT,
        source: ArticleSource.RSS,
        sourceUrl: item.link,
        sourceName,
        publishedAt: item.pubDate ? new Date(item.pubDate) : null,
      },
    });

    // Associer la catégorie si elle existe
    await this.assignCategory(article.id, item.category);

    return 'imported';
  }

  private async updateExistingArticle(articleId: string, item: TechPulseItem): Promise<void> {
    const rawContent = item['content:encoded'] || item.content || item.contentSnippet || '';
    const content = this.cleanContent(rawContent);
    const excerpt = this.generateExcerpt(item.contentSnippet || content);

    await this.prisma.article.update({
      where: { id: articleId },
      data: {
        content,
        excerpt,
        publishedAt: item.pubDate ? new Date(item.pubDate) : undefined,
      },
    });
  }

  private async assignCategory(articleId: string, categoryName?: string): Promise<void> {
    if (!categoryName) return;

    // Trouver le slug de catégorie correspondant
    const categorySlug = CATEGORY_MAPPING[categoryName];
    if (!categorySlug) {
      console.log(`[RSS] Unknown category: ${categoryName}`);
      return;
    }

    // Chercher ou créer la catégorie
    let category = await this.prisma.category.findUnique({
      where: { slug: categorySlug },
    });

    if (!category) {
      // Créer la catégorie si elle n'existe pas
      category = await this.prisma.category.create({
        data: {
          name: categoryName,
          slug: categorySlug,
        },
      });
    }

    // Associer l'article à la catégorie
    await this.prisma.categoriesOnArticles.create({
      data: {
        articleId,
        categoryId: category.id,
      },
    }).catch(() => {
      // Ignore si déjà associé
    });
  }

  private extractSourceName(item: TechPulseItem): string {
    // Priorité: source.name > URL hostname
    if (item.source && typeof item.source === 'object') {
      // Le source peut être un string ou un objet
      const sourceUrl = (item.source as any).url || (item.source as any).$ || '';
      if (sourceUrl) {
        try {
          return new URL(sourceUrl).hostname.replace('www.', '');
        } catch {
          return 'TechPulse';
        }
      }
    }
    
    if (item.link) {
      try {
        return new URL(item.link).hostname.replace('www.', '');
      } catch {
        return 'TechPulse';
      }
    }
    
    return 'TechPulse';
  }

  private cleanContent(content: string): string {
    // Supprimer le footer TechPulse ajouté automatiquement
    let cleaned = content.replace(/<hr\s*\/?><p><small>[\s\S]*?<\/small><\/p>/gi, '');
    
    // Supprimer les balises [object Object] (bug TechPulse)
    cleaned = cleaned.replace(/\[object Object\]/g, '');
    
    // Nettoyer les entités HTML mal encodées
    cleaned = cleaned
      .replace(/&amp;#039;/g, "'")
      .replace(/&amp;quot;/g, '"')
      .replace(/&amp;amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
    
    return cleaned.trim();
  }

  private generateExcerpt(text: string): string {
    // Supprimer le HTML
    const stripped = text.replace(/<[^>]*>/g, '');
    
    // Limiter à 300 caractères
    if (stripped.length <= 300) {
      return stripped;
    }
    
    // Couper au dernier mot complet
    const truncated = stripped.substring(0, 300);
    const lastSpace = truncated.lastIndexOf(' ');
    return (lastSpace > 200 ? truncated.substring(0, lastSpace) : truncated) + '...';
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 100);
  }
}

export const createRSSParserService = (
  prisma: PrismaClient,
  feedUrl: string
): RSSParserService => {
  return new RSSParserService(prisma, feedUrl);
};

// URL par défaut du feed TechPulse
export const DEFAULT_RSS_FEED_URL = 'https://techpulse.sourcekod.fr/api/feeds/all.xml';
