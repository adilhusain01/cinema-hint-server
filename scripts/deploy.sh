#!/bin/bash

# CinemaHint Deployment Script for AWS EC2
# This script automates the deployment process

set -e  # Exit on any error

# Configuration
PROJECT_NAME="cinemahint"
DOCKER_REGISTRY="your-docker-registry.com"  # Replace with your registry
GITHUB_REPO="https://github.com/yourusername/MovieRecommendor.git"  # Replace with your repo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Check if running as root
check_root() {
    if [ "$EUID" -eq 0 ]; then
        error "Please don't run this script as root"
    fi
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker first."
    fi
    
    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed. Please install Docker Compose first."
    fi
    
    # Check if Git is installed
    if ! command -v git &> /dev/null; then
        error "Git is not installed. Please install Git first."
    fi
    
    info "All prerequisites are installed."
}

# Install system dependencies
install_dependencies() {
    log "Installing system dependencies..."
    
    sudo apt-get update
    sudo apt-get install -y \
        curl \
        wget \
        unzip \
        htop \
        nginx \
        certbot \
        python3-certbot-nginx
    
    info "System dependencies installed."
}

# Setup environment variables
setup_environment() {
    log "Setting up environment variables..."
    
    if [ ! -f .env ]; then
        if [ -f .env.example ]; then
            cp .env.example .env
            warn "Please edit .env file with your production values"
            warn "IMPORTANT: Update the following variables in .env:"
            echo "  - MONGODB_URI (use your MongoDB Atlas connection string)"
            echo "  - REDIS_URL (use your Redis instance URL)"
            echo "  - JWT_SECRET (generate a secure secret)"
            echo "  - GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET"
            echo "  - TMDB_API_KEY and OPENAI_API_KEY"
            echo "  - FRONTEND_URL (your domain)"
            read -p "Press Enter after updating .env file..."
        else
            error ".env.example file not found. Please create environment configuration."
        fi
    fi
    
    info "Environment variables configured."
}

# Build Docker images
build_images() {
    log "Building Docker images..."
    
    # Build production image
    docker build -t $PROJECT_NAME:latest .
    
    # Tag for registry if specified
    if [ "$DOCKER_REGISTRY" != "your-docker-registry.com" ]; then
        docker tag $PROJECT_NAME:latest $DOCKER_REGISTRY/$PROJECT_NAME:latest
        docker tag $PROJECT_NAME:latest $DOCKER_REGISTRY/$PROJECT_NAME:$(date +%Y%m%d-%H%M%S)
    fi
    
    info "Docker images built successfully."
}

# Deploy with Docker Compose
deploy_application() {
    log "Deploying application with Docker Compose..."
    
    # Stop existing containers
    docker-compose down || true
    
    # Remove old containers and images
    docker system prune -f
    
    # Start services
    docker-compose --profile production up -d
    
    # Wait for services to be healthy
    log "Waiting for services to be healthy..."
    sleep 30
    
    # Check health
    if docker-compose ps | grep -q "Up.*healthy"; then
        log "Application deployed successfully!"
    else
        error "Deployment failed. Check logs with: docker-compose logs"
    fi
}

# Setup SSL with Let's Encrypt
setup_ssl() {
    local domain="$1"
    
    if [ -z "$domain" ]; then
        warn "No domain provided. Skipping SSL setup."
        return
    fi
    
    log "Setting up SSL for domain: $domain"
    
    # Stop nginx if running
    sudo systemctl stop nginx 2>/dev/null || true
    
    # Get SSL certificate
    sudo certbot certonly --standalone \
        --non-interactive \
        --agree-tos \
        --email admin@$domain \
        -d $domain \
        -d www.$domain
    
    # Copy certificates to nginx directory
    sudo mkdir -p nginx/ssl
    sudo cp /etc/letsencrypt/live/$domain/fullchain.pem nginx/ssl/cert.pem
    sudo cp /etc/letsencrypt/live/$domain/privkey.pem nginx/ssl/private.key
    sudo chown $(whoami):$(whoami) nginx/ssl/*
    
    # Update nginx configuration for HTTPS
    sed -i 's/# return 301/return 301/' nginx/conf.d/default.conf
    
    info "SSL configured for $domain"
}

# Setup monitoring
setup_monitoring() {
    log "Setting up monitoring..."
    
    # Create monitoring directory
    mkdir -p monitoring
    
    # Simple health check script
    cat > monitoring/health_check.sh << 'EOF'
#!/bin/bash
# Simple health monitoring script

HEALTH_URL="http://localhost:5000/api/health"
ALERT_EMAIL="admin@cinemahint.com"  # Replace with your email

check_health() {
    local response=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)
    
    if [ "$response" != "200" ]; then
        echo "$(date): Health check failed - HTTP $response" >> /var/log/cinemahint-health.log
        
        # Send alert (requires mail setup)
        # echo "CinemaHint health check failed" | mail -s "Service Alert" $ALERT_EMAIL
        
        return 1
    fi
    
    return 0
}

check_health
EOF
    
    chmod +x monitoring/health_check.sh
    
    # Add to crontab for regular health checks
    (crontab -l 2>/dev/null; echo "*/5 * * * * $(pwd)/monitoring/health_check.sh") | crontab -
    
    info "Monitoring setup complete."
}

# Backup script
setup_backup() {
    log "Setting up backup system..."
    
    mkdir -p backups
    
    cat > backups/backup.sh << 'EOF'
#!/bin/bash
# Backup script for CinemaHint

BACKUP_DIR="/home/$(whoami)/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Backup Redis data
docker exec cinemahint-redis redis-cli BGSAVE
docker cp cinemahint-redis:/data/dump.rdb $BACKUP_DIR/redis_$DATE.rdb

# Backup application logs
docker-compose logs > $BACKUP_DIR/app_logs_$DATE.log

# Cleanup old backups (keep last 7 days)
find $BACKUP_DIR -name "*.rdb" -mtime +7 -delete
find $BACKUP_DIR -name "*.log" -mtime +7 -delete

echo "Backup completed: $DATE"
EOF
    
    chmod +x backups/backup.sh
    
    # Add to crontab for daily backups
    (crontab -l 2>/dev/null; echo "0 2 * * * $(pwd)/backups/backup.sh") | crontab -
    
    info "Backup system configured."
}

# Main deployment function
main() {
    log "Starting CinemaHint deployment..."
    
    check_root
    check_prerequisites
    
    # Clone or update repository
    if [ ! -d ".git" ]; then
        log "Cloning repository..."
        git clone $GITHUB_REPO .
    else
        log "Updating repository..."
        git pull origin main
    fi
    
    install_dependencies
    setup_environment
    build_images
    deploy_application
    
    # Optional SSL setup
    read -p "Do you want to setup SSL? Enter your domain (or press Enter to skip): " domain
    if [ ! -z "$domain" ]; then
        setup_ssl "$domain"
        
        # Restart nginx container with SSL
        docker-compose restart nginx
    fi
    
    setup_monitoring
    setup_backup
    
    log "Deployment completed successfully!"
    info "Your application is now running at:"
    
    if [ ! -z "$domain" ]; then
        echo "  https://$domain"
        echo "  https://www.$domain"
    else
        echo "  http://$(curl -s ifconfig.me):80"
    fi
    
    info "Useful commands:"
    echo "  View logs: docker-compose logs -f"
    echo "  Check status: docker-compose ps"
    echo "  Stop services: docker-compose down"
    echo "  Update app: ./scripts/deploy.sh"
}

# Run main function
main "$@"