# 🚀 RevueTech - Déploiement Coolify (cible active)

Ce guide est la référence de déploiement **production** pour ce projet.

## 0) Pré-requis

Avant de créer le service Coolify, vérifier:

1. Un serveur Coolify fonctionnel (reverse proxy/TLS géré par Coolify).
2. DNS configuré:
   - `revuetech.fr` (frontend)
   - `api.revuetech.fr` (backend)
   - optionnel: `grafana.revuetech.fr`, `prometheus.revuetech.fr`
3. Une base PostgreSQL prête (service Coolify ou externe).
4. Secrets disponibles (Auth0, Resend, Mistral, OAuth social).

Par défaut, ce dépôt déploie PostgreSQL dans le même compose (recommandé pour éviter les problèmes de réseau interne).

Fichiers utilisés:

- Compose: [docker-compose.coolify.yml](../docker-compose.coolify.yml)
- Variables: [/.env.coolify.example](../.env.coolify.example)
- Post-déploiement: [scripts/post-deploy.sh](../scripts/post-deploy.sh)

---

## 1) Préparer les variables d'environnement

1. Copier le template `.env.coolify.example` dans votre gestionnaire de variables Coolify.
2. Renseigner toutes les clés obligatoires.

Points critiques (cohérence avec le code actuel):

- `NEXT_PUBLIC_SITE_URL=https://revuetech.fr`
- `NEXT_PUBLIC_API_URL=https://api.revuetech.fr` (**sans `/api`**)
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` (si DB intégrée)
- `DATABASE_URL` peut rester vide pour utiliser la DB intégrée
- `ENABLE_CRON=true` sur **une seule instance backend**

Règle anti-doublon cron:

- instance principale backend: `ENABLE_CRON=true`
- toute autre instance backend (si scaling): `ENABLE_CRON=false`

---

## 2) Créer le service Docker Compose dans Coolify

1. Créer un **nouveau service Docker Compose**.
2. Connecter le repository Git de ce projet.
3. Sélectionner le fichier `docker-compose.coolify.yml`.
4. Injecter les variables (section 1).
5. Déployer.

Services attendus:

- `frontend` (Next.js)
- `backend` (Fastify)
- `postgres` (PostgreSQL, intégré)
- `redis`
- `prometheus`
- `grafana`

Note importante:

- La stack monitoring est volontairement buildée avec configs embarquées (`docker/prometheus.Dockerfile`, `docker/grafana.Dockerfile`).
- Cela évite les erreurs Coolify de type *"not a directory"* sur les montages de fichiers (`prometheus.yml`, `alerts.yml`).

Volumes persistants déjà définis dans le compose:

- `postgres-data`
- `uploads-data`
- `shorts-data`
- `redis-data`
- `prometheus-data`
- `grafana-data`

## 2.1) PostgreSQL intégré: persistance et backup

La base est persistante via le volume Docker `postgres-data`.

Backup (dump SQL) depuis le serveur:

1. Identifier le conteneur postgres du projet Coolify.
2. Exécuter:

`docker exec <container_postgres> pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backup-$(date +%F-%H%M).sql`

Restauration:

`cat backup-YYYY-MM-DD-HHMM.sql | docker exec -i <container_postgres> psql -U "$POSTGRES_USER" "$POSTGRES_DB"`

Conseils:

- Planifier un backup quotidien (cron) + rotation.
- Copier les dumps hors serveur (S3/objet storage/rsync chiffré).

⚠️ Important (UI Coolify): pour une application **Docker Compose**, les `Source Path` des volumes sont en lecture seule dans le dashboard.

- Vous ne modifiez pas ces chemins dans l'UI.
- Toute modification de volumes (nom/source/destination) se fait dans [docker-compose.coolify.yml](../docker-compose.coolify.yml).
- Ensuite, dans Coolify: **Reload Compose File** puis **Redeploy**.

---

## 3) Domains et ports (mapping Coolify)

Configurer les domaines dans Coolify:

1. Frontend
   - Service: `frontend`
   - Port interne: `3000`
   - Domaine: `revuetech.fr`

2. Backend API
   - Service: `backend`
   - Port interne: `3001`
   - Domaine: `api.revuetech.fr`

3. Optionnel monitoring
   - Grafana: service `grafana`, port `3000`, domaine `grafana.revuetech.fr`
   - Prometheus: service `prometheus`, port `9090`, domaine `prometheus.revuetech.fr`

---

## 4) Auth0 et OAuth social (configuration exacte)

### 4.1 Auth0 (admin)

Dans Auth0 Application:

- Allowed Callback URLs: `https://revuetech.fr/api/auth/callback`
- Allowed Logout URLs: `https://revuetech.fr`
- Allowed Web Origins: `https://revuetech.fr`

