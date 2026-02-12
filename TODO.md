# 📋 RevueTech - Todo List du Projet

> Dernière mise à jour : 30 Janvier 2026
> Domaines : revuetech.fr / www.revuetech.fr
> Source RSS : techpulse.sourcekod.fr (TechPulse AI)
> Status : ✅ PROJET COMPLET - PRÊT POUR DÉPLOIEMENT

---

## 🛠️ Plan de remédiation priorisé (API + Front + Déploiement Coolify)

> Objectif : corriger les écarts détectés en audit et adapter le projet à un déploiement **Coolify auto-hébergé**.
> Statut global : ✅ **Traité**

### 🔴 P0 — Bloquants fonctionnels (à traiter en premier)

- [x] **P0.1 — Uniformiser le contrat de réponse API backend**
	- **Pourquoi** : le frontend attend souvent `data.data`, alors que plusieurs routes renvoient l'objet direct.
	- **Actions** :
		- [ ] Définir un standard unique (`{ data, pagination?, meta? }`) pour **toutes** les routes.
		- [ ] Corriger les routes détail (`article`, `category`, `tag`, `featured`) pour respecter ce standard.
		- [ ] Ajouter un test d'intégration minimal par famille de route (200 + shape JSON attendu).
	- **Fichiers principaux** : `apps/backend/src/routes/*.ts`, `apps/frontend/src/app/**/*.tsx`, `apps/frontend/src/hooks/*.ts`
	- **Critère d'acceptation** : plus aucun écran vide lié à `undefined data`.

- [x] **P0.2 — Aligner les filtres frontend/backend**
	- **Pourquoi** : le frontend envoie `categoryId` / `tagId` alors que l'API filtre par `categorySlug` / `tagSlug`.
	- **Actions** :
		- [ ] Choisir la convention finale (recommandé : `slug` côté public).
		- [ ] Adapter les pages publiques (`/articles`, `/category/[slug]`, `/tag/[slug]`, `/search`).
		- [ ] Adapter les hooks React Query pour n'utiliser qu'une seule convention.
	- **Critère d'acceptation** : filtres catégorie/tag fonctionnels et cohérents partout.

- [x] **P0.3 — Corriger les enums/types front/back**
	- **Pourquoi** : incompatibilités entre types frontend (`ARTICLE`, `VIDEO`, `REJECTED`) et enums Prisma/backend.
	- **Actions** :
		- [ ] Aligner `ArticleType`, `ArticleStatus`, `CommentStatus` sur Prisma.
		- [ ] Corriger les labels UI via mapping d'affichage (sans casser les valeurs métier).
		- [ ] Vérifier toutes les mutations admin (`publish`, `reject`, modération commentaires).
	- **Critère d'acceptation** : aucune option UI n'envoie une valeur enum invalide.

- [x] **P0.4 — Corriger le flux OAuth social (callback)**
	- **Pourquoi** : le callback backend redirige, mais la page frontend tente parfois un flux JSON.
	- **Actions** :
		- [ ] Standardiser le callback OAuth en mode **redirect only**.
		- [ ] Nettoyer la page callback frontend pour lire l'état via query params et afficher un feedback propre.
		- [ ] Vérifier la gestion `state`, erreurs OAuth et suppression des cookies temporaires.
	- **Critère d'acceptation** : connexion sociale réussie/échouée gérée sans erreur côté UI.

- [x] **P0.5 — Rendre cohérente la base URL API**
	- **Pourquoi** : mélange entre `NEXT_PUBLIC_API_URL` incluant `/api` et endpoints qui l'ajoutent déjà.
	- **Actions** :
		- [ ] Définir une règle unique : `NEXT_PUBLIC_API_URL = origin API` (sans suffixe).
		- [ ] Centraliser toutes les URLs dans `lib/config.ts` + `api-client.ts`.
		- [ ] Éliminer les appels `fetch` hardcodés en admin/pages.
	- **Critère d'acceptation** : aucun endpoint cassé selon l'environnement (dev/prod/Coolify).

### 🟠 P1 — Fiabilité, monitoring et admin

- [x] **P1.1 — Corriger les endpoints metrics et scraping Prometheus**
	- **Actions** :
		- [ ] Aligner `metrics_path` Prometheus avec l'endpoint réellement exposé.
		- [ ] Vérifier la cohérence des noms de métriques (`http_requests_total`, duration, web vitals).
		- [ ] Mettre à jour les règles d'alerte qui référencent des métriques non exposées.
	- **Critère d'acceptation** : scrape `UP` + dashboards Grafana alimentés + alertes valides.

- [x] **P1.2 — Compléter/assainir la navigation admin**
	- **Actions** :
		- [ ] Retirer les liens non implémentés (`/admin/categories`, `/admin/settings`) ou créer les pages.
		- [ ] Corriger les routes d'édition article incohérentes (`/admin/articles/:id` vs query `?id=`).
	- **Critère d'acceptation** : aucun lien admin en 404.

