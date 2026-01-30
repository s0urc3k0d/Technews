# 🚀 RevueTech - Guide de Déploiement

> Guide complet pour déployer RevueTech sur un VPS Ubuntu
> 
> **Domaine** : revuetech.fr / www.revuetech.fr

---

## 📋 Table des matières

1. [Prérequis](#-prérequis)
2. [Déploiement Automatisé](#-déploiement-automatisé-recommandé)
3. [Déploiement Manuel](#-déploiement-manuel)
   - [Installation des dépendances](#1-installation-des-dépendances-système)
   - [Configuration du pare-feu](#2-configuration-du-pare-feu-ufw)
   - [PostgreSQL](#3-configuration-postgresql)
   - [Clonage du projet](#4-clonage-du-projet)
   - [Variables d'environnement](#5-configuration-des-variables-denvironnement)
   - [SSL avec Let's Encrypt](#6-obtention-du-certificat-ssl)
   - [Lancement Docker](#7-construction-et-lancement-des-conteneurs)
   - [Migrations Prisma](#8-exécution-des-migrations-prisma)
   - [Configuration des backups](#9-configuration-des-sauvegardes-automatiques)
4. [Configuration des Services Externes](#-configuration-des-services-externes)
5. [Vérifications Post-Déploiement](#-vérifications-post-déploiement)
6. [Commandes Utiles](#-commandes-utiles)
7. [Dépannage](#-dépannage)
8. [Sécurité](#-sécurité)

---

## 📋 Prérequis

### Serveur
| Élément | Minimum | Recommandé |
|---------|---------|------------|
| OS | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |
| RAM | 2 Go | 4 Go |
| CPU | 2 vCPU | 4 vCPU |
| Stockage | 20 Go SSD | 40 Go SSD |
| Réseau | IP publique, ports 80/443 | IP fixe |

### Services externes requis
- **Auth0** : Authentification admin
- **Resend** : Envoi d'emails (newsletter)
- **Mistral AI** : Génération de contenu IA (optionnel)
- **Nom de domaine** : DNS A record pointant vers l'IP du serveur

### Logiciels installés (par le script ou manuellement)
- Docker et Docker Compose
- Git
- Certbot (Let's Encrypt)
- UFW (pare-feu)

---

## ⚡ Déploiement Automatisé (Recommandé)

Le script `deploy.sh` automatise toutes les étapes ci-dessous.

```bash
# 1. Cloner le repository
git clone https://github.com/s0urc3k0d/Technews.git /var/www/revuetech
cd /var/www/revuetech

# 2. Copier et configurer l'environnement
cp .env.example .env
nano .env  # Éditer avec vos valeurs (voir section Variables d'environnement)

# 3. Lancer l'installation complète
sudo DOMAIN="revuetech.fr" EMAIL="admin@revuetech.fr" ./scripts/deploy.sh full
```

### Options du script

```bash
./scripts/deploy.sh install   # Installe les dépendances système
./scripts/deploy.sh firewall  # Configure UFW
./scripts/deploy.sh setup     # Clone/met à jour le projet
./scripts/deploy.sh ssl       # Obtient le certificat SSL
./scripts/deploy.sh backup    # Configure les sauvegardes
./scripts/deploy.sh deploy    # Déploie l'application
./scripts/deploy.sh full      # Exécute toutes les étapes
./scripts/deploy.sh status    # Affiche le statut des conteneurs
./scripts/deploy.sh logs      # Affiche les logs (logs backend pour un service)
./scripts/deploy.sh restart   # Redémarre les services
```

---

## 🔧 Déploiement Manuel

Si vous préférez contrôler chaque étape ou si le script automatisé ne fonctionne pas dans votre environnement.

### 1. Installation des dépendances système

```bash
# Mise à jour du système
sudo apt update && sudo apt upgrade -y

# Installation des paquets requis
sudo apt install -y \
    curl \
    git \
    docker.io \
    docker-compose \
    certbot \
    ufw \
    fail2ban

# Activer et démarrer Docker
sudo systemctl enable docker
sudo systemctl start docker

# Ajouter votre utilisateur au groupe docker (optionnel, évite sudo)
sudo usermod -aG docker $USER
# Déconnectez-vous et reconnectez-vous pour appliquer
```

### 2. Configuration du pare-feu (UFW)

```bash
# Politique par défaut
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Autoriser les ports nécessaires
sudo ufw allow ssh          # Port 22 - SSH
sudo ufw allow 80/tcp       # Port 80 - HTTP (redirection vers HTTPS)
sudo ufw allow 443/tcp      # Port 443 - HTTPS

# Activer le pare-feu
sudo ufw --force enable

# Vérifier le statut
sudo ufw status verbose
```

**Sortie attendue :**
```
Status: active

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW       Anywhere
80/tcp                     ALLOW       Anywhere
443/tcp                    ALLOW       Anywhere
```

### 3. Configuration PostgreSQL

RevueTech utilise une base PostgreSQL. Vous pouvez utiliser une instance existante sur le VPS ou une base externe.

#### Option A : PostgreSQL existant sur le VPS

```bash
# Connexion à PostgreSQL
sudo -u postgres psql
```

```sql
-- Créer l'utilisateur
CREATE USER revuetech WITH PASSWORD 'votre_mot_de_passe_securise';

-- Créer la base de données
CREATE DATABASE revuetech OWNER revuetech;

-- Accorder les privilèges
GRANT ALL PRIVILEGES ON DATABASE revuetech TO revuetech;

-- Activer l'extension UUID (optionnel mais recommandé)
\c revuetech
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Quitter
\q
```

**DATABASE_URL résultant :**
```
DATABASE_URL=postgresql://revuetech:votre_mot_de_passe_securise@localhost:5432/revuetech?schema=public
```

#### Option B : PostgreSQL dockerisé

Si vous préférez tout dans Docker, ajoutez ce service dans `docker-compose.prod.yml` :

```yaml
postgres:
  image: postgres:16-alpine
  container_name: revuetech-postgres
  restart: unless-stopped
  environment:
    POSTGRES_USER: revuetech
    POSTGRES_PASSWORD: votre_mot_de_passe_securise
    POSTGRES_DB: revuetech
  volumes:
    - postgres-data:/var/lib/postgresql/data
  networks:
    - technews-network
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U revuetech"]
    interval: 10s
    timeout: 5s
    retries: 5
```

Et ajoutez le volume :
```yaml
volumes:
  postgres-data:
    driver: local
```

**DATABASE_URL résultant :**
```
DATABASE_URL=postgresql://revuetech:votre_mot_de_passe_securise@postgres:5432/revuetech?schema=public
```

### 4. Clonage du projet

```bash
# Créer le répertoire et cloner
sudo mkdir -p /var/www
sudo chown $USER:$USER /var/www
git clone https://github.com/s0urc3k0d/Technews.git /var/www/revuetech
cd /var/www/revuetech

# Créer les répertoires nécessaires
mkdir -p uploads
mkdir -p shorts/backgrounds
mkdir -p backups
```

### 5. Configuration des variables d'environnement

```bash
# Copier le fichier exemple
cp .env.example .env

# Éditer le fichier
nano .env
```

**Fichier `.env` complet :**

```env
# ===========================================
# Application
# ===========================================
NODE_ENV=production
NEXT_PUBLIC_SITE_URL=https://revuetech.fr
NEXT_PUBLIC_API_URL=https://revuetech.fr/api

# ===========================================
# Base de données PostgreSQL
# ===========================================
# Format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public
DATABASE_URL=postgresql://revuetech:VOTRE_MOT_DE_PASSE@localhost:5432/revuetech?schema=public

# ===========================================
# Redis (conteneur Docker)
# ===========================================
REDIS_URL=redis://localhost:6380

# ===========================================
# Auth0 - Authentification Admin
# ===========================================
# Générer avec: openssl rand -hex 32
AUTH0_SECRET=GENERER_AVEC_OPENSSL
AUTH0_BASE_URL=https://revuetech.fr
AUTH0_ISSUER_BASE_URL=https://VOTRE-TENANT.auth0.com
AUTH0_CLIENT_ID=VOTRE_CLIENT_ID
AUTH0_CLIENT_SECRET=VOTRE_CLIENT_SECRET
AUTH0_DOMAIN=VOTRE-TENANT.auth0.com
AUTH0_AUDIENCE=https://revuetech.fr/api

# ===========================================
# Sécurité
# ===========================================
# Générer avec: openssl rand -hex 32
JWT_SECRET=GENERER_AVEC_OPENSSL
SESSION_SECRET=GENERER_AVEC_OPENSSL

# ===========================================
# Email - Resend
# ===========================================
RESEND_API_KEY=re_VOTRE_CLE_API
RESEND_FROM_EMAIL=newsletter@revuetech.fr

# ===========================================
# IA - Mistral (optionnel)
# ===========================================
MISTRAL_API_KEY=VOTRE_CLE_MISTRAL

# ===========================================
# Source RSS
# ===========================================
RSS_FEED_URL=https://techpulse.sourcekod.fr/api/feeds/all.xml

# ===========================================
# Google AdSense (optionnel)
# ===========================================
NEXT_PUBLIC_ADSENSE_ID=ca-pub-7283351114219521

# ===========================================
# Monitoring - Grafana
# ===========================================
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=VOTRE_MOT_DE_PASSE_GRAFANA
GRAFANA_ROOT_URL=http://localhost:3052

# ===========================================
# Upload & Shorts
# ===========================================
UPLOAD_MAX_SIZE_MB=5
UPLOAD_PATH=/var/www/revuetech/uploads
SHORTS_DIR=/var/www/revuetech/shorts

# ===========================================
# Réseaux Sociaux (optionnel)
# ===========================================
TWITTER_CLIENT_ID=
TWITTER_CLIENT_SECRET=
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
```

**Générer les secrets :**
```bash
# AUTH0_SECRET
openssl rand -hex 32

# JWT_SECRET
openssl rand -hex 32

# SESSION_SECRET
openssl rand -hex 32
```

### 6. Obtention du certificat SSL

```bash
# Arrêter nginx s'il est en cours d'exécution
sudo docker-compose -f docker-compose.prod.yml stop nginx 2>/dev/null || true

# Obtenir le certificat Let's Encrypt
sudo certbot certonly \
    --standalone \
    --agree-tos \
    --no-eff-email \
    --email admin@revuetech.fr \
    -d revuetech.fr \
    -d www.revuetech.fr
```

**Vérifier les certificats :**
```bash
sudo ls -la /etc/letsencrypt/live/revuetech.fr/
```

**Sortie attendue :**
```
fullchain.pem -> ../../archive/revuetech.fr/fullchain1.pem
privkey.pem -> ../../archive/revuetech.fr/privkey1.pem
chain.pem -> ../../archive/revuetech.fr/chain1.pem
cert.pem -> ../../archive/revuetech.fr/cert1.pem
```

**Renouvellement automatique :**
Certbot ajoute automatiquement un timer systemd. Vérifiez :
```bash
sudo systemctl status certbot.timer
```

### 7. Construction et lancement des conteneurs

```bash
cd /var/www/revuetech

# Construction des images Docker
sudo docker-compose -f docker-compose.prod.yml build

# Lancement des conteneurs en arrière-plan
sudo docker-compose -f docker-compose.prod.yml up -d

# Vérifier que tous les conteneurs sont en cours d'exécution
sudo docker-compose -f docker-compose.prod.yml ps
```

**Sortie attendue :**
```
NAME                    STATUS              PORTS
technews-frontend       Up (healthy)        3000/tcp
technews-backend        Up (healthy)        3001/tcp
technews-nginx          Up                  0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
technews-redis          Up (healthy)        6379/tcp
revuetech-prometheus    Up                  9090/tcp
revuetech-grafana       Up                  3000/tcp
```

**Attendre que les services soient prêts :**
```bash
# Attendre 30 secondes pour le démarrage complet
sleep 30

# Vérifier les logs du backend
sudo docker-compose -f docker-compose.prod.yml logs backend --tail 50
```

### 8. Exécution des migrations Prisma

```bash
# Exécuter les migrations de base de données
sudo docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy

# Vérifier que les tables sont créées
sudo docker-compose -f docker-compose.prod.yml exec backend npx prisma db pull
```

**En cas de première installation, seed la base (optionnel) :**
```bash
sudo docker-compose -f docker-compose.prod.yml exec backend npx prisma db seed
```

### 9. Configuration des sauvegardes automatiques

#### Créer le script de backup

```bash
sudo nano /usr/local/bin/revuetech-backup.sh
```

**Contenu du script :**
```bash
#!/bin/bash
# ===========================================
# RevueTech - Script de sauvegarde
# ===========================================

BACKUP_DIR="/var/www/revuetech/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
APP_DIR="/var/www/revuetech"

# Créer le répertoire de backup s'il n'existe pas
mkdir -p $BACKUP_DIR

# Backup de la base de données
echo "Sauvegarde de la base de données..."
cd $APP_DIR
docker-compose -f docker-compose.prod.yml exec -T postgres pg_dump -U revuetech revuetech > $BACKUP_DIR/db_$TIMESTAMP.sql 2>/dev/null || \
    PGPASSWORD=$DB_PASSWORD pg_dump -h localhost -U revuetech revuetech > $BACKUP_DIR/db_$TIMESTAMP.sql

# Vérifier que le dump n'est pas vide
if [ ! -s "$BACKUP_DIR/db_$TIMESTAMP.sql" ]; then
    echo "⚠️  Attention: Le dump de la base de données est vide ou a échoué"
fi

# Backup des uploads
echo "Sauvegarde des fichiers uploadés..."
tar -czf $BACKUP_DIR/uploads_$TIMESTAMP.tar.gz -C $APP_DIR uploads/ 2>/dev/null

# Backup des shorts
if [ -d "$APP_DIR/shorts" ]; then
    echo "Sauvegarde des shorts..."
    tar -czf $BACKUP_DIR/shorts_$TIMESTAMP.tar.gz -C $APP_DIR shorts/ 2>/dev/null
fi

# Supprimer les backups de plus de 7 jours
echo "Nettoyage des anciens backups..."
find $BACKUP_DIR -type f -mtime +7 -delete

echo "✅ Sauvegarde terminée: $TIMESTAMP"
ls -lh $BACKUP_DIR/*$TIMESTAMP*
```

**Rendre le script exécutable :**
```bash
sudo chmod +x /usr/local/bin/revuetech-backup.sh
```

**Tester le script :**
```bash
sudo /usr/local/bin/revuetech-backup.sh
```

#### Configurer le cron job

```bash
# Éditer la crontab
sudo crontab -e

# Ajouter cette ligne (backup quotidien à 2h du matin)
0 2 * * * /usr/local/bin/revuetech-backup.sh >> /var/log/revuetech-backup.log 2>&1
```

**Vérifier le cron :**
```bash
sudo crontab -l
```

---

## 🔐 Configuration des Services Externes

### Auth0

#### 1. Créer une Application

1. Connectez-vous à [Auth0 Dashboard](https://manage.auth0.com/)
2. **Applications** → **Create Application**
3. Choisir **Regular Web Application**
4. Nom : `RevueTech Admin`

#### 2. Configurer les URLs (Settings)

| Paramètre | Valeur |
|-----------|--------|
| Allowed Callback URLs | `https://revuetech.fr/api/auth/callback` |
| Allowed Logout URLs | `https://revuetech.fr` |
| Allowed Web Origins | `https://revuetech.fr` |

#### 3. Créer une API

1. **APIs** → **Create API**
2. Name : `RevueTech API`
3. Identifier : `https://revuetech.fr/api`

#### 4. Récupérer les credentials

Dans **Settings** de votre application :
- **Domain** → `AUTH0_DOMAIN`
- **Client ID** → `AUTH0_CLIENT_ID`
- **Client Secret** → `AUTH0_CLIENT_SECRET`

### Resend

1. Créez un compte sur [Resend](https://resend.com)
2. **Domains** → Ajoutez `revuetech.fr`
3. Configurez les DNS (DKIM, SPF, DMARC)
4. **API Keys** → Créez une clé → `RESEND_API_KEY`

### Mistral AI

1. Créez un compte sur [Mistral Console](https://console.mistral.ai)
2. **API Keys** → Generate → `MISTRAL_API_KEY`

---

## ✅ Vérifications Post-Déploiement

### Tests de santé

```bash
# 1. Vérifier le health check du backend
curl -s https://revuetech.fr/api/v1/health | jq

# Sortie attendue:
# {
#   "status": "healthy",
#   "timestamp": "2026-01-30T...",
#   "services": {
#     "database": "connected",
#     "redis": "connected"
#   }
# }

# 2. Vérifier le frontend
curl -s -o /dev/null -w "%{http_code}" https://revuetech.fr
# Sortie attendue: 200

# 3. Vérifier SSL
curl -vI https://revuetech.fr 2>&1 | grep -E "SSL|subject|expire"

# 4. Vérifier les conteneurs
sudo docker-compose -f docker-compose.prod.yml ps

# 5. Vérifier les logs
sudo docker-compose -f docker-compose.prod.yml logs --tail 20
```

### Checklist finale

- [ ] Site accessible sur https://revuetech.fr
- [ ] Redirection HTTP → HTTPS fonctionne
- [ ] API répond sur /api/v1/health
- [ ] Connexion admin Auth0 fonctionne
- [ ] Import RSS fonctionne (vérifier /admin)
- [ ] Newsletter peut être envoyée (test avec votre email)
- [ ] Images s'uploadent correctement
- [ ] Backups automatiques configurés
- [ ] Certificat SSL valide (pas d'avertissement navigateur)
- [ ] Grafana accessible sur localhost:3052

---

## 📊 Accès Monitoring

| Service | URL | Accès |
|---------|-----|-------|
| Site public | https://revuetech.fr | Public |
| Admin | https://revuetech.fr/admin | Auth0 |
| Grafana | http://localhost:3052 | Local uniquement |
| Prometheus | http://localhost:9090 | Local uniquement |

**Accéder à Grafana depuis l'extérieur (tunnel SSH) :**
```bash
# Sur votre machine locale
ssh -L 3052:localhost:3052 user@votre-serveur
# Puis ouvrir http://localhost:3052 dans votre navigateur
```

---

## 🔄 Commandes Utiles

### Gestion des conteneurs

```bash
cd /var/www/revuetech

# Voir le statut
sudo docker-compose -f docker-compose.prod.yml ps

# Voir les logs (tous les services)
sudo docker-compose -f docker-compose.prod.yml logs -f

# Voir les logs d'un service spécifique
sudo docker-compose -f docker-compose.prod.yml logs -f backend
sudo docker-compose -f docker-compose.prod.yml logs -f frontend
sudo docker-compose -f docker-compose.prod.yml logs -f nginx

# Redémarrer tous les services
sudo docker-compose -f docker-compose.prod.yml restart

# Redémarrer un service spécifique
sudo docker-compose -f docker-compose.prod.yml restart backend

# Arrêter tous les services
sudo docker-compose -f docker-compose.prod.yml down

# Arrêter et supprimer les volumes (⚠️ PERTE DE DONNÉES)
sudo docker-compose -f docker-compose.prod.yml down -v
```

### Mise à jour de l'application

```bash
cd /var/www/revuetech

# Récupérer les dernières modifications
git pull origin main

# Reconstruire les images
sudo docker-compose -f docker-compose.prod.yml build

# Relancer avec les nouvelles images
sudo docker-compose -f docker-compose.prod.yml up -d

# Exécuter les migrations si nécessaire
sudo docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

### Base de données

```bash
# Accéder à la console Prisma
sudo docker-compose -f docker-compose.prod.yml exec backend npx prisma studio

# Exécuter une migration
sudo docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy

# Reset la base (⚠️ PERTE DE DONNÉES)
sudo docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate reset

# Générer le client Prisma
sudo docker-compose -f docker-compose.prod.yml exec backend npx prisma generate
```

### Redis

```bash
# Accéder à la CLI Redis
sudo docker exec -it technews-redis redis-cli

# Voir la mémoire utilisée
sudo docker exec technews-redis redis-cli INFO memory

# Vider le cache
sudo docker exec technews-redis redis-cli FLUSHALL
```

### SSL

```bash
# Vérifier les certificats
sudo certbot certificates

# Renouveler manuellement
sudo certbot renew

# Forcer le renouvellement
sudo certbot renew --force-renewal

# Après renouvellement, redémarrer nginx
sudo docker-compose -f docker-compose.prod.yml restart nginx
```

### Backups

```bash
# Lancer un backup manuel
sudo /usr/local/bin/revuetech-backup.sh

# Voir les backups
ls -lh /var/www/revuetech/backups/

# Restaurer la base de données
cat /var/www/revuetech/backups/db_YYYYMMDD_HHMMSS.sql | \
    sudo docker-compose -f docker-compose.prod.yml exec -T postgres psql -U revuetech revuetech

# Restaurer les uploads
sudo tar -xzf /var/www/revuetech/backups/uploads_YYYYMMDD_HHMMSS.tar.gz -C /var/www/revuetech/
```

---

## 🔍 Dépannage

### Le backend ne démarre pas

```bash
# Vérifier les logs détaillés
sudo docker-compose -f docker-compose.prod.yml logs backend

# Problèmes courants:
# 1. DATABASE_URL incorrect → vérifier .env
# 2. PostgreSQL non accessible → vérifier que le service tourne
# 3. Migrations non exécutées → lancer prisma migrate deploy
```

### Erreur de connexion à la base de données

```bash
# Vérifier que PostgreSQL accepte les connexions
sudo docker-compose -f docker-compose.prod.yml exec backend \
    npx prisma db pull

# Si PostgreSQL est sur le host (pas dans Docker)
# Vérifier pg_hba.conf pour autoriser les connexions Docker
sudo nano /etc/postgresql/16/main/pg_hba.conf
# Ajouter: host all all 172.17.0.0/16 md5
sudo systemctl restart postgresql
```

### Erreur SSL / Certificat

```bash
# Vérifier que les certificats existent
sudo ls -la /etc/letsencrypt/live/revuetech.fr/

# Si les certificats n'existent pas, les obtenir
sudo certbot certonly --standalone -d revuetech.fr -d www.revuetech.fr

# Vérifier la configuration nginx
sudo docker-compose -f docker-compose.prod.yml exec nginx nginx -t
```

### Redis plein / Lent

```bash
# Voir l'utilisation mémoire
sudo docker exec technews-redis redis-cli INFO memory

# Si > 80% utilisé, vider le cache
sudo docker exec technews-redis redis-cli FLUSHALL

# Augmenter la limite (éditer docker-compose.prod.yml)
# command: redis-server --maxmemory 1gb
```

### Nginx ne démarre pas

```bash
# Vérifier la configuration
sudo docker-compose -f docker-compose.prod.yml exec nginx nginx -t

# Problèmes courants:
# 1. Certificats SSL manquants → obtenir avec certbot
# 2. Ports déjà utilisés → sudo lsof -i :80 -i :443
# 3. Erreur de syntaxe → vérifier docker/nginx/nginx.conf
```

### Pas de données dans Grafana

```bash
# Vérifier que Prometheus scrape les targets
curl http://localhost:9090/api/v1/targets | jq

# Vérifier que le backend expose les métriques
curl http://localhost:3001/api/v1/metrics

# Redémarrer Prometheus
sudo docker-compose -f docker-compose.prod.yml restart prometheus
```

### Import RSS ne fonctionne pas

```bash
# Vérifier les logs du cron
sudo docker-compose -f docker-compose.prod.yml logs backend | grep -i rss

# Tester l'URL RSS manuellement
curl -s https://techpulse.sourcekod.fr/api/feeds/all.xml | head -50

# Déclencher un import manuel via l'API
curl -X POST https://revuetech.fr/api/v1/admin/rss/parse \
    -H "Authorization: Bearer VOTRE_TOKEN"
```

---

## 🔒 Sécurité

### Checklist de sécurité

- [ ] Firewall UFW activé (ports 22, 80, 443 uniquement)
- [ ] Certificat SSL Let's Encrypt configuré
- [ ] Variables sensibles dans `.env` (fichier non commité)
- [ ] Grafana/Prometheus non exposés publiquement
- [ ] Mots de passe forts (générés avec `openssl rand -hex 32`)
- [ ] Sauvegardes automatiques activées et testées
- [ ] Auth0 configuré avec restrictions d'accès
- [ ] fail2ban installé et configuré

### Durcissement supplémentaire

```bash
# Désactiver l'accès root SSH
sudo sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sudo sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl restart sshd

# Configurer fail2ban
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Vérifier les tentatives bloquées
sudo fail2ban-client status sshd

# Mettre à jour automatiquement les paquets de sécurité
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

### Rotation des secrets

Périodiquement (tous les 3-6 mois), régénérez :
1. `JWT_SECRET`
2. `SESSION_SECRET`
3. Mot de passe PostgreSQL
4. Mot de passe Grafana

```bash
# Générer un nouveau secret
openssl rand -hex 32

# Mettre à jour .env, puis redémarrer
sudo docker-compose -f docker-compose.prod.yml down
sudo docker-compose -f docker-compose.prod.yml up -d
```

---

## 📈 Architecture des Services

```
┌─────────────────────────────────────────────────────────────┐
│                         INTERNET                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    NGINX (Port 80/443)                      │
│                   SSL Termination                           │
│                   Rate Limiting                             │
└─────────────────────────────────────────────────────────────┘
           │                                    │
           ▼                                    ▼
┌─────────────────────┐            ┌─────────────────────────┐
│   Frontend (3000)   │            │     Backend (3001)      │
│      Next.js        │            │        Fastify          │
│   Static + SSR      │            │    API REST + Cron      │
└─────────────────────┘            └─────────────────────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    │                         │                         │
                    ▼                         ▼                         ▼
          ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
          │   PostgreSQL    │      │      Redis      │      │   File System   │
          │   (Port 5432)   │      │   (Port 6379)   │    │    /uploads     │
          │    Database     │      │      Cache      │      │    /shorts      │
          └─────────────────┘      └─────────────────┘      └─────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      MONITORING                              │
│  Prometheus (9090) ──────────────► Grafana (3052)           │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔗 Configuration Nginx Détaillée

Le fichier `docker/nginx/nginx.conf` configure le reverse proxy. Voici les points clés :

### Rate Limiting

```nginx
# Zone API : 10 requêtes/seconde par IP
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

# Zone générale : 30 requêtes/seconde par IP  
limit_req_zone $binary_remote_addr zone=general:10m rate=30r/s;
```

### Routes principales

| Route | Destination | Rate Limit |
|-------|-------------|------------|
| `/api/*` | Backend (3001) | 10r/s + burst 20 |
| `/uploads/*` | Fichiers statiques | Cache 30 jours |
| `/_next/static/*` | Next.js assets | Cache 365 jours |
| `/*` | Frontend (3000) | 30r/s + burst 50 |

### Headers de sécurité

- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security: max-age=31536000`
- CSP optimisé pour Google AdSense

---

## 📡 Intégration TechPulse RSS

### Fonctionnement

RevueTech utilise **TechPulse** comme source RSS par défaut :
- Import automatique toutes les 2 heures (cron)
- Articles créés en statut "DRAFT"
- Validation manuelle dans `/admin`

### Catégories disponibles

| Flux TechPulse | URL |
|----------------|-----|
| Tous les articles | `https://techpulse.sourcekod.fr/api/feeds/all.xml` |
| Cybersécurité | `https://techpulse.sourcekod.fr/api/feeds/cybersecurite.xml` |
| IA & ML | `https://techpulse.sourcekod.fr/api/feeds/ia.xml` |
| Hardware | `https://techpulse.sourcekod.fr/api/feeds/hardware.xml` |

---

## 📞 Support

- **Issues GitHub** : https://github.com/s0urc3k0d/Technews/issues
- **Documentation** : Ce fichier

---

**Dernière mise à jour** : 30 janvier 2026
