// ===========================================
// Configuration de l'application
// ===========================================

import { z } from 'zod';

const envSchema = z.object({
  // App
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001'),
  HOST: z.string().default('0.0.0.0'),
  API_BODY_LIMIT_MB: z.string().default('25'),

  // Database
  DATABASE_URL: z.string(),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Auth0
  AUTH0_DOMAIN: z.string().optional(),
  AUTH0_AUDIENCE: z.string().optional(),
  AUTH0_ADMIN_ROLE: z.string().optional(),
  AUTH0_ADMIN_PERMISSION: z.string().optional(),
  AUTH0_ROLES_CLAIM: z.string().optional(),

  // JWT
  JWT_SECRET: z.string().min(32),
  SESSION_SECRET: z.string().min(32),

  // Admin allowlist
  ADMIN_EMAILS: z.string().optional(),
  ADMIN_SUBS: z.string().optional(),

  // Resend
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),

  // Webhooks
  DISCORD_WEBHOOK_URL: z.string().url().optional(),

  // Mistral AI
  MISTRAL_API_KEY: z.string().optional(),
  MISTRAL_IMAGE_ENDPOINT: z.string().url().optional(),

  // RSS - TechPulse feed par défaut
  RSS_FEED_URL: z.string().url().default('https://techpulse.sourcekod.fr/api/feeds/all.xml'),
  RSS_MAX_AGE_DAYS: z.string().default('10'),

  // Social Media OAuth (optionnel)
  TWITTER_CLIENT_ID: z.string().optional(),
  TWITTER_CLIENT_SECRET: z.string().optional(),
  FACEBOOK_APP_ID: z.string().optional(),
  FACEBOOK_APP_SECRET: z.string().optional(),
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),

  // Upload
  UPLOAD_PATH: z.string().default('./uploads'),
  UPLOAD_MAX_SIZE_MB: z.string().default('5'),

  // Shorts vidéo
  SHORTS_DIR: z.string().default('/var/www/revuetech/shorts'),

  // Cron jobs
  ENABLE_CRON: z.string().default('true'),

  // Auto publish (IA)
  AUTO_PUBLISH_ENABLED: z.string().default('false'),
  AUTO_PUBLISH_DRY_RUN: z.string().default('true'),
  AUTO_PUBLISH_LOOKBACK_HOURS: z.string().default('3'),
  AUTO_PUBLISH_INTERVAL_MIN_MINUTES: z.string().default('90'),
  AUTO_PUBLISH_INTERVAL_MAX_MINUTES: z.string().default('120'),

  // Draft purge
  DRAFT_PURGE_ENABLED: z.string().default('true'),
  DRAFT_PURGE_DAYS: z.string().default('3'),

  // Frontend URL (for CORS & emails)
  NEXT_PUBLIC_SITE_URL: z.string().url().default('http://localhost:3000'),
});

const parseEnv = () => {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment variables');
  }

  return parsed.data;
};

export const config = parseEnv();

export type Config = typeof config;
