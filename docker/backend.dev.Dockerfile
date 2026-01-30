# ===========================================
# Backend Development Dockerfile
# ===========================================
FROM node:20-alpine
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Install sharp dependencies
RUN apk add --no-cache libc6-compat vips-dev

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/database/ ./packages/database/
COPY packages/typescript-config/ ./packages/typescript-config/

RUN pnpm install

# Generate Prisma client
RUN pnpm --filter @technews/database db:generate

COPY apps/backend/ ./apps/backend/

# Create uploads directory
RUN mkdir -p /app/uploads

WORKDIR /app/apps/backend

EXPOSE 3001

CMD ["pnpm", "dev"]
