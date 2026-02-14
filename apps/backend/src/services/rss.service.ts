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
  private maxAgeDays: number;

  constructor(prisma: PrismaClient, feedUrl: string, maxAgeDays = 10) {
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
    this.maxAgeDays = Math.max(1, maxAgeDays);
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

      const oldestAllowedDate = new Date();
      oldestAllowedDate.setDate(oldestAllowedDate.getDate() - this.maxAgeDays);

      for (const item of feed.items) {
        try {
          const itemDate = this.extractItemDate(item);
          if (!itemDate || itemDate < oldestAllowedDate) {
            result.skipped++;
            continue;
          }

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

    const normalizedSourceUrl = this.normalizeSourceUrl(item.link);
    const sourceName = this.extractSourceName(item);
    const itemDate = this.extractItemDate(item);

    // Vérifier si l'article existe déjà (URL canonique, URL brute, fallback titre/source/date)
    let existing = await this.prisma.article.findFirst({
      where: {
        OR: [
          { sourceUrl: normalizedSourceUrl },
          { sourceUrl: item.link },
        ],
      },
    });

    if (!existing && itemDate) {
      const dayStart = new Date(itemDate);
      dayStart.setUTCHours(0, 0, 0, 0);
      const dayEnd = new Date(itemDate);
      dayEnd.setUTCHours(23, 59, 59, 999);

      existing = await this.prisma.article.findFirst({
        where: {
          source: ArticleSource.RSS,
          title: item.title,
          sourceName,
          publishedAt: {
            gte: dayStart,
            lte: dayEnd,
          },
        },
      });
    }

    if (existing) {
      // Si l'article existe et est en brouillon, on peut le mettre à jour
      if (existing.status === ArticleStatus.DRAFT) {
        await this.updateExistingArticle(existing.id, item, normalizedSourceUrl, sourceName);
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
    const featuredImage = this.extractFirstImageUrl(rawContent);

    // Créer l'article en brouillon
    const article = await this.prisma.article.create({
      data: {
        title: item.title,
        slug: finalSlug,
        content,
        excerpt,
        status: ArticleStatus.DRAFT,
        source: ArticleSource.RSS,
        sourceUrl: normalizedSourceUrl,
        sourceName,
        featuredImage,
        publishedAt: itemDate,
      },
    });

    // Associer la catégorie si elle existe
    await this.assignCategory(article.id, item.category);

    return 'imported';
  }

  private async updateExistingArticle(
    articleId: string,
    item: TechPulseItem,
    normalizedSourceUrl: string,
    sourceName: string
  ): Promise<void> {
    const rawContent = item['content:encoded'] || item.content || item.contentSnippet || '';
    const content = this.cleanContent(rawContent);
    const excerpt = this.generateExcerpt(item.contentSnippet || content);
    const itemDate = this.extractItemDate(item);
    const featuredImage = this.extractFirstImageUrl(rawContent);

    await this.prisma.article.update({
      where: { id: articleId },
      data: {
        content,
        excerpt,
        sourceUrl: normalizedSourceUrl,
        sourceName,
        featuredImage: featuredImage || undefined,
        publishedAt: itemDate ?? undefined,
      },
    });
  }

  private extractFirstImageUrl(html: string): string | null {
    if (!html) return null;
    const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (!match?.[1]) return null;

    const src = match[1].trim();
    if (!/^https?:\/\//i.test(src)) return null;
    return src;
  }

  private extractItemDate(item: TechPulseItem): Date | null {
    const candidates = [item.pubDate, item['techpulse:savedAt']].filter(Boolean) as string[];
    for (const value of candidates) {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    return null;
  }

  private normalizeSourceUrl(rawUrl: string): string {
    try {
      const url = new URL(rawUrl.trim());
      const stripParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'];
      for (const key of stripParams) {
        url.searchParams.delete(key);
      }
      url.hash = '';
      const normalizedPath = url.pathname.replace(/\/$/, '');
      url.pathname = normalizedPath || '/';
      return url.toString();
    } catch {
      return rawUrl.trim();
    }
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
  feedUrl: string,
  maxAgeDays = 10
): RSSParserService => {
  return new RSSParserService(prisma, feedUrl, maxAgeDays);
};

// URL par défaut du feed TechPulse
export const DEFAULT_RSS_FEED_URL = 'https://techpulse.sourcekod.fr/api/feeds/all.xml';
