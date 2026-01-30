# 🚀 RevueTech - Guide de Déploiement

> Guide complet pour déployer RevueTech sur un VPS Ubuntu
> 
> **Domaine** : revuetech.fr / www.revuetech.fr

---

## 📋 Prérequis

### Serveur
- **OS**: Ubuntu 22.04 LTS ou plus récent
- **RAM**: Minimum 2 Go (4 Go recommandé)
- **CPU**: 2 vCPU minimum
- **Stockage**: 20 Go minimum
- **Réseau**: IP publique, ports 80 et 443 ouverts

### Services externes
- **Auth0**: Compte et application configurée
- **Resend**: Compte et clé API
- **Mistral AI**: Clé API (optionnel pour newsletter IA)
- **Nom de domaine**: DNS configuré vers l'IP du serveur

---

## 🔧 Installation Rapide

```bash
# 1. Cloner le repository
git clone https://github.com/s0urc3k0d/Technews.git /var/www/revuetech
cd /var/www/revuetech

# 2. Copier et configurer l'environnement
cp .env.example .env
nano .env  # Éditer avec vos valeurs

# 3. Lancer l'installation complète
sudo DOMAIN="votre-domaine.com" EMAIL="votre@email.com" ./scripts/deploy.sh full
```

---

## 📝 Configuration Détaillée

### Variables d'environnement (.env)

```env
# ===========================================
# Application
# ===========================================
NODE_ENV=production
NEXT_PUBLIC_SITE_URL=https://revuetech.fr
NEXT_PUBLIC_API_URL=https://revuetech.fr/api

# ===========================================
# Base de données (PostgreSQL sur VPS existant)
# ===========================================
DATABASE_URL=postgresql://revuetech:votre_mot_de_passe@localhost:5432/revuetech?schema=public

# ===========================================
# Redis (dockerisé)
# ===========================================
REDIS_URL=redis://localhost:6380

# ===========================================
# Auth0
# ===========================================
AUTH0_SECRET=<généré avec: openssl rand -hex 32>
AUTH0_BASE_URL=https://revuetech.fr
AUTH0_ISSUER_BASE_URL=https://votre-tenant.auth0.com
AUTH0_CLIENT_ID=votre_client_id
AUTH0_CLIENT_SECRET=votre_client_secret
AUTH0_DOMAIN=votre-tenant.auth0.com
AUTH0_AUDIENCE=https://revuetech.fr/api

# ===========================================
# Services
# ===========================================
JWT_SECRET=<généré avec: openssl rand -hex 32>
SESSION_SECRET=<généré avec: openssl rand -hex 32>
RESEND_API_KEY=re_xxxxxxxxxx
RESEND_FROM_EMAIL=newsletter@revuetech.fr
MISTRAL_API_KEY=xxxxxxxx

# ===========================================
# RSS Parser - TechPulse Integration
# ===========================================
RSS_FEED_URL=https://techpulse.sourcekod.fr/api/feeds/all.xml

# ===========================================
# Grafana (Monitoring)
# ===========================================
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=<mot de passe sécurisé>
GRAFANA_ROOT_URL=http://localhost:3052

# ===========================================
# Google AdSense
# ===========================================
NEXT_PUBLIC_ADSENSE_ID=ca-pub-7283351114219521

# ===========================================
# Upload settings
# ===========================================
UPLOAD_MAX_SIZE_MB=5
UPLOAD_PATH=/var/www/revuetech/uploads

# ===========================================
# Réseaux Sociaux - OAuth (optionnel)
# ===========================================
TWITTER_CLIENT_ID=votre_twitter_client_id
TWITTER_CLIENT_SECRET=votre_twitter_client_secret
FACEBOOK_APP_ID=votre_facebook_app_id
FACEBOOK_APP_SECRET=votre_facebook_app_secret
LINKEDIN_CLIENT_ID=votre_linkedin_client_id
LINKEDIN_CLIENT_SECRET=votre_linkedin_client_secret
```

---

