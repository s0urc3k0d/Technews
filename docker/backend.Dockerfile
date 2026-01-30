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
    ffmpeg

# Dependencies stage
FROM base AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/database/package.json ./packages/database/
COPY packages/typescript-config/package.json ./packages/typescript-config/

RUN pnpm install --frozen-lockfile

# Builder stage
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

# Runner stage - Install production dependencies fresh
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 fastify

# Copy workspace config files for pnpm to work
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/database/package.json ./packages/database/
COPY packages/typescript-config/package.json ./packages/typescript-config/

# Install production dependencies only (no symlinks issue)
RUN pnpm install --frozen-lockfile --prod

# Copy built files
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist

# Copy database package with Prisma client
COPY --from=builder /app/packages/database/src ./packages/database/src
COPY --from=builder /app/packages/database/prisma ./packages/database/prisma

# Copy Prisma generated client from pnpm structure
# The generated client is in .pnpm/@prisma+client*/node_modules/.prisma/client
COPY --from=builder /app/node_modules/.pnpm/@prisma+client@*/node_modules/.prisma ./node_modules/.prisma

# Create uploads and shorts directories
RUN mkdir -p /app/uploads /app/shorts /app/shorts/backgrounds /app/shorts/temp && \
    chown -R fastify:nodejs /app/uploads /app/shorts

USER fastify

WORKDIR /app/apps/backend

EXPOSE 3001

CMD ["node", "dist/server.js"]
