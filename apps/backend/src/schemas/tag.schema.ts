// ===========================================
// Schémas Zod pour les Tags
// ===========================================

import { z } from 'zod';

export const createTagSchema = z.object({
  name: z.string().min(1).max(50),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

export const updateTagSchema = createTagSchema.partial();

export const tagResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  _count: z.object({
    articles: z.number(),
  }).optional(),
  createdAt: z.string(),
});

export type CreateTagInput = z.infer<typeof createTagSchema>;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
export type TagResponse = z.infer<typeof tagResponseSchema>;