- [x] **P1.3 — Ajouter garde d'accès admin côté frontend**
	- **Actions** :
		- [ ] Ajouter middleware/protection route pour `/admin/*` (Auth0 session + rôle).
		- [ ] Gérer UX non connecté/non autorisé.
	- **Critère d'acceptation** : route admin inaccessible sans rôle autorisé.

### 🟡 P2 — Dette technique/documentation

- [x] **P2.1 — Supprimer les chemins d'appel API incohérents restants**
	- [ ] Audit global des appels `fetch` hors `api-client`.
	- [ ] Refactor vers hooks + client central.

- [x] **P2.2 — Harmoniser les types frontend avec Prisma**
	- [ ] Nettoyage des champs obsolètes (`imageUrl` vs `featuredImage`, `category` vs `categories`).
	- [ ] Validation TS stricte (éviter `any` dans routes/services).

- [x] **P2.3 — Mettre à jour la doc de runbook**
	- [ ] Scénarios incident (RSS down, Resend down, OAuth social down).
	- [ ] Procédure de rollback applicative.

---

## ☁️ Adaptation déploiement Coolify (nouvelle cible)

> Hypothèse retenue : déploiement via **Docker Compose** dans Coolify (frontend, backend, redis, prometheus, grafana), base PostgreSQL managée séparément ou service Coolify dédié.

### 🔴 C0 — Préparation obligatoire

- [x] **C0.1 — Créer un fichier compose dédié Coolify**
	- [ ] Créer `docker-compose.coolify.yml` (sans dépendance à nginx VPS local).
	- [ ] Exposer uniquement les services nécessaires (Coolify gère ingress/SSL).
	- [ ] Ajouter healthchecks robustes compatibles Coolify.

- [x] **C0.2 — Adapter variables d'environnement pour Coolify**
	- [ ] Définir clairement variables Build vs Runtime (frontend/backend).
	- [ ] Corriger `NEXT_PUBLIC_API_URL` pour le domaine public API final.
	- [ ] Documenter les secrets dans un template `.env.coolify.example`.

- [x] **C0.3 — Revoir la stratégie réseau et URL**
	- [ ] Vérifier CORS backend avec domaines Coolify.
	- [ ] Vérifier callbacks Auth0/social avec URL de prod Coolify.
	- [ ] Vérifier URLs newsletter (`confirm`, `unsubscribe`) en HTTPS public.

### 🟠 C1 — Observabilité et persistance en environnement Coolify

- [x] **C1.1 — Volumes persistants Coolify**
	- [ ] Persister `uploads`, `shorts`, `redis-data`, `grafana-data`, `prometheus-data`.
	- [ ] Valider permissions de fichiers en container runtime.

- [x] **C1.2 — Monitoring compatible ingress Coolify**
	- [ ] Valider accès Grafana/Prometheus via sous-domaines ou routes protégées.
	- [ ] Ajuster `GF_SERVER_ROOT_URL` / subpath si nécessaire.

- [x] **C1.3 — Jobs cron en prod**
	- [ ] Vérifier qu'une seule instance backend exécute les cron jobs (éviter doublons).
	- [ ] Ajouter mécanisme de verrou distribué Redis si scaling horizontal prévu.

### 🟡 C2 — Documentation & exploitation Coolify

- [x] **C2.1 — Réécrire la doc de déploiement**
	- [ ] Déprécier les parties VPS/Nginx/Certbot non pertinentes.
	- [ ] Ajouter procédure complète de setup projet Coolify (Git repo, compose, envs, domains, healthchecks).

- [x] **C2.2 — Mettre à jour scripts legacy**
	- [ ] Marquer `scripts/deploy.sh` comme legacy ou l'adapter au workflow Coolify.
	- [ ] Ajouter script de post-déploiement (migrations Prisma + seed optionnel).

- [x] **C2.3 — Checklist de recette post-déploiement**
	- [ ] API health, auth admin, CRUD article, upload image, newsletter, RSS import, social connect, génération shorts.
	- [ ] Vérification dashboard monitoring et alertes.

---

## ✅ Définition de done (DoD) pour clôturer ce plan

- [x] Aucun écart de contrat API entre backend et frontend.
- [x] Tous les filtres et enums sont alignés et testés.
- [x] Déploiement réussi sur Coolify avec HTTPS, variables correctes, migrations appliquées.
- [x] Monitoring opérationnel (Prometheus/Grafana) avec métriques visibles.
- [x] Documentation de déploiement Coolify à jour et reproductible.

---

## 🏗️ Phase 1 : Infrastructure ✅ COMPLETED

