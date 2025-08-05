#!/bin/bash

# CinemaHint Scaled Deployment Script
# This script deploys the application with load balancing and clustering

set -e

# Configuration
PROJECT_NAME="cinemahint"
SCALE_REPLICAS=3

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

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites for scaled deployment..."
    
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed"
    fi
    
    # Check system resources
    TOTAL_RAM=$(free -m | awk 'NR==2{printf "%.0f", $2}')
    if [ "$TOTAL_RAM" -lt 4096 ]; then
        warn "System has less than 4GB RAM. Scaled deployment may have performance issues."
    fi
    
    info "Prerequisites check passed."
}

# Setup environment for scaling
setup_scaled_environment() {
    log "Setting up scaled environment..."
    
    # Copy scaled configuration
    if [ ! -f .env.scale ]; then
        cp server/.env.example .env.scale
        
        # Add scaling-specific environment variables
        cat >> .env.scale << EOF

# Scaling Configuration
REDIS_CLUSTER_ENABLED=true
LOAD_BALANCER_ENABLED=true
APP_INSTANCES=3
MONGODB_ROOT_PASSWORD=$(openssl rand -base64 32)
GRAFANA_PASSWORD=$(openssl rand -base64 16)
EOF
        
        warn "Please update .env.scale with your production values"
        read -p "Press Enter after updating .env.scale file..."
    fi
    
    # Load environment variables
    export $(cat .env.scale | grep -v '^#' | xargs)
    
    info "Scaled environment configured."
}

# Deploy with scaling
deploy_scaled() {
    log "Deploying CinemaHint with load balancing..."
    
    # Stop existing containers
    docker-compose -f docker-compose.yml -f docker-compose.scale.yml down || true
    
    # Clean up old resources
    docker system prune -f
    
    # Create necessary directories
    mkdir -p nginx/cache logs/nginx monitoring/prometheus monitoring/grafana/dashboards monitoring/grafana/datasources
    
    # Build images
    docker build -t $PROJECT_NAME:latest .
    docker build -t $PROJECT_NAME-nginx:latest -f nginx/Dockerfile.scale nginx/
    
    # Start scaled services
    docker-compose -f docker-compose.yml -f docker-compose.scale.yml up -d
    
    info "Scaled deployment started."
}

# Setup monitoring
setup_monitoring() {
    log "Setting up monitoring and metrics..."
    
    # Create Prometheus configuration
    cat > monitoring/prometheus.yml << EOF
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  # - "first_rules.yml"

scrape_configs:
  - job_name: 'cinemahint-app'
    static_configs:
      - targets: ['app_1:5000', 'app_2:5000', 'app_3:5000']
        labels:
          service: 'cinemahint-backend'
    
  - job_name: 'nginx'
    static_configs:
      - targets: ['nginx:80']
        labels:
          service: 'nginx-loadbalancer'
    
  - job_name: 'redis'
    static_configs:
      - targets: ['redis-master:6379']
        labels:
          service: 'redis-master'
    
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['host.docker.internal:9100']
        labels:
          service: 'system-metrics'
EOF

    # Create Grafana datasource
    mkdir -p monitoring/grafana/datasources
    cat > monitoring/grafana/datasources/prometheus.yml << EOF
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
EOF

    # Start monitoring services if requested
    read -p "Start monitoring services (Prometheus/Grafana)? [y/N]: " start_monitoring
    if [[ $start_monitoring =~ ^[Yy]$ ]]; then
        docker-compose -f docker-compose.yml -f docker-compose.scale.yml --profile monitoring up -d
        info "Monitoring services started. Access at:"
        echo "  Prometheus: http://localhost:9090"
        echo "  Grafana: http://localhost:3000 (admin/admin)"
    fi
}

# Health check for scaled deployment
health_check() {
    log "Performing health checks..."
    
    # Wait for services to start
    sleep 30
    
    # Check load balancer
    if curl -f http://localhost/api/health > /dev/null 2>&1; then
        info "✅ Load balancer health check passed"
    else
        error "❌ Load balancer health check failed"
    fi
    
    # Check individual app instances
    for i in {1..3}; do
        if docker exec cinemahint_app_$i curl -f http://localhost:5000/api/health > /dev/null 2>&1; then
            info "✅ App instance $i health check passed"
        else
            warn "⚠️ App instance $i health check failed"
        fi
    done
    
    # Check Redis cluster
    if docker exec cinemahint-redis-master redis-cli ping | grep -q PONG; then
        info "✅ Redis master health check passed"
    else
        warn "⚠️ Redis master health check failed"
    fi
    
    log "Health checks completed."
}

# Performance test
performance_test() {
    log "Running basic performance test..."
    
    if command -v ab &> /dev/null; then
        info "Running Apache Bench test (100 requests, 10 concurrent)..."
        ab -n 100 -c 10 http://localhost/api/health
    elif command -v curl &> /dev/null; then
        info "Running basic load test with curl..."
        for i in {1..10}; do
            curl -s -w "Response time: %{time_total}s\n" http://localhost/api/health > /dev/null
        done
    else
        warn "No performance testing tools available (ab or curl)"
    fi
}

# Show deployment status
show_status() {
    log "Deployment Status:"
    echo ""
    
    # Show running containers
    docker-compose -f docker-compose.yml -f docker-compose.scale.yml ps
    echo ""
    
    # Show resource usage
    info "Resource Usage:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
    echo ""
    
    # Show URLs
    info "Application URLs:"
    echo "  Main Application: http://localhost"
    echo "  Health Check: http://localhost/api/health"
    echo "  Nginx Status: http://localhost/nginx-status"
    echo ""
    
    info "Useful Commands:"
    echo "  View logs: docker-compose -f docker-compose.yml -f docker-compose.scale.yml logs -f"
    echo "  Scale up: docker-compose -f docker-compose.yml -f docker-compose.scale.yml up -d --scale app=5"
    echo "  Scale down: docker-compose -f docker-compose.yml -f docker-compose.scale.yml up -d --scale app=2"
    echo "  Stop all: docker-compose -f docker-compose.yml -f docker-compose.scale.yml down"
}

# Cleanup function
cleanup() {
    log "Cleaning up scaled deployment..."
    docker-compose -f docker-compose.yml -f docker-compose.scale.yml down
    docker system prune -f
    info "Cleanup completed."
}

# Main deployment function
main() {
    log "Starting CinemaHint scaled deployment..."
    
    check_prerequisites
    setup_scaled_environment
    deploy_scaled
    setup_monitoring
    health_check
    performance_test
    show_status
    
    log "Scaled deployment completed successfully!"
    
    info "Your load-balanced CinemaHint application is now running!"
    echo "Monitor performance and scale as needed using Docker Compose commands."
}

# Handle script arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "cleanup")
        cleanup
        ;;
    "status")
        show_status
        ;;
    "health")
        health_check
        ;;
    *)
        echo "Usage: $0 [deploy|cleanup|status|health]"
        echo "  deploy  - Deploy scaled application (default)"
        echo "  cleanup - Stop and clean up deployment"
        echo "  status  - Show deployment status"
        echo "  health  - Run health checks"
        exit 1
        ;;
esac