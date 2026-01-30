// ===========================================
// Configuration de l'application
// ===========================================

import { z } from 'zod';

const envSchema = z.object({
  // App
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001'),
  HOST: z.string().default('0.0.0.0'),

  // Database
  DATABASE_URL: z.string(),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Auth0
  AUTH0_DOMAIN: z.string().optional(),
  AUTH0_AUDIENCE: z.string().optional(),

  // JWT
  JWT_SECRET: z.string().min(32),
  SESSION_SECRET: z.string().min(32),

  // Resend
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),

  // Mistral AI
  MISTRAL_API_KEY: z.string().optional(),

  // RSS - TechPulse feed par défaut
  RSS_FEED_URL: z.string().url().default('https://techpulse.sourcekod.fr/api/feeds/all.xml'),

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
