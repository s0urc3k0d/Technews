import { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createImageService } from './image.service.js';

interface AutoPublishConfig {
  prisma: PrismaClient;
  redis: Redis;
  mistralApiKey?: string;
  mistralImageEndpoint?: string;
  uploadPath: string;
  siteUrl: string;
  lookbackHours: number;
  intervalMinMinutes: number;
  intervalMaxMinutes: number;
  dryRun: boolean;
}

interface CandidateArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  featuredImage: string | null;
  sourceUrl: string | null;
  sourceName: string | null;
  status: 'DRAFT' | 'PRE_PUBLISHED' | 'PUBLISHED' | 'SCHEDULED' | 'REJECTED' | 'ARCHIVED';
  type: 'STANDARD' | 'PODCAST';
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  viewCount: number;
  categories: Array<{ category: { id: string; name: string; slug: string } }>;
}

interface GeneratedArticlePayload {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  metaTitle: string;
  metaDescription: string;
  categoryId: string;
  tagIds: string[];
}

interface AutoPublishResult {
  success: boolean;
  status: 'pre-published' | 'dry-run' | 'skipped' | 'failed';
  reason?: string;
  articleId?: string;
  articleTitle?: string;
  cooldownUntil?: Date;
  details?: Record<string, unknown>;
}

interface AutoPublishRunOptions {
  ignoreCooldown?: boolean;
  setCooldown?: boolean;
}

interface GeneratedImageResult {
  buffer: Buffer | null;
  source: 'mistral' | 'fallback' | 'none';
  failureReason?: string;
}

const ARTICLE_PROMPT_PATH = path.join(process.cwd(), 'assets', 'prompt-article.txt');
const IMAGE_PROMPT_PATH = path.join(process.cwd(), 'assets', 'prompt-image.txt');
const REDIS_COOLDOWN_KEY = 'autopublish:next_allowed_at';
const MIN_ARTICLE_TEXT_LENGTH = 2200;
const MIN_H2_SECTIONS = 6;

const generatedPayloadSchema = z.object({
  title: z.string().min(8).max(255),
  slug: z.string().min(3).max(120),
  excerpt: z.string().min(30).max(300),
  content: z.string().min(300),
  metaTitle: z.string().min(10).max(60),
  metaDescription: z.string().min(30).max(160),
  category: z.string().min(1),
  tags: z.array(z.string()).max(8).optional().default([]),
});

type GeneratedPayloadRaw = z.infer<typeof generatedPayloadSchema>;

const stripHtml = (value: string): string => value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const countH2Sections = (value: string): number => {
  const matches = value.match(/<h2\b[^>]*>/gi);
  return matches ? matches.length : 0;
};

const slugify = (value: string, max = 30): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');

const extractJsonObject = (value: string): Record<string, unknown> | null => {
  const fenced = value.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] || value;
  const first = candidate.indexOf('{');
  const last = candidate.lastIndexOf('}');

  if (first === -1 || last === -1 || last <= first) {
    return null;
  }

  try {
    return JSON.parse(candidate.slice(first, last + 1));
  } catch {
    return null;
  }
};

const PROMOTIONAL_PATTERNS: RegExp[] = [
  /\bpromo(?:tion)?\b/i,
  /\bbon\s*plan\b/i,
  /\bdeal\b/i,
  /\bcode\s*promo\b/i,
  /\bblack\s*friday\b/i,
  /\bprime\s*day\b/i,
  /\bmeilleur(?:s)?\b/i,
  /\btop\s*\d+\b/i,
  /\bcomparatif\b/i,
  /\bvs\b/i,
  /\bface\s*[àa]\s*face\b/i,
  /\bbest\b/i,
  /\bprice\b/i,
  /\bdiscount\b/i,
  /\bbuy\b/i,
  /\baffiliate\b/i,
  /\bsponsoris[ée]\b/i,
  /\bpartenariat\b/i,
];