## 🗄️ Configuration PostgreSQL

La base de données PostgreSQL est sur votre VPS existant. Créez la base :

```sql
-- Connexion à PostgreSQL
sudo -u postgres psql

-- Créer l'utilisateur et la base
CREATE USER revuetech WITH PASSWORD 'votre_mot_de_passe';
CREATE DATABASE revuetech OWNER revuetech;
GRANT ALL PRIVILEGES ON DATABASE revuetech TO revuetech;

-- Activer l'extension UUID si nécessaire
\c revuetech
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

Mettez à jour le `DATABASE_URL` dans votre `.env` :
```
DATABASE_URL=postgresql://revuetech:votre_mot_de_passe@localhost:5432/revuetech
```

---

## 🔐 Configuration Auth0

### 1. Créer une Application
1. Allez sur [Auth0 Dashboard](https://manage.auth0.com/)
2. Applications → Create Application
3. Type: **Regular Web Application**
4. Nom: RevueTech Admin

### 2. Configurer les URLs
Dans Settings de l'application :
- **Allowed Callback URLs**: `https://revuetech.fr/api/auth/callback`
- **Allowed Logout URLs**: `https://revuetech.fr`
- **Allowed Web Origins**: `https://revuetech.fr`

### 3. Créer une API
1. APIs → Create API
2. Name: RevueTech API
3. Identifier: `https://revuetech.fr/api`

### 4. Limiter l'accès Admin
Dans Users & Roles → Roles :
1. Créer un rôle "admin"
2. Assigner à votre compte uniquement

---

## 📧 Configuration Resend

