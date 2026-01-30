#!/bin/bash
# ===========================================
# TechNews - Script de déploiement
# ===========================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 TechNews Deployment Script${NC}"
echo "=================================="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Please run as root${NC}"
    exit 1
fi

# Configuration
DOMAIN="${DOMAIN:-revuetech.fr}"
EMAIL="${EMAIL:-admin@revuetech.fr}"
APP_DIR="${APP_DIR:-/var/www/revuetech}"
BACKUP_DIR="${BACKUP_DIR:-/var/www/revuetech/backups}"

# ===========================================
# Function: Install Dependencies
# ===========================================
install_dependencies() {
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    
    apt-get update
    apt-get install -y \
        curl \
        git \
        docker.io \
        docker-compose \
        certbot \
        ufw
    
    # Enable and start Docker
    systemctl enable docker
    systemctl start docker
    
    echo -e "${GREEN}✅ Dependencies installed${NC}"
}

# ===========================================
# Function: Setup SSL with Let's Encrypt
# ===========================================
setup_ssl() {
    echo -e "${YELLOW}🔐 Setting up SSL...${NC}"
    
    # Stop nginx if running
    docker-compose -f $APP_DIR/docker-compose.prod.yml stop nginx 2>/dev/null || true
    
    # Get certificate
    certbot certonly \
        --standalone \
        --agree-tos \
        --no-eff-email \
        --email $EMAIL \
        -d $DOMAIN \
        -d www.$DOMAIN
    
    echo -e "${GREEN}✅ SSL certificate obtained${NC}"
}

# ===========================================
# Function: Setup Firewall
# ===========================================
setup_firewall() {
    echo -e "${YELLOW}🛡️ Setting up firewall...${NC}"
    
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow ssh
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw --force enable
    
    echo -e "${GREEN}✅ Firewall configured${NC}"
}

# ===========================================
# Function: Clone/Update Repository
# ===========================================
setup_app() {
    echo -e "${YELLOW}📁 Setting up application...${NC}"
    
    if [ -d "$APP_DIR" ]; then
        cd $APP_DIR
        git pull origin main
    else
        git clone https://github.com/s0urc3k0d/Technews.git $APP_DIR
        cd $APP_DIR
    fi
    
    # Copy environment file
    if [ ! -f "$APP_DIR/.env" ]; then
        cp $APP_DIR/.env.example $APP_DIR/.env
        echo -e "${YELLOW}⚠️  Please edit $APP_DIR/.env with your configuration${NC}"
    fi
    
    echo -e "${GREEN}✅ Application ready${NC}"
}

# ===========================================
# Function: Setup Backups
# ===========================================
setup_backups() {
    echo -e "${YELLOW}💾 Setting up backups...${NC}"
    
    mkdir -p $BACKUP_DIR
    
    # Create backup script
    cat > /usr/local/bin/revuetech-backup.sh << 'BACKUP_SCRIPT'
#!/bin/bash
BACKUP_DIR="/var/www/revuetech/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
APP_DIR="/var/www/revuetech"

# Backup database
cd $APP_DIR
docker-compose exec -T postgres pg_dump -U revuetech revuetech > $BACKUP_DIR/db_$TIMESTAMP.sql

# Backup uploads
tar -czf $BACKUP_DIR/uploads_$TIMESTAMP.tar.gz $APP_DIR/uploads/

# Keep only last 7 days
find $BACKUP_DIR -type f -mtime +7 -delete

echo "Backup completed: $TIMESTAMP"
BACKUP_SCRIPT
    
    chmod +x /usr/local/bin/revuetech-backup.sh
    
    # Add to crontab (daily at 2 AM)
    (crontab -l 2>/dev/null | grep -v revuetech-backup; echo "0 2 * * * /usr/local/bin/revuetech-backup.sh") | crontab -
    
    echo -e "${GREEN}✅ Backups configured${NC}"
}

# ===========================================
# Function: Deploy Application
# ===========================================
deploy() {
    echo -e "${YELLOW}🚢 Deploying application...${NC}"
    
    cd $APP_DIR
    
    # Build and start containers
    docker-compose -f docker-compose.prod.yml build
    docker-compose -f docker-compose.prod.yml up -d
    
    # Wait for services
    echo "Waiting for services to start..."
    sleep 10
    
    # Run migrations
    docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
    
    # Health check
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/v1/health | grep -q "200"; then
        echo -e "${GREEN}✅ Backend is healthy${NC}"
    else
        echo -e "${RED}❌ Backend health check failed${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Deployment complete!${NC}"
    echo ""
    echo "🌐 Your site is available at: https://$DOMAIN"
    echo "📊 Grafana: http://localhost:3002 (admin/admin)"
    echo "📈 Prometheus: http://localhost:9090"
}

# ===========================================
# Function: Show Status
# ===========================================
status() {
    echo -e "${YELLOW}📊 Application Status${NC}"
    cd $APP_DIR
    docker-compose -f docker-compose.prod.yml ps
}

# ===========================================
# Function: View Logs
# ===========================================
logs() {
    cd $APP_DIR
    docker-compose -f docker-compose.prod.yml logs -f ${1:-}
}

# ===========================================
# Function: Restart Services
# ===========================================
restart() {
    echo -e "${YELLOW}🔄 Restarting services...${NC}"
    cd $APP_DIR
    docker-compose -f docker-compose.prod.yml restart
    echo -e "${GREEN}✅ Services restarted${NC}"
}

# ===========================================
# Main
# ===========================================
case "${1:-deploy}" in
    install)
        install_dependencies
        ;;
    ssl)
        setup_ssl
        ;;
    firewall)
        setup_firewall
        ;;
    setup)
        setup_app
        ;;
    backup)
        setup_backups
        ;;
    deploy)
        deploy
        ;;
    full)
        install_dependencies
        setup_firewall
        setup_app
        setup_ssl
        setup_backups
        deploy
        ;;
    status)
        status
        ;;
    logs)
        logs $2
        ;;
    restart)
        restart
        ;;
    *)
        echo "Usage: $0 {install|ssl|firewall|setup|backup|deploy|full|status|logs|restart}"
        echo ""
        echo "Commands:"
        echo "  install   - Install system dependencies"
        echo "  ssl       - Setup Let's Encrypt SSL"
        echo "  firewall  - Configure UFW firewall"
        echo "  setup     - Clone/update application"
        echo "  backup    - Setup automatic backups"
        echo "  deploy    - Deploy application"
        echo "  full      - Complete installation"
        echo "  status    - Show container status"
        echo "  logs      - View logs (optionally specify service)"
        echo "  restart   - Restart all services"
        exit 1
        ;;
esac