export class AutoPublishService {
  private readonly prisma: PrismaClient;
  private readonly redis: Redis;
  private readonly mistralApiKey: string;
  private readonly mistralImageEndpoint: string;
  private readonly uploadPath: string;
  private readonly siteUrl: string;
  private readonly lookbackHours: number;
  private readonly intervalMinMinutes: number;
  private readonly intervalMaxMinutes: number;
  private readonly dryRun: boolean;

  constructor(config: AutoPublishConfig) {
    this.prisma = config.prisma;
    this.redis = config.redis;
    this.mistralApiKey = config.mistralApiKey || '';
    this.mistralImageEndpoint = config.mistralImageEndpoint || 'https://api.mistral.ai/v1/images/generations';
    this.uploadPath = config.uploadPath;
    this.siteUrl = config.siteUrl;
    this.lookbackHours = Math.max(1, config.lookbackHours);
    this.intervalMinMinutes = Math.max(30, config.intervalMinMinutes);
    this.intervalMaxMinutes = Math.max(this.intervalMinMinutes, config.intervalMaxMinutes);
    this.dryRun = config.dryRun;
  }

  async run(options: AutoPublishRunOptions = {}): Promise<AutoPublishResult> {
    const ignoreCooldown = options.ignoreCooldown ?? false;
    const setCooldown = options.setCooldown ?? true;

    const cooldownUntil = await this.getCooldownUntil();
    if (!ignoreCooldown && cooldownUntil && cooldownUntil.getTime() > Date.now()) {
      return {
        success: true,
        status: 'skipped',
        reason: 'cooldown_active',
        cooldownUntil,
      };
    }

    const candidate = await this.selectCandidate();
    if (!candidate) {
      return {
        success: true,
        status: 'skipped',
        reason: 'no_candidate',
      };
    }

    const duplicate = await this.detectDuplicate(candidate);
    if (duplicate) {
      if (setCooldown) {
        await this.setCooldown();
      }
      return {
        success: true,
        status: 'skipped',
        reason: 'duplicate_candidate',
        articleId: candidate.id,
        articleTitle: candidate.title,
        details: { duplicateArticleId: duplicate.id, duplicateSlug: duplicate.slug },
        cooldownUntil: setCooldown ? (await this.getCooldownUntil()) || undefined : undefined,
      };
    }

    if (!this.mistralApiKey) {
      return {
        success: false,
        status: 'failed',
        reason: 'missing_mistral_api_key',
        articleId: candidate.id,
      };
    }

    const generated = await this.generateArticlePayload(candidate);
    const generatedImage = await this.generateImageBuffer(generated, candidate);

    if (this.dryRun) {
      if (setCooldown) {
        await this.setCooldown();
      }
      return {
        success: true,
        status: 'dry-run',
        articleId: candidate.id,
        articleTitle: candidate.title,
        cooldownUntil: setCooldown ? (await this.getCooldownUntil()) || undefined : undefined,
        details: {
          generatedTitle: generated.title,
          generatedSlug: generated.slug,
          imageGenerated: Boolean(generatedImage.buffer),
          imageSource: generatedImage.source,
          imageFailureReason: generatedImage.failureReason,
        },
      };
    }

    const publishedArticle = await this.applyPublication(candidate, generated, generatedImage.buffer);
    if (setCooldown) {
      await this.setCooldown();
    }

    return {
      success: true,
      status: 'pre-published',
      articleId: publishedArticle.id,
      articleTitle: publishedArticle.title,
      cooldownUntil: setCooldown ? (await this.getCooldownUntil()) || undefined : undefined,
      details: {
        slug: publishedArticle.slug,
        sourceUrl: publishedArticle.sourceUrl,
        imageGenerated: Boolean(generatedImage.buffer),
        imageSource: generatedImage.source,
        imageFailureReason: generatedImage.failureReason,
      },
    };
  }

