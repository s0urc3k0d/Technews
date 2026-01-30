# ===========================================
# Frontend Development Dockerfile
# ===========================================
FROM node:20-alpine
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/typescript-config/ ./packages/typescript-config/

RUN pnpm install

COPY apps/frontend/ ./apps/frontend/

WORKDIR /app/apps/frontend

EXPOSE 3000

CMD ["pnpm", "dev"]
