// ===========================================
// Schémas Zod pour les Images
// ===========================================

import { z } from 'zod';

export const uploadImageSchema = z.object({
  articleId: z.string().optional(),
  alt: z.string().max(255).optional(),
  caption: z.string().max(500).optional(),
  isPrimary: z.boolean().default(false),
});

export const imageResponseSchema = z.object({
  id: z.string(),
  url: z.string(),
  thumbnail: z.string().nullable(),
  medium: z.string().nullable(),
  alt: z.string().nullable(),
  caption: z.string().nullable(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  size: z.number().nullable(),
  mimeType: z.string().nullable(),
  isPrimary: z.boolean(),
  createdAt: z.string(),
});

export type UploadImageInput = z.infer<typeof uploadImageSchema>;
export type ImageResponse = z.infer<typeof imageResponseSchema>;