  private async selectCandidate(): Promise<CandidateArticle | null> {
    const now = Date.now();
    const minDate = new Date(now - this.lookbackHours * 60 * 60 * 1000);

    const drafts = await this.prisma.article.findMany({
      where: {
        status: 'DRAFT',
        source: 'RSS',
        createdAt: { gte: minDate },
      },
      include: {
        categories: {
          include: {
            category: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });

    if (drafts.length === 0) return null;

    const eligibleDrafts = drafts.filter((article: CandidateArticle) => !this.isPromotionalArticle(article));

    if (eligibleDrafts.length === 0) return null;

    const scored = eligibleDrafts.map((article: CandidateArticle) => {
      const ageHours = Math.max(0, (now - article.createdAt.getTime()) / (60 * 60 * 1000));
      const freshnessScore = Math.max(0, 40 - ageHours * 8);
      const contentLengthScore = Math.min(30, stripHtml(article.content || '').length / 120);
      const hasSourceScore = article.sourceUrl ? 12 : 0;
      const hasExcerptScore = article.excerpt ? 8 : 0;
      const categoryScore = article.categories.length > 0 ? 10 : 0;
      const viewScore = Math.min(10, article.viewCount / 10);
      const total = freshnessScore + contentLengthScore + hasSourceScore + hasExcerptScore + categoryScore + viewScore;

      return { article, score: total };
    });

    scored.sort((a: { score: number }, b: { score: number }) => b.score - a.score);
    return scored[0]?.article || null;
  }

  private async detectDuplicate(candidate: CandidateArticle): Promise<{ id: string; slug: string } | null> {
    const title = candidate.title.trim();

    if (candidate.sourceUrl) {
      const sameSource = await this.prisma.article.findFirst({
        where: {
          id: { not: candidate.id },
          status: { in: ['PUBLISHED', 'PRE_PUBLISHED'] as any },
          sourceUrl: candidate.sourceUrl,
        },
        select: { id: true, slug: true },
      });

      if (sameSource) return sameSource;
    }

    const recentThreshold = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const sameTitle = await this.prisma.article.findFirst({
      where: {
        id: { not: candidate.id },
        status: { in: ['PUBLISHED', 'PRE_PUBLISHED'] as any },
        title,
        sourceName: candidate.sourceName || undefined,
        createdAt: { gte: recentThreshold },
      },
      select: { id: true, slug: true },
    });

    return sameTitle || null;
  }

  private async generateArticlePayload(candidate: CandidateArticle): Promise<GeneratedArticlePayload> {
    const [articlePrompt, categories, existingTags] = await Promise.all([
      fs.readFile(ARTICLE_PROMPT_PATH, 'utf-8'),
      this.prisma.category.findMany({ orderBy: { order: 'asc' }, select: { id: true, name: true, slug: true } }),
      this.prisma.tag.findMany({ select: { id: true, name: true, slug: true } }),
    ]);

    const categoryList = categories
      .map((category: { id: string; name: string; slug: string }) => `- ${category.name} (slug: ${category.slug})`)
      .join('\n');

    const prompt = `${articlePrompt}

Contraintes de sortie strictes:
- Réponds UNIQUEMENT en JSON strict sans markdown
- Champs JSON attendus: title, slug, excerpt, content, metaTitle, metaDescription, category, tags
  - Tous les champs textuels DOIVENT être en français (aucun titre en anglais)
- slug < 30 caractères
- excerpt <= 300 caractères
- metaTitle <= 60 caractères
- metaDescription <= 160 caractères
  - content doit contenir des intertitres H2 en HTML (<h2>)
  - content doit contenir au moins ${MIN_ARTICLE_TEXT_LENGTH} caractères de texte utile (hors balises)
  - content doit proposer au minimum ${MIN_H2_SECTIONS} sections H2
  - chaque section doit apporter des éléments techniques concrets (implémentation, architecture, performances, sécurité, limites)

Catégories disponibles:
${categoryList}

Données source:
URL originale: ${candidate.sourceUrl || 'inconnue'}
Titre source: ${candidate.title}
Extrait source: ${candidate.excerpt || ''}
Contenu source (HTML):
${candidate.content}`;

    const response = await this.callMistralChat(prompt, 5200, 0.35);
    const validated = this.parseGeneratedPayload(response);
    const refined = await this.refineGeneratedPayload(candidate, validated);

    let targetSlug = slugify(refined.slug || refined.title, 30);
    if (!targetSlug) {
      targetSlug = slugify(refined.title, 30);
    }

    targetSlug = await this.ensureUniqueSlug(targetSlug, candidate.id);

    const selectedCategory = this.resolveCategory(categories, refined.category, candidate);

    const tagIds = this.resolveTagIds(existingTags, refined.tags || []);

    return {
      title: refined.title.trim(),
      slug: targetSlug,
      excerpt: refined.excerpt.trim().slice(0, 300),
      content: refined.content.trim(),
      metaTitle: refined.metaTitle.trim().slice(0, 60),
      metaDescription: refined.metaDescription.trim().slice(0, 160),
      categoryId: selectedCategory.id,
      tagIds,
    };
  }

  private parseGeneratedPayload(response: string): GeneratedPayloadRaw {
    const parsed = extractJsonObject(response);

    if (!parsed) {
      throw new Error('Invalid AI response: JSON object not found');
    }

    return generatedPayloadSchema.parse(parsed);
  }

  private async refineGeneratedPayload(
    candidate: CandidateArticle,
    draft: GeneratedPayloadRaw
  ): Promise<GeneratedPayloadRaw> {
    let refined = { ...draft };

    for (let pass = 1; pass <= 2; pass += 1) {
      const contentLength = stripHtml(refined.content).length;
      const h2Count = countH2Sections(refined.content);
      const needsExpansion = contentLength < MIN_ARTICLE_TEXT_LENGTH || h2Count < MIN_H2_SECTIONS;

      if (!needsExpansion) {
        break;
      }

      const expanded = await this.expandArticleInFrench(candidate, refined, {
        contentLength,
        h2Count,
        pass,
      });

      if (!expanded) {
        break;
      }

      refined = expanded;
    }

    if (!this.isLikelyFrench(refined.title)) {
      const translated = await this.translateTitleToFrench(candidate, refined);
      if (translated) {
        refined = translated;
      }
    }

    return refined;
  }

  private async expandArticleInFrench(
    candidate: CandidateArticle,
    current: GeneratedPayloadRaw,
    context: { contentLength: number; h2Count: number; pass: number }
  ): Promise<GeneratedPayloadRaw | null> {
    const prompt = `Tu es un éditeur web francophone. Tu dois enrichir l'article suivant en français.

Contraintes:
- Réponds UNIQUEMENT en JSON strict
- Conserve la même thématique et les mêmes faits
- Garde les champs: title, slug, excerpt, content, metaTitle, metaDescription, category, tags
- content en HTML avec au moins ${MIN_H2_SECTIONS} sections <h2>
- content doit contenir au minimum ${MIN_ARTICLE_TEXT_LENGTH} caractères de texte utile (hors balises)
- title, excerpt, content, metaTitle, metaDescription en français
- ajoute des détails techniques concrets dans chaque section (architecture, protocoles, performances, sécurité, trade-offs, limites)
- évite les sections courtes: chaque section doit contenir une explication substantielle

État actuel à corriger:
- longueur actuelle: ${context.contentLength} caractères
- sections H2 actuelles: ${context.h2Count}
- passe d'enrichissement: ${context.pass}

Article source (JSON):
${JSON.stringify(current)}

Contexte source:
- Titre original: ${candidate.title}
- URL originale: ${candidate.sourceUrl || 'inconnue'}`;

    try {
      const response = await this.callMistralChat(prompt, 5200, 0.35);
      const expanded = this.parseGeneratedPayload(response);
      if (
        stripHtml(expanded.content).length >= MIN_ARTICLE_TEXT_LENGTH
        && countH2Sections(expanded.content) >= MIN_H2_SECTIONS
      ) {
        return expanded;
      }

      return expanded;
    } catch {
      return null;
    }
  }

  private async translateTitleToFrench(
    candidate: CandidateArticle,
    current: GeneratedPayloadRaw
  ): Promise<GeneratedPayloadRaw | null> {
    const prompt = `Traduis et adapte ce titre en français naturel (style presse tech), puis renvoie UNIQUEMENT un JSON strict avec les champs title et metaTitle.

Contrainte:
- français uniquement
- garder le sens de l'article

Titre actuel: ${current.title}
Meta title actuel: ${current.metaTitle}
Titre source original: ${candidate.title}`;

    try {
      const response = await this.callMistralChat(prompt, 300, 0.2);
      const parsed = extractJsonObject(response);
      if (!parsed) return null;

      const translated = z.object({
        title: z.string().min(8).max(255),
        metaTitle: z.string().min(10).max(60),
      }).parse(parsed);

      return {
        ...current,
        title: translated.title.trim(),
        metaTitle: translated.metaTitle.trim(),
        slug: slugify(translated.title, 30) || current.slug,
      };
    } catch {
      return null;
    }
  }

  private isLikelyFrench(value: string): boolean {
    const normalized = ` ${value.toLowerCase()} `;

    const frenchTokens = [
      ' le ', ' la ', ' les ', ' des ', ' une ', ' un ', ' pour ', ' avec ', ' sur ', ' dans ', ' grâce ', ' français '
    ];
    const englishTokens = [
      ' the ', ' and ', ' with ', ' for ', ' from ', ' how ', ' why ', ' best ', ' update ', ' release '
    ];

    const frenchHits = frenchTokens.reduce((count, token) => count + (normalized.includes(token) ? 1 : 0), 0);
    const englishHits = englishTokens.reduce((count, token) => count + (normalized.includes(token) ? 1 : 0), 0);

    if (/[éèêàùçôîï]/i.test(value)) {
      return true;
    }

    return frenchHits >= englishHits;
  }

  private resolveCategory(
    categories: Array<{ id: string; name: string; slug: string }>,
    requestedCategory: string,
    candidate: CandidateArticle
  ): { id: string; name: string; slug: string } {
    const normalized = requestedCategory.toLowerCase().trim();

    const direct = categories.find(
      (category) => category.slug.toLowerCase() === normalized || category.name.toLowerCase() === normalized
    );
    if (direct) return direct;

    const byIncludes = categories.find(
      (category) =>
        normalized.includes(category.slug.toLowerCase()) ||
        normalized.includes(category.name.toLowerCase()) ||
        category.slug.toLowerCase().includes(normalized)
    );
    if (byIncludes) return byIncludes;

    const fromExisting = candidate.categories[0]?.category;
    if (fromExisting) {
      const found = categories.find((category) => category.id === fromExisting.id);
      if (found) return found;
    }

    const fallback = categories.find((category) => category.slug === 'developpement') || categories[0];
    if (!fallback) {
      throw new Error('No categories configured in database');
    }

    return fallback;
  }

  private resolveTagIds(
    existingTags: Array<{ id: string; name: string; slug: string }>,
    proposedTags: string[]
  ): string[] {
    const matched = new Set<string>();

    for (const rawTag of proposedTags) {
      const normalized = rawTag.trim().toLowerCase();
      if (!normalized) continue;

      const found = existingTags.find(
        (tag) => tag.slug.toLowerCase() === normalized || tag.name.toLowerCase() === normalized
      );

      if (found) {
        matched.add(found.id);
      }

      if (matched.size >= 5) break;
    }

    return Array.from(matched);
  }

  private async ensureUniqueSlug(baseSlug: string, currentArticleId: string): Promise<string> {
    let slug = baseSlug;
    let suffix = 1;

    while (true) {
      const conflict = await this.prisma.article.findFirst({
        where: {
          slug,
          id: { not: currentArticleId },
        },
        select: { id: true },
      });

      if (!conflict) {
        return slug;
      }

      suffix += 1;
      slug = slugify(`${baseSlug}-${suffix}`, 30);
    }
  }

  private async generateImageBuffer(
    generated: GeneratedArticlePayload,
    candidate: CandidateArticle
  ): Promise<GeneratedImageResult> {
    const imagePromptTemplate = await fs.readFile(IMAGE_PROMPT_PATH, 'utf-8');

    const imagePrompt = `${imagePromptTemplate}\n\nContexte de l'article:\nTitre: ${generated.title}\nChapeau: ${generated.excerpt}\nCorps:\n${stripHtml(generated.content).slice(0, 1400)}`;

    const mistralResult = await this.callMistralImage(imagePrompt);
    if (mistralResult.buffer) return { buffer: mistralResult.buffer, source: 'mistral' };

    if (!candidate.featuredImage) {
      return {
        buffer: null,
        source: 'none',
        failureReason: mistralResult.error || 'mistral_no_image_and_no_fallback',
      };
    }

    const fallbackUrl = this.resolveFeaturedImageUrl(candidate.featuredImage, candidate.sourceUrl);

    try {
      const fallbackBuffer = await this.fetchBinary(fallbackUrl);
      return { buffer: fallbackBuffer, source: 'fallback' };
    } catch (error) {
      const fallbackError = error instanceof Error ? error.message : 'fallback_fetch_failed';
      return {
        buffer: null,
        source: 'none',
        failureReason: mistralResult.error
          ? `${mistralResult.error}; fallback: ${fallbackError}`
          : `fallback: ${fallbackError}`,
      };
    }
  }

  private resolveFeaturedImageUrl(featuredImage: string, sourceUrl: string | null): string {
    if (featuredImage.startsWith('http://') || featuredImage.startsWith('https://')) {
      return featuredImage;
    }

    if (featuredImage.startsWith('/')) {
      if (sourceUrl) {
        try {
          const sourceOrigin = new URL(sourceUrl).origin;
          return `${sourceOrigin}${featuredImage}`;
        } catch {
        }
      }

      return `${this.siteUrl.replace(/\/$/, '')}${featuredImage}`;
    }

    if (sourceUrl) {
      try {
        return new URL(featuredImage, sourceUrl).toString();
      } catch {
      }
    }

    return `${this.siteUrl.replace(/\/$/, '')}/${featuredImage.replace(/^\/+/, '')}`;
  }

  private isPromotionalArticle(article: CandidateArticle): boolean {
    const haystack = [
      article.title,
      article.excerpt || '',
      stripHtml(article.content || ''),
      article.sourceUrl || '',
    ].join(' \n ');

    return PROMOTIONAL_PATTERNS.some((pattern) => pattern.test(haystack));
  }

  private async applyPublication(
    candidate: CandidateArticle,
    generated: GeneratedArticlePayload,
    imageBuffer: Buffer | null
  ) {
    const imageService = createImageService(this.uploadPath, 5);

    return this.prisma.$transaction(async (tx: any) => {
      await tx.categoriesOnArticles.deleteMany({ where: { articleId: candidate.id } });
      await tx.tagsOnArticles.deleteMany({ where: { articleId: candidate.id } });

      await tx.categoriesOnArticles.create({
        data: {
          articleId: candidate.id,
          categoryId: generated.categoryId,
        },
      });

      if (generated.tagIds.length > 0) {
        await tx.tagsOnArticles.createMany({
          data: generated.tagIds.map((tagId) => ({ articleId: candidate.id, tagId })),
          skipDuplicates: true,
        });
      }

      let featuredImage = candidate.featuredImage;

      if (imageBuffer) {
        const processedImage = await imageService.processImage(imageBuffer, `${generated.slug}.png`, 'webp');

        const createdImage = await tx.articleImage.create({
          data: {
            articleId: candidate.id,
            url: processedImage.url,
            thumbnail: processedImage.thumbnail,
            medium: processedImage.medium,
            alt: generated.title,
            caption: generated.excerpt,
            width: processedImage.width,
            height: processedImage.height,
            size: processedImage.size,
            mimeType: processedImage.mimeType,
            isPrimary: true,
          },
        });

        await tx.articleImage.updateMany({
          where: {
            articleId: candidate.id,
            id: { not: createdImage.id },
            isPrimary: true,
          },
          data: { isPrimary: false },
        });

        featuredImage = processedImage.url;
      }

      return tx.article.update({
        where: { id: candidate.id },
        data: {
          title: generated.title,
          slug: generated.slug,
          excerpt: generated.excerpt,
          content: generated.content,
          metaTitle: generated.metaTitle,
          metaDescription: generated.metaDescription,
          featuredImage: featuredImage || undefined,
          status: 'PRE_PUBLISHED' as any,
          publishedAt: null,
          source: 'RSS',
          shareOnPublish: false,
        },
      });
    });
  }

  private async callMistralChat(prompt: string, maxTokens = 2500, temperature = 0.2): Promise<string> {
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.mistralApiKey}`,
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (!response.ok) {
      throw new Error(`Mistral chat error: ${response.status}`);
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Mistral chat returned empty content');
    }

    return content;
  }

  private async callMistralImage(prompt: string): Promise<{ buffer: Buffer | null; error?: string }> {
    try {
      const response = await fetch(this.mistralImageEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.mistralApiKey}`,
        },
        body: JSON.stringify({
          model: 'mistral-image-latest',
          prompt,
          size: '1024x1024',
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        return {
          buffer: null,
          error: `mistral_image_http_${response.status}${errorBody ? `: ${errorBody.slice(0, 240)}` : ''}`,
        };
      }

      const data = (await response.json()) as {
        data?: Array<{ b64_json?: string; url?: string; image_base64?: string }>;
      };

      const imageData = data.data?.[0];
      if (!imageData) return { buffer: null, error: 'mistral_image_empty_data' };

      if (imageData.b64_json) {
        return { buffer: Buffer.from(imageData.b64_json, 'base64') };
      }

      if (imageData.image_base64) {
        return { buffer: Buffer.from(imageData.image_base64, 'base64') };
      }

      if (imageData.url) {
        return { buffer: await this.fetchBinary(imageData.url) };
      }

      return { buffer: null, error: 'mistral_image_no_supported_payload' };
    } catch (error) {
      return {
        buffer: null,
        error: error instanceof Error ? `mistral_image_exception: ${error.message}` : 'mistral_image_exception',
      };
    }
  }

  private async fetchBinary(url: string): Promise<Buffer> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'TechNewsBot/1.0 (+https://revuetech.fr)',
          Accept: 'image/*,*/*;q=0.8',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch binary (${response.status})`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async getCooldownUntil(): Promise<Date | null> {
    const value = await this.redis.get(REDIS_COOLDOWN_KEY);
    if (!value) return null;

    const timestamp = Number(value);
    if (!Number.isFinite(timestamp) || timestamp <= 0) return null;

    return new Date(timestamp);
  }

  private async setCooldown(): Promise<void> {
    const min = this.intervalMinMinutes;
    const max = this.intervalMaxMinutes;
    const nextMinutes = Math.floor(Math.random() * (max - min + 1)) + min;
    const nextTimestamp = Date.now() + nextMinutes * 60 * 1000;

    await this.redis.set(REDIS_COOLDOWN_KEY, String(nextTimestamp), 'EX', nextMinutes * 60 + 120);
  }
}

export const createAutoPublishService = (config: AutoPublishConfig): AutoPublishService => {
  return new AutoPublishService(config);
};