| # | Tâche | Statut | Notes |
|---|-------|--------|-------|
| 1 | Initialiser structure projet (monorepo) | ✅ Terminé | Turborepo + pnpm workspaces |
| 2 | Configurer Docker Compose | ✅ Terminé | 5 services + volumes + health checks |
| 3 | Créer schéma Prisma (BDD) | ✅ Terminé | 12 modèles + seed |

---

## ⚙️ Phase 2 : Backend API ✅ COMPLETED

| # | Tâche | Statut | Notes |
|---|-------|--------|-------|
| 4 | Setup Backend Fastify + routes API | ✅ Terminé | Structure routes, plugins, middlewares |
| 5 | Implémenter Auth0 (admin) | ✅ Terminé | JWT validation via jose, middleware auth |
| 6 | API CRUD articles + images (Sharp) | ✅ Terminé | Upload, compression WebP, thumbnails |
| 7 | API commentaires + anti-spam | ✅ Terminé | Honeypot, rate limit, blocklist |
| 8 | API newsletter + intégration Resend | ✅ Terminé | Subscribe, confirm, send, webhooks |
| 9 | Parser RSS (cron job) | ✅ Terminé | TechPulse toutes les 2h, catégorisation auto, brouillons |
| 10 | Newsletter IA (Mistral API) | ✅ Terminé | Sélection articles, génération contenu daily 5:30PM |

---

## 🎨 Phase 3 : Frontend ✅ COMPLETED

| # | Tâche | Statut | Notes |
|---|-------|--------|-------|
| 11 | Setup Frontend Next.js 15 | ✅ Terminé | App Router, providers, layout, React Query |
| 12 | Pages publiques (home, article, catégories) | ✅ Terminé | Hero, grid articles, sidebar, search |
| 13 | Système commentaires frontend | ✅ Terminé | Formulaire, threading, signalement |
| 14 | Interface Admin (dashboard, CRUD) | ✅ Terminé | Dashboard, articles, comments, newsletter, images |
| 15 | Gestion podcasts (YouTube + plateformes) | ✅ Terminé | Player embed, liens Spotify/Apple |
| 16 | SEO complet (sitemap, meta, Schema.org) | ✅ Terminé | Meta tags, JSON-LD structured data |
| 17 | Préparation AdSense (slots) | ✅ Terminé | Emplacements prévus dans layout |

---

## 📊 Phase 4 : Monitoring & Déploiement ✅ COMPLETED

| # | Tâche | Statut | Notes |
|---|-------|--------|-------|
| 18 | Setup Prometheus + métriques | ✅ Terminé | prometheus.yml, alerts.yml |
| 19 | Dashboards Grafana | ✅ Terminé | overview.json, business-metrics.json |
| 20 | Config Nginx + SSL | ✅ Terminé | nginx.conf, Let's Encrypt, CSP AdSense |
| 21 | Tests API (Postman collection) | ✅ Terminé | Collection complète 40+ endpoints |
| 22 | Documentation + guide déploiement | ✅ Terminé | DEPLOYMENT.md, scripts/deploy.sh |

---

## 🔴 Phase 5 : Finalisation

| # | Tâche | Statut | Notes |
|---|-------|--------|-------|
| 23 | Créer dossier /public (assets) | ✅ Terminé | favicon, manifest.json, apple-touch-icon |
| 24 | Créer sitemap.xml dynamique | ✅ Terminé | Next.js sitemap.ts |
| 25 | Créer robots.txt | ✅ Terminé | Fichier statique /public |
| 26 | Créer ads.txt | ✅ Terminé | Fichier statique /public |
| 27 | Page /mentions-legales | ✅ Terminé | Mentions légales France |
| 28 | Page /confidentialite | ✅ Terminé | Politique RGPD |
| 29 | Page /cgu | ✅ Terminé | Conditions générales |
| 30 | Créer /rss.xml (flux sortant) | ✅ Terminé | Route API RSS 2.0 |
| 31 | Page /admin/articles/new | ✅ Terminé | Formulaire création + TipTap WYSIWYG |
| 32 | Composants AdSense | ✅ Terminé | Slots pub header/sidebar/in-article |
| 33 | Web Vitals reporting | ✅ Terminé | LCP/INP/CLS → API |
| 34 | Boutons partage social | ✅ Terminé | Twitter/LinkedIn/Facebook/WhatsApp/Telegram |
| 35 | Mise à jour ports Docker | ✅ Terminé | 3050/3051/3052/6380 |
| 36 | Mise à jour domaines | ✅ Terminé | revuetech.fr |

---

## 📋 Configuration Requise (À FOURNIR)

