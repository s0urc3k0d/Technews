// ===========================================
// Schémas Zod pour la Newsletter
// ===========================================

import { z } from 'zod';

export const NewsletterStatus = z.enum(['DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'FAILED']);

// Subscribe
export const subscribeSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(100).optional(),
  source: z.string().max(100).optional(),
});

// Confirm subscription
export const confirmSubscriptionSchema = z.object({
  token: z.string(),
});

// Unsubscribe
export const unsubscribeSchema = z.object({
  token: z.string(),
});

// Newsletter creation (admin)
export const createNewsletterSchema = z.object({
  subject: z.string().min(1).max(200),
  previewText: z.string().max(200).optional(),
  htmlContent: z.string().min(1),
  textContent: z.string().optional(),
  selectedArticles: z.array(z.string()).min(1),
  scheduledAt: z.string().datetime().optional(),
});

export const updateNewsletterSchema = createNewsletterSchema.partial();

// Newsletter query
export const listNewslettersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
  status: NewsletterStatus.optional(),
});

// Subscriber query
export const listSubscribersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  isActive: z.coerce.boolean().optional(),
  isConfirmed: z.coerce.boolean().optional(),
  search: z.string().optional(),
});

// Response schemas
export const subscriberResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  firstName: z.string().nullable(),
  isConfirmed: z.boolean(),
  isActive: z.boolean(),
  source: z.string().nullable(),
  createdAt: z.string(),
  confirmedAt: z.string().nullable(),
  unsubscribedAt: z.string().nullable(),
});

export const newsletterResponseSchema = z.object({
  id: z.string(),
  subject: z.string(),
  previewText: z.string().nullable(),
  status: NewsletterStatus,
  totalRecipients: z.number(),
  totalOpens: z.number(),
  totalClicks: z.number(),
  aiGenerated: z.boolean(),
  sentAt: z.string().nullable(),
  scheduledAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type SubscribeInput = z.infer<typeof subscribeSchema>;
export type CreateNewsletterInput = z.infer<typeof createNewsletterSchema>;
export type UpdateNewsletterInput = z.infer<typeof updateNewsletterSchema>;
export type ListNewslettersQuery = z.infer<typeof listNewslettersQuerySchema>;
export type ListSubscribersQuery = z.infer<typeof listSubscribersQuerySchema>;