1. Créez un compte sur [Resend](https://resend.com)
2. Vérifiez votre domaine
3. Créez une API Key
4. Configurez le `RESEND_FROM_EMAIL` avec votre domaine vérifié

---

## 🤖 Configuration Mistral AI (Newsletter IA)

1. Créez un compte sur [Mistral](https://mistral.ai)
2. Générez une API Key
3. Ajoutez-la dans `MISTRAL_API_KEY`

---

## 📊 Accès Monitoring

Une fois déployé :

| Service | URL | Accès |
|---------|-----|-------|
| Site | https://revuetech.fr | Public |
| Admin | https://revuetech.fr/admin | Auth0 |
| Grafana | http://localhost:3052 | Local/VPN |
| Prometheus | http://localhost:9090 | Local/VPN |

> ⚠️ Grafana et Prometheus ne sont pas exposés publiquement par défaut. Utilisez un tunnel SSH ou VPN pour y accéder.

---

## 🔄 Commandes Utiles

```bash
# Voir le statut des conteneurs
./scripts/deploy.sh status

# Voir les logs
./scripts/deploy.sh logs          # Tous les services
./scripts/deploy.sh logs backend  # Backend uniquement

# Redémarrer les services
./scripts/deploy.sh restart

# Backup manuel
/usr/local/bin/revuetech-backup.sh

# Renouveler SSL manuellement
certbot renew

# Mise à jour de l'application
cd /var/www/revuetech
git pull origin main
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

---

## 🔍 Dépannage

### Le backend ne démarre pas
```bash
# Vérifier les logs
docker logs technews-backend

# Vérifier la connexion DB
docker-compose -f docker-compose.prod.yml exec backend npx prisma db push
```

### Erreur SSL
```bash
# Vérifier les certificats
certbot certificates

# Renouveler manuellement
certbot renew --force-renewal
```

### Redis plein
```bash
# Vérifier la mémoire Redis
docker exec technews-redis redis-cli INFO memory

# Vider le cache si nécessaire
docker exec technews-redis redis-cli FLUSHALL
```

### Pas de métriques dans Grafana
```bash
# Vérifier que Prometheus scrape les targets
curl http://localhost:9090/api/v1/targets
```

---

## 📦 Sauvegardes

Les sauvegardes automatiques sont configurées pour s'exécuter tous les jours à 2h du matin.

Emplacement : `/var/www/revuetech/backups/`

Contenu :
- `db_YYYYMMDD_HHMMSS.sql` - Dump PostgreSQL
- `uploads_YYYYMMDD_HHMMSS.tar.gz` - Images uploadées

Rétention : 7 jours

### Restauration

```bash
# Restaurer la base de données
cat /var/www/revuetech/backups/db_20260130_020000.sql | docker-compose -f docker-compose.prod.yml exec -T postgres psql -U revuetech revuetech

# Restaurer les uploads
tar -xzf /var/www/revuetech/backups/uploads_20260130_020000.tar.gz -C /var/www/revuetech/
```

---

## 🔒 Sécurité

### Checklist
- [ ] Firewall UFW activé (ports 80, 443, 22 uniquement)
- [ ] SSL Let's Encrypt configuré
- [ ] Variables sensibles dans `.env` (non committé)
- [ ] Accès Grafana/Prometheus restreint
- [ ] Mots de passe forts générés
- [ ] Sauvegardes automatiques activées
- [ ] Auth0 configuré avec rôle admin

### Durcissement supplémentaire

```bash
# Désactiver l'accès root SSH
sudo sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl restart sshd

# Configurer fail2ban
sudo apt install fail2ban
sudo systemctl enable fail2ban
```

---

## 📡 Intégration TechPulse RSS

### Fonctionnement

RevueTech utilise **TechPulse** comme source RSS par défaut. TechPulse est un agrégateur d'articles tech qui :
- Collecte des articles depuis des sources tech fiables
- Les filtre et catégorise automatiquement
- Fournit un flux RSS enrichi avec métadonnées

### Configuration

Le flux TechPulse est configuré par défaut. Vous pouvez le personnaliser :

```env
# Flux par défaut (TechPulse - tous les articles)
RSS_FEED_URL=https://techpulse.sourcekod.fr/api/feeds/all.xml

# Ou filtrer par catégorie
# RSS_FEED_URL=https://techpulse.sourcekod.fr/api/feeds/cybersecurite.xml
```

### Catégories TechPulse disponibles

| Catégorie TechPulse | Mapping RevueTech |
|---------------------|-------------------|
| Cybersécurité | securite |
| Science & Espace | science |
| Software & Apps | logiciels |
| Mobile & Telecom | mobile |
| Hardware | hardware |
| Gaming | gaming |
| IA & Machine Learning | ia |
| Cloud & DevOps | cloud |
| Blockchain & Crypto | blockchain |
| Startup & Business | business |

### Workflow Hybride

1. **Import automatique** : Le cron job importe les articles TechPulse toutes les 2 heures
2. **Articles en brouillon** : Les articles importés sont créés en statut "DRAFT"
3. **Validation admin** : Connectez-vous à `/admin` pour :
   - Réviser les articles importés
   - Éditer le contenu si nécessaire (WYSIWYG)
   - Publier les articles sélectionnés
4. **Notification** : Recevez un email quand de nouveaux articles sont importés

### API Admin RSS

```bash
# Voir le statut du flux RSS
curl -H "Authorization: Bearer $TOKEN" \
  https://revuetech.fr/api/admin/rss/status

# Déclencher l'import manuellement
curl -X POST -H "Authorization: Bearer $TOKEN" \
  https://revuetech.fr/api/admin/rss/parse
```

---

## 📈 Performances

### Optimisations recommandées

1. **CDN** : Utilisez Cloudflare devant votre domaine
2. **Redis** : Augmentez `maxmemory` si nécessaire
3. **Images** : Sharp compresse déjà en WebP
4. **Cache** : Les pages sont mises en cache via Redis

### Monitoring à surveiller

- Temps de réponse API < 200ms
- Taux d'erreur < 1%
- Utilisation mémoire < 80%
- Espace disque > 20% libre

---

## 📞 Support

Pour toute question :
- Issues GitHub : https://github.com/s0urc3k0d/Technews/issues
- Documentation : Ce fichier README

---

**Dernière mise à jour** : 30 janvier 2026
