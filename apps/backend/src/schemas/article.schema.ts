// ===========================================
// Schémas Zod pour les Articles
// ===========================================

import { z } from 'zod';

// Enums
export const ArticleType = z.enum(['STANDARD', 'PODCAST']);
export const ArticleStatus = z.enum(['DRAFT', 'PUBLISHED', 'SCHEDULED', 'REJECTED', 'ARCHIVED']);
export const ArticleSource = z.enum(['MANUAL', 'RSS']);

// Base article schema
export const articleBaseSchema = z.object({
  title: z.string().min(1).max(255),
  slug: z.string().min(1).max(255).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  excerpt: z.string().max(500).optional(),
  content: z.string().min(1),
  metaTitle: z.string().max(70).optional(),
  metaDescription: z.string().max(160).optional(),
  type: ArticleType.default('STANDARD'),
  status: ArticleStatus.default('DRAFT'),
  
  // Podcast fields
  youtubeUrl: z.string().url().optional().nullable(),
  spotifyUrl: z.string().url().optional().nullable(),
  applePodcastUrl: z.string().url().optional().nullable(),
  deezerUrl: z.string().url().optional().nullable(),
  podcastSummary: z.string().optional().nullable(),
  timestamps: z.string().optional().nullable(),
  
  // Featured
  isFeatured: z.boolean().default(false),
  
  // Categories & Tags
  categoryIds: z.array(z.string()).optional(),
  tagIds: z.array(z.string()).optional(),
  
  // Scheduling
  publishedAt: z.string().datetime().optional().nullable(),
});

// Create article
export const createArticleSchema = articleBaseSchema;

// Update article
export const updateArticleSchema = articleBaseSchema.partial();

// Query params for listing
export const listArticlesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  status: ArticleStatus.optional(),
  type: ArticleType.optional(),
  categorySlug: z.string().optional(),
  tagSlug: z.string().optional(),
  search: z.string().optional(),
  source: ArticleSource.optional(),
  featured: z.coerce.boolean().optional(),
  orderBy: z.enum(['publishedAt', 'createdAt', 'viewCount', 'title']).default('publishedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

// Response types
export const articleResponseSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  excerpt: z.string().nullable(),
  content: z.string(),
  metaTitle: z.string().nullable(),
  metaDescription: z.string().nullable(),
  featuredImage: z.string().nullable(),
  type: ArticleType,
  status: ArticleStatus,
  source: ArticleSource,
  youtubeUrl: z.string().nullable(),
  spotifyUrl: z.string().nullable(),
  applePodcastUrl: z.string().nullable(),
  deezerUrl: z.string().nullable(),
  podcastSummary: z.string().nullable(),
  timestamps: z.string().nullable(),
  isFeatured: z.boolean(),
  viewCount: z.number(),
  publishedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  categories: z.array(z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
  })),
  tags: z.array(z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
  })),
});

export type CreateArticleInput = z.infer<typeof createArticleSchema>;
export type UpdateArticleInput = z.infer<typeof updateArticleSchema>;
export type ListArticlesQuery = z.infer<typeof listArticlesQuerySchema>;
export type ArticleResponse = z.infer<typeof articleResponseSchema>;
