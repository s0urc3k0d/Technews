#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Post-déploiement RevueTech"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "❌ pnpm est requis dans le conteneur"
  exit 1
fi

echo "📦 Prisma generate"
pnpm --filter @technews/database exec prisma generate

echo "🗄️ Prisma migrate deploy"
pnpm --filter @technews/database exec prisma migrate deploy

if [[ "${RUN_SEED:-false}" == "true" ]]; then
  echo "🌱 Prisma seed"
  pnpm --filter @technews/database exec prisma db seed
else
  echo "ℹ️ Seed ignoré (RUN_SEED=true pour l'exécuter)"
fi

echo "✅ Post-déploiement terminé"
