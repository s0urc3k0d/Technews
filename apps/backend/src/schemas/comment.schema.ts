// ===========================================
// Schémas Zod pour les Commentaires
// ===========================================

import { z } from 'zod';

export const CommentStatus = z.enum(['APPROVED', 'PENDING', 'SPAM', 'DELETED']);

export const createCommentSchema = z.object({
  authorName: z.string().min(2).max(100),
  authorEmail: z.string().email(),
  content: z.string().min(3).max(2000),
  articleId: z.string(),
  parentId: z.string().optional().nullable(),
  // Honeypot field (should be empty)
  website: z.string().max(0).optional(),
});

export const updateCommentStatusSchema = z.object({
  status: CommentStatus,
});

export const listCommentsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: CommentStatus.optional(),
  articleId: z.string().optional(),
  orderBy: z.enum(['createdAt', 'reportCount']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const reportCommentSchema = z.object({
  reason: z.string().max(500).optional(),
});

// Base schema without recursive reference
const baseCommentSchema = z.object({
  id: z.string(),
  authorName: z.string(),
  authorEmail: z.string(),
  content: z.string(),
  status: CommentStatus,
  reportCount: z.number(),
  articleId: z.string(),
  parentId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type CommentBase = z.infer<typeof baseCommentSchema>;

export interface CommentResponse extends CommentBase {
  replies?: CommentResponse[];
}

export const commentResponseSchema: z.ZodType<CommentResponse> = baseCommentSchema.extend({
  replies: z.lazy(() => z.array(commentResponseSchema)).optional(),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentStatusInput = z.infer<typeof updateCommentStatusSchema>;
export type ListCommentsQuery = z.infer<typeof listCommentsQuerySchema>;