### 4.2 OAuth social (Twitter/Facebook/LinkedIn)

Le flow actuel passe par la page frontend callback:

- `https://revuetech.fr/admin/social/callback/twitter`
- `https://revuetech.fr/admin/social/callback/facebook`
- `https://revuetech.fr/admin/social/callback/linkedin`

Puis le frontend redirige vers le backend `/api/v1/social/callback/:platform`.

---

## 5) Post-déploiement (obligatoire)

Après un déploiement réussi, exécuter dans le conteneur backend:

1. `./scripts/post-deploy.sh`

Ce script exécute:

- `prisma generate`
- `prisma migrate deploy` si des migrations existent
- sinon `prisma db push` (initialisation du schéma)
- note: le seed n'est pas exécuté dans l'image runtime (pas de workspace pnpm)

Recommandation:

- premier déploiement: exécuter migration puis seed depuis CI/environnement build si nécessaire
- déploiements suivants: migration uniquement via `./scripts/post-deploy.sh`

---

## 6) Vérifications fonctionnelles (recette)

### 6.1 Santé des services

- Backend: `GET https://api.revuetech.fr/health` retourne `200`
- Metrics backend: `GET https://api.revuetech.fr/metrics` retourne du Prometheus text format

### 6.2 Parcours applicatifs

- Home, liste articles, page article
- Auth admin + accès `/admin`
- CRUD article (création, édition, publication)
- Upload image
- Newsletter subscribe/confirm/unsubscribe
- Import RSS via admin
- Connexion sociale (au moins 1 provider)
- Génération shorts

### 6.3 Monitoring

- Prometheus scrape backend = `UP`
- Dashboards Grafana alimentés

---

## 7) Exploitation courante

### 7.1 Mise à jour applicative

1. Push Git
2. Redeploy Coolify
3. Exécuter `./scripts/post-deploy.sh`
4. Vérifier `health` + recette rapide

### 7.2 Scaling backend

Si plusieurs instances backend:

- 1 seule instance avec `ENABLE_CRON=true`
- toutes les autres en `ENABLE_CRON=false`

---

## 8) Rollback

1. Redeployer le commit/tag précédent dans Coolify.
2. Exécuter `./scripts/post-deploy.sh`.
3. Vérifier:
   - `GET /health`
   - login admin
   - page article

---

## 9) Dépannage rapide

- Erreurs DB/migrations: vérifier `DATABASE_URL` + relancer `post-deploy.sh`
- Erreurs OAuth social: vérifier callbacks section 4.2 exactement
- API cassée côté frontend: vérifier `NEXT_PUBLIC_API_URL` sans suffixe `/api`
- Cron en doublon: vérifier `ENABLE_CRON` sur chaque instance
- Erreur deployment `error mounting ... prometheus.yml ... not a directory`:
   1. Vérifier que vous utilisez bien la dernière version de [docker-compose.coolify.yml](../docker-compose.coolify.yml)
   2. Dans Coolify: `Reload Compose File`
   3. Puis `Redeploy`
   4. Si besoin, supprimer les anciens conteneurs échoués et redeployer