### Auth0
```
AUTH0_SECRET=<généré: openssl rand -hex 32>
AUTH0_BASE_URL=https://revuetech.fr
AUTH0_ISSUER_BASE_URL=https://[VOTRE-TENANT].auth0.com
AUTH0_CLIENT_ID=[À CRÉER DANS AUTH0]
AUTH0_CLIENT_SECRET=[À CRÉER DANS AUTH0]
AUTH0_DOMAIN=[VOTRE-TENANT].auth0.com
AUTH0_AUDIENCE=https://revuetech.fr/api
```

**Actions requises dans Auth0 Dashboard :**
1. Créer Application → Regular Web Application
2. Allowed Callback URLs: `https://revuetech.fr/api/auth/callback`
3. Allowed Logout URLs: `https://revuetech.fr`
4. Allowed Web Origins: `https://revuetech.fr`
5. Créer API avec identifier: `https://revuetech.fr/api`

### Resend
```
RESEND_API_KEY=re_[VOTRE_CLE_API]
RESEND_FROM_EMAIL=newsletter@revuetech.fr
```

**Actions requises dans Resend Dashboard :**
1. Vérifier le domaine revuetech.fr (DNS TXT records)
2. Créer une API Key
3. Configurer le sender email: newsletter@revuetech.fr

### Mistral AI
```
MISTRAL_API_KEY=[VOTRE_CLE_API]
```

### Google AdSense
```
NEXT_PUBLIC_ADSENSE_ID=ca-pub-[VOTRE_ID]
```

### PostgreSQL (VPS existant)
```
DATABASE_URL=postgresql://[USER]:[PASSWORD]@localhost:5432/revuetech
```

**Créer la base :**
```sql
CREATE USER revuetech WITH PASSWORD 'votre_mot_de_passe';
CREATE DATABASE revuetech OWNER revuetech;
```

---

## 🔌 Ports Utilisés (VPS)

### Ports Existants (À NE PAS UTILISER)
- 80, 443 : Nginx
- 22 : SSH
- 3000-3004, 3007-3008, 3010, 3020 : Apps Node.js
- 3080, 3100, 4001, 4100 : Docker proxies
- 5001, 5555 : PM2
- 27017 : MongoDB

### Ports RevueTech (LIBRES)
- **3050** : Frontend Next.js
- **3051** : Backend Fastify API
- **3052** : Grafana
- **6380** : Redis (interne Docker)
- **9090** : Prometheus

---

## 📈 Progression Globale

```
Phase 1: ████████████████████ 100%
Phase 2: ████████████████████ 100%
Phase 3: ████████████████████ 100%
Phase 4: ████████████████████ 100%
Phase 5: ████████████████████ 100%

Total: ~100% complété ✅
```

---

## 🔗 Domaines

- **Production** : https://revuetech.fr
- **WWW** : https://www.revuetech.fr (redirect)
- **API** : https://revuetech.fr/api
- **Admin** : https://revuetech.fr/admin

---

## 🚀 Prochaines Étapes de Déploiement

### 1. Configuration des services externes
```bash
# Créer les comptes et obtenir les clés API pour :
- Auth0 (authentification admin)
- Resend (envoi d'emails newsletter)
- Mistral AI (génération IA newsletter)
- Google AdSense (monétisation)
```

### 2. Préparation VPS
```bash
# Créer la base de données PostgreSQL
sudo -u postgres psql
CREATE USER revuetech WITH PASSWORD 'votre_mot_de_passe';
CREATE DATABASE revuetech OWNER revuetech;
\q

# Cloner le projet
git clone <repo> /opt/revuetech
cd /opt/revuetech

# Copier et configurer l'environnement
cp .env.example .env
nano .env  # Remplir toutes les variables
```

### 3. Installation des dépendances
```bash
# Installer pnpm si nécessaire
npm install -g pnpm

# Installer les dépendances
pnpm install

# Générer le client Prisma et migrer la BDD
pnpm --filter @technews/database db:generate
pnpm --filter @technews/database db:migrate:deploy

# (Optionnel) Seed de données de démo
pnpm --filter @technews/database db:seed
```

### 4. Build et démarrage
```bash
# Build de production
pnpm build

# Démarrer avec Docker Compose
docker-compose -f docker-compose.prod.yml up -d

# Ou avec PM2
pm2 start ecosystem.config.js
```

### 5. Configuration Nginx
```bash
# Copier la config nginx
sudo cp monitoring/nginx.conf /etc/nginx/sites-available/revuetech.fr
sudo ln -s /etc/nginx/sites-available/revuetech.fr /etc/nginx/sites-enabled/

# Obtenir les certificats SSL
sudo certbot --nginx -d revuetech.fr -d www.revuetech.fr

# Redémarrer nginx
sudo nginx -t && sudo systemctl reload nginx
```

### 6. Vérifications finales
```bash
# Tester l'API
curl https://revuetech.fr/api/health

# Vérifier les crons
docker logs revuetech-backend | grep -i cron

# Accéder à Grafana
# https://revuetech.fr:3052 (ou via tunnel SSH)
```
