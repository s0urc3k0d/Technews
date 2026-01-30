# ===========================================
# Backend Production Dockerfile
# ===========================================
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Install sharp and canvas dependencies + ffmpeg for video generation
RUN apk add --no-cache \
    libc6-compat \
    vips-dev \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    build-base \
    g++ \
    ffmpeg \
    python3

# ===========================================
# Dependencies stage
# ===========================================
FROM base AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/backend/tsup.config.ts ./apps/backend/
COPY packages/database/package.json ./packages/database/
COPY packages/typescript-config/package.json ./packages/typescript-config/

RUN pnpm install --frozen-lockfile

# ===========================================
# Builder stage
# ===========================================
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=deps /app/packages/database/node_modules ./packages/database/node_modules
COPY . .

# Generate Prisma client
RUN pnpm --filter @technews/database db:generate

# Build backend
RUN pnpm --filter @technews/backend build

# ===========================================
# Runner stage
# ===========================================
FROM node:20-alpine AS runner

# Install runtime dependencies for sharp/ffmpeg
RUN apk add --no-cache \
    libc6-compat \
    vips-dev \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    ffmpeg

WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 fastify

# Copy the compiled dist file
COPY --from=builder --chown=fastify:nodejs /app/apps/backend/dist ./dist

# Create package.json WITHOUT type:module (we're using CommonJS now)
RUN echo '{"name":"backend","private":true,"dependencies":{"fastify":"^4.26.0","@fastify/cors":"^9.0.0","@fastify/helmet":"^11.1.0","@fastify/rate-limit":"^9.1.0","@fastify/static":"^7.0.0","@fastify/multipart":"^8.1.0","@fastify/cookie":"^9.3.0","fastify-plugin":"^4.5.1","@prisma/client":"5.22.0","ioredis":"^5.3.0","sharp":"^0.33.0","pino":"^8.19.0","pino-pretty":"^10.3.0","zod":"^3.22.0","jose":"^6.1.3","node-cron":"^3.0.0","resend":"^3.5.0","rss-parser":"^3.13.0","@mistralai/mistralai":"^0.1.3"}}' > package.json

# Install all dependencies with npm
RUN npm install --omit=dev

# Copy Prisma schema
COPY --from=builder --chown=fastify:nodejs /app/packages/database/prisma ./prisma

# Generate Prisma client with the installed version
RUN npx prisma@5.22.0 generate --schema=./prisma/schema.prisma

# Create uploads and shorts directories
RUN mkdir -p /app/uploads /app/shorts /app/shorts/backgrounds /app/shorts/temp && \
    chown -R fastify:nodejs /app /app/uploads /app/shorts

USER fastify

EXPOSE 3001

CMD ["node", "dist/server.cjs"]
