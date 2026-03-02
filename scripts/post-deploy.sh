#!/bin/sh
set -eu

echo "🚀 Post-déploiement RevueTech"

# Runtime containers may not provide a writable HOME for system users (e.g. fastify).
# Force npm/npx cache to a writable + executable path.
# Note: /tmp can be mounted with noexec in production hardening.
if [ -z "${HOME:-}" ] || [ ! -d "${HOME}" ]; then
  export HOME="/app/uploads"
fi

if [ -z "${NPM_CONFIG_CACHE:-}" ]; then
  if [ -d "/app/uploads" ] && [ -w "/app/uploads" ]; then
    export NPM_CONFIG_CACHE="/app/uploads/.npm"
  else
    export NPM_CONFIG_CACHE="/tmp/.npm"
  fi
fi

mkdir -p "$HOME" "$NPM_CONFIG_CACHE"

SCHEMA_PATH="/app/prisma/schema.prisma"

if [ ! -f "$SCHEMA_PATH" ]; then
  echo "❌ Schéma Prisma introuvable: $SCHEMA_PATH"
  exit 1
fi

echo "📦 Prisma generate"
npx prisma@5.22.0 generate --schema="$SCHEMA_PATH"

if [ -d "/app/prisma/migrations" ] && [ "$(ls -A /app/prisma/migrations 2>/dev/null)" ]; then
  echo "🗄️ Prisma migrate deploy"
  npx prisma@5.22.0 migrate deploy --schema="$SCHEMA_PATH"
else
  echo "🗄️ Aucune migration trouvée, application du schéma avec prisma db push"
  npx prisma@5.22.0 db push --schema="$SCHEMA_PATH"
fi

if [ "${RUN_SEED:-false}" = "true" ]; then
  echo "ℹ️ Seed demandé mais non supporté dans l'image runtime (pnpm/workspace absents)"
  echo "ℹ️ Exécuter le seed depuis l'environnement build/CI si nécessaire"
else
  echo "ℹ️ Seed ignoré (RUN_SEED=true pour l'exécuter)"
fi

echo "✅ Post-déploiement terminé"
