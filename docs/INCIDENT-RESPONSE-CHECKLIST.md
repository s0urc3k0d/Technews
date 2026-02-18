# Incident response checklist (TechNews / Coolify)

> Contexte: suspicion de process malveillant (ex: `/tmp/.XIN-unix/javae`) dans un conteneur.
> Objectif: confiner, collecter des preuves minimales, restaurer proprement et durcir.

## 1) Confinement immédiat (5-10 min)

```bash
mkdir -p /root/ir-$(date +%F-%H%M) && cd /root/ir-$(date +%F-%H%M)
docker ps --no-trunc > docker-ps.txt
docker stats --no-stream > docker-stats.txt
for c in $(docker ps -q); do
  echo "=== $c ===" >> proc-scan.txt
  docker top "$c" -eo pid,user,cmd >> proc-scan.txt
done
grep -Ei "javae|XIN-unix|/tmp/|sentinel" proc-scan.txt
```

Si un conteneur est suspect:

```bash
docker logs <container_name_or_id> --tail 1000 > suspect.log
docker stop <container_name_or_id>
docker rm -f <container_name_or_id>
```

## 2) Vérifier persistance côté hôte (10 min)

```bash
ps -ef | grep -Ei "javae|XIN-unix" | grep -v grep
crontab -l || true
sudo ls -al /etc/cron* /var/spool/cron /var/spool/cron/crontabs
sudo grep -R "tmp\|curl\|wget\|base64\|chattr" /etc/cron* /var/spool/cron /etc/systemd/system 2>/dev/null
sudo systemctl list-unit-files --state=enabled
sudo find /tmp /var/tmp /dev/shm -maxdepth 4 -type f \( -name "javae" -o -name "*XIN*" \)
```

## 3) Rebuild/redeploy propre

```bash
# depuis le repo de déploiement
docker compose -f docker-compose.coolify.yml build --no-cache
docker compose -f docker-compose.coolify.yml up -d --force-recreate

docker image prune -af
docker container prune -f
```

## 4) Rotation des secrets (obligatoire)

Régénérer et redéployer:

- `AUTH0_SECRET`
- `JWT_SECRET`
- `SESSION_SECRET`
- `DATABASE_URL` (nouveau mot de passe DB)
- `REDIS_URL` (auth si activée)
- clés API tierces (`MISTRAL_API_KEY`, `RESEND_API_KEY`, etc.)
- tokens d’administration Coolify

Ensuite invalider les sessions applicatives actives.

## 5) Vérification post-remédiation

```bash
docker ps
docker stats --no-stream
for c in $(docker ps -q); do
  docker top "$c" -eo pid,user,args \
    | grep -Eiv "docker-buildx|compose-build-metadataFile" \
    | grep -Ei "\[javae\]|/tmp/\.XIN-unix|/dev/shm/duet|chattr \+i /tmp/\.XIN-unix" \
    && echo "FOUND in $c"
done
```

Vérifier aussi:

- frontend répond sans 5xx
- backend `/health` OK
- pas de pic CPU anormal durable

## 6) Durcissement minimal recommandé

- Exécuter les services en utilisateur non-root
- `security_opt: ["no-new-privileges:true"]`
- `cap_drop: ["ALL"]` quand possible (éviter sur `redis`/`postgres` qui font des opérations d'init volume au démarrage)
- `read_only: true` + `tmpfs: ["/tmp:rw,noexec,nosuid,size=64m"]` pour services stateless
- ne pas exposer de ports publiquement sans nécessité
- SSH en clés uniquement + fail2ban + mises à jour OS/Docker régulières

## 7) À éviter (faux sentiment de sécurité)

Bloquer un chemin avec `chattr +i` (ex: `/tmp/.XIN-unix/javae`) peut gêner un binaire, mais ne supprime pas une compromission déjà en place.
La priorité reste: confinement, rotation des secrets, redeploy propre et hardening.
