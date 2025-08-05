#!/bin/bash

# AWS EC2 Setup Script for CinemaHint
# This script prepares a fresh Ubuntu EC2 instance for deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Update system packages
update_system() {
    log "Updating system packages..."
    sudo apt-get update
    sudo apt-get upgrade -y
    sudo apt-get install -y \
        apt-transport-https \
        ca-certificates \
        curl \
        gnupg \
        lsb-release \
        wget \
        unzip \
        htop \
        ufw \
        fail2ban
    
    info "System packages updated."
}

# Install Docker
install_docker() {
    log "Installing Docker..."
    
    # Remove old versions
    sudo apt-get remove -y docker docker-engine docker.io containerd runc || true
    
    # Add Docker's official GPG key
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    
    # Add Docker repository
    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
        $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io
    
    # Add user to docker group
    sudo usermod -aG docker $USER
    
    # Enable Docker service
    sudo systemctl enable docker
    sudo systemctl start docker
    
    info "Docker installed successfully."
}

# Install Docker Compose
install_docker_compose() {
    log "Installing Docker Compose..."
    
    # Get latest version
    COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d\" -f4)
    
    # Download and install
    sudo curl -L "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    
    # Create symlink
    sudo ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
    
    info "Docker Compose installed successfully."
}

# Configure firewall
configure_firewall() {
    log "Configuring firewall..."
    
    # Reset UFW
    sudo ufw --force reset
    
    # Default policies
    sudo ufw default deny incoming
    sudo ufw default allow outgoing
    
    # Allow SSH (important!)
    sudo ufw allow ssh
    sudo ufw allow 22
    
    # Allow HTTP and HTTPS
    sudo ufw allow 80
    sudo ufw allow 443
    
    # Allow application port (if needed for direct access)
    sudo ufw allow 5000
    
    # Enable firewall
    sudo ufw --force enable
    
    info "Firewall configured."
}

# Configure fail2ban
configure_fail2ban() {
    log "Configuring fail2ban..."
    
    # Create custom jail configuration
    sudo tee /etc/fail2ban/jail.local > /dev/null <<EOF
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
port = ssh
logpath = %(sshd_log)s
backend = %(sshd_backend)s

[nginx-http-auth]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log

[nginx-limit-req]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 10
EOF
    
    # Restart fail2ban
    sudo systemctl restart fail2ban
    sudo systemctl enable fail2ban
    
    info "Fail2ban configured."
}

# Setup swap (recommended for small instances)
setup_swap() {
    log "Setting up swap space..."
    
    # Check if swap already exists
    if sudo swapon --show | grep -q "/swapfile"; then
        info "Swap already configured."
        return
    fi
    
    # Create swap file (2GB)
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    
    # Make permanent
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    
    # Optimize swap usage
    echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
    echo 'vm.vfs_cache_pressure=50' | sudo tee -a /etc/sysctl.conf
    
    info "Swap space configured (2GB)."
}

# Install Node.js (for development/debugging)
install_nodejs() {
    log "Installing Node.js..."
    
    # Install NodeSource repository
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
    
    # Install PM2 for process management (if needed)
    sudo npm install -g pm2
    
    info "Node.js installed."
}

# Setup log rotation
setup_log_rotation() {
    log "Setting up log rotation..."
    
    # Create logrotate configuration for application logs
    sudo tee /etc/logrotate.d/cinemahint > /dev/null <<EOF
/home/ubuntu/MovieRecommendor/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 ubuntu ubuntu
}

/var/log/nginx/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    postrotate
        systemctl reload nginx
    endscript
}
EOF
    
    info "Log rotation configured."
}

# Install monitoring tools
install_monitoring() {
    log "Installing monitoring tools..."
    
    # Install htop, iostat, etc.
    sudo apt-get install -y htop iotop nethogs sysstat
    
    # Install Docker stats monitoring
    sudo npm install -g ctop
    
    info "Monitoring tools installed."
}

