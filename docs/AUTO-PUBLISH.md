# Auto-publication IA des drafts RSS

## Objectif
Publier automatiquement un article `DRAFT` récent (RSS) après enrichissement IA (contenu + SEO + image), avec cadence contrôlée et journalisation.

## Activation
Par défaut, la fonctionnalité est désactivée.

Variables backend:

- `AUTO_PUBLISH_ENABLED` (`false` par défaut)
- `AUTO_PUBLISH_DRY_RUN` (`true` par défaut)
- `AUTO_PUBLISH_LOOKBACK_HOURS` (`3` par défaut)
- `AUTO_PUBLISH_INTERVAL_MIN_MINUTES` (`90` par défaut)
- `AUTO_PUBLISH_INTERVAL_MAX_MINUTES` (`120` par défaut)
- `MISTRAL_API_KEY` (obligatoire)

## Prompts utilisés
Le service lit ces fichiers dans `assets/`:

- `assets/prompt-article.txt`
- `assets/prompt-image.txt`

L'image Docker backend copie maintenant `assets/` au runtime.

## Fonctionnement
- Cron de vérification: toutes les 15 min.
- Cooldown réel entre publications: aléatoire entre `min` et `max` minutes.
- Candidat: article RSS en `DRAFT`, créé dans la fenêtre des `LOOKBACK_HOURS`.
- Sélection: score d'intérêt (fraîcheur, richesse contenu, source, extrait, catégorie, vues).
- Déduplication: vérification contre articles déjà `PUBLISHED` (source URL et titre/source récents).
- Enrichissement IA:
  - Génère `title`, `slug`, `excerpt`, `content`, `metaTitle`, `metaDescription`, `category`, `tags`.
  - Catégorie forcée vers une catégorie existante (fallback si besoin).
- Image:
  - Tente une génération image via Mistral.
  - Si échec, fallback image existante.
  - Passe par le pipeline d'optimisation interne (`/uploads/original|medium|thumbnail`).
- Publication:
  - Mise à jour article + catégories/tags + image principale.
  - Passage en `PUBLISHED` avec `publishedAt=now`.
- Logs:
  - `cron_job_logs` avec `jobName=auto-publish` (cron)
  - `cron_job_logs` avec `jobName=auto-publish-manual` (run manuel)

## Endpoint manuel admin
Route protégée admin:

- `POST /api/v1/admin/auto-publish/run`

Body optionnel:

```json
{ "dryRun": true }
```

Réponse: résultat détaillé (`published`, `dry-run`, `skipped`, `failed`, raison, cooldown, article).

## Recommandation de mise en route
1. Déployer avec `AUTO_PUBLISH_ENABLED=true` et `AUTO_PUBLISH_DRY_RUN=true` pendant 24-48h.
2. Vérifier les logs `auto-publish` + qualité des sorties.
3. Passer `AUTO_PUBLISH_DRY_RUN=false` une fois validé.
