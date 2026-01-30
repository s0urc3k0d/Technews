import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { server: 'src/server.ts' },  // Named entry for consistent output
  format: ['cjs'],  // Use CommonJS to avoid ESM resolution issues
  target: 'node20',
  outDir: 'dist',
  clean: true,
  bundle: true,
  // Force .js extension for CommonJS
  outExtension: () => ({ js: '.js' }),
  // Keep all dependencies external - they'll be in node_modules
  external: [
    // All @fastify packages
    'fastify',
    '@fastify/cors',
    '@fastify/helmet',
    '@fastify/rate-limit',
    '@fastify/static',
    '@fastify/multipart',
    '@fastify/cookie',
    'fastify-plugin',
    // Database
    '@prisma/client',
    '.prisma/client',
    // Other deps
    'ioredis',
    'sharp',
    'pino',
    'pino-pretty',
    'zod',
    'jose',
    'node-cron',
    'resend',
    'rss-parser',
    '@mistralai/mistralai',
  ],
  // Handle node built-ins
  platform: 'node',
  // Shims for __dirname, __filename
  shims: true,
});