# Create application directory structure
create_app_structure() {
    log "Creating application directory structure..."
    
    # Create main directory
    mkdir -p /home/ubuntu/MovieRecommendor
    cd /home/ubuntu/MovieRecommendor
    
    # Create subdirectories
    mkdir -p logs backups monitoring nginx/ssl scripts
    
    # Set permissions
    sudo chown -R ubuntu:ubuntu /home/ubuntu/MovieRecommendor
    
    info "Application directory structure created."
}

# Install SSL tools
install_ssl_tools() {
    log "Installing SSL certificate tools..."
    
    sudo apt-get install -y certbot python3-certbot-nginx
    
    info "SSL tools installed."
}

# Performance tuning
performance_tuning() {
    log "Applying performance tuning..."
    
    # Increase file descriptor limits
    echo "ubuntu soft nofile 65536" | sudo tee -a /etc/security/limits.conf
    echo "ubuntu hard nofile 65536" | sudo tee -a /etc/security/limits.conf
    
    # Network performance tuning
    sudo tee -a /etc/sysctl.conf > /dev/null <<EOF

# Network performance tuning for CinemaHint
net.core.rmem_max = 134217728
net.core.wmem_max = 134217728
net.ipv4.tcp_rmem = 4096 65536 134217728
net.ipv4.tcp_wmem = 4096 65536 134217728
net.ipv4.tcp_congestion_control = bbr
net.core.default_qdisc = fq
EOF
    
    # Apply sysctl changes
    sudo sysctl -p
    
    info "Performance tuning applied."
}

# Setup automated backups to S3 (optional)
setup_s3_backup() {
    log "Setting up S3 backup (optional)..."
    
    # Install AWS CLI
    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
    unzip awscliv2.zip
    sudo ./aws/install
    rm -rf aws awscliv2.zip
    
    # Create backup script for S3
    cat > /home/ubuntu/MovieRecommendor/scripts/s3-backup.sh << 'EOF'
#!/bin/bash
# S3 Backup Script for CinemaHint

# Configuration (set these values)
S3_BUCKET="your-backup-bucket"
AWS_REGION="us-east-1"

# Backup Redis data
docker exec cinemahint-redis redis-cli BGSAVE
docker cp cinemahint-redis:/data/dump.rdb /tmp/redis-backup-$(date +%Y%m%d).rdb

# Upload to S3
aws s3 cp /tmp/redis-backup-$(date +%Y%m%d).rdb s3://$S3_BUCKET/redis/ --region $AWS_REGION

# Backup application logs
docker-compose logs > /tmp/app-logs-$(date +%Y%m%d).log
aws s3 cp /tmp/app-logs-$(date +%Y%m%d).log s3://$S3_BUCKET/logs/ --region $AWS_REGION

# Cleanup local temp files
rm -f /tmp/redis-backup-*.rdb /tmp/app-logs-*.log

echo "S3 backup completed: $(date)"
EOF
    
    chmod +x /home/ubuntu/MovieRecommendor/scripts/s3-backup.sh
    
    info "S3 backup script created. Configure AWS credentials and S3 bucket to enable."
}

# Main setup function
main() {
    log "Starting AWS EC2 setup for CinemaHint..."
    
    update_system
    install_docker
    install_docker_compose
    install_nodejs
    configure_firewall
    configure_fail2ban
    setup_swap
    setup_log_rotation
    install_monitoring
    install_ssl_tools
    create_app_structure
    performance_tuning
    setup_s3_backup
    
    log "AWS EC2 setup completed successfully!"
    
    info "Next steps:"
    echo "1. Configure AWS credentials if using S3 backup: aws configure"
    echo "2. Clone your repository: git clone <your-repo-url> /home/ubuntu/MovieRecommendor"
    echo "3. Copy your .env file with production values"
    echo "4. Run the deployment script: ./scripts/deploy.sh"
    echo ""
    info "Useful commands:"
    echo "  Check Docker: docker --version && docker-compose --version"
    echo "  Check firewall: sudo ufw status"
    echo "  Check services: sudo systemctl status docker"
    echo "  View logs: sudo journalctl -u docker"
    echo ""
    warn "IMPORTANT: Log out and log back in for Docker group changes to take effect!"
}

# Run main function
main "$@"