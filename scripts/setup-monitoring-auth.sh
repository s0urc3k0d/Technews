#!/bin/bash
# ===========================================
# Script de génération du fichier .htpasswd
# Pour l'accès au monitoring (Grafana/Prometheus)
# ===========================================

set -e

HTPASSWD_FILE="./docker/nginx/.htpasswd"
USERNAME="${1:-admin}"

echo "🔐 Génération du fichier .htpasswd pour le monitoring"
echo "======================================================"

# Vérifier si htpasswd est installé
if ! command -v htpasswd &> /dev/null; then
    echo "Installation de apache2-utils..."
    if command -v apt-get &> /dev/null; then
        sudo apt-get update && sudo apt-get install -y apache2-utils
    elif command -v apk &> /dev/null; then
        apk add --no-cache apache2-utils
    else
        echo "❌ Impossible d'installer htpasswd. Installez-le manuellement."
        exit 1
    fi
fi

# Demander le mot de passe si non fourni
if [ -z "$2" ]; then
    echo ""
    echo "Entrez le mot de passe pour l'utilisateur '$USERNAME':"
    read -s PASSWORD
    echo ""
    echo "Confirmez le mot de passe:"
    read -s PASSWORD_CONFIRM
    echo ""
    
    if [ "$PASSWORD" != "$PASSWORD_CONFIRM" ]; then
        echo "❌ Les mots de passe ne correspondent pas."
        exit 1
    fi
else
    PASSWORD="$2"
fi

# Créer le répertoire si nécessaire
mkdir -p "$(dirname "$HTPASSWD_FILE")"

# Générer le fichier .htpasswd
htpasswd -cb "$HTPASSWD_FILE" "$USERNAME" "$PASSWORD"

echo ""
echo "✅ Fichier .htpasswd créé avec succès!"
echo "   Emplacement: $HTPASSWD_FILE"
echo "   Utilisateur: $USERNAME"
echo ""
echo "📊 Accès au monitoring:"
echo "   - Grafana:    https://revuetech.fr/grafana/"
echo "   - Prometheus: https://revuetech.fr/prometheus/"
echo ""
echo "⚠️  N'oubliez pas de redémarrer nginx après modification:"
echo "   docker-compose -f docker-compose.prod.yml restart nginx"
