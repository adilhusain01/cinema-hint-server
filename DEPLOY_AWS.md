# 🚀 CinemaHint AWS EC2 Deployment Guide

**Complete guide for deploying CinemaHint server to AWS EC2 with HTTPS, MongoDB Atlas, and Vercel integration.**

## 📋 Prerequisites

### Required Services:
- **AWS EC2 Instance** (t3.medium or larger, Ubuntu 20.04+)
- **MongoDB Atlas** cluster
- **Domain name** (for SSL) - e.g., `yourdomain.com`
- **Vercel** frontend deployment

### Required API Keys:
- Google OAuth Client ID & Secret
- TMDB API Key  
- OpenAI API Key
- MongoDB Atlas connection string

---

## 🛠️ Step 1: Launch AWS EC2 Instance

### 1.1 EC2 Instance Setup
```bash
# Instance type: t3.medium (4GB RAM, 2 vCPU)
# Operating System: Ubuntu 20.04 LTS
# Storage: 20GB SSD
```

### 1.2 Security Group Configuration
**Inbound Rules:**
- SSH (22) - Your IP only
- HTTP (80) - 0.0.0.0/0
- HTTPS (443) - 0.0.0.0/0
- Custom TCP (5000) - 0.0.0.0/0 (optional for direct API access)

### 1.3 Connect to Instance
```bash
# Connect via SSH
ssh -i your-key.pem ubuntu@your-ec2-public-ip

# Update system
sudo apt update && sudo apt upgrade -y
```

---

## 🔧 Step 2: Server Setup & Installation

### 2.1 Run Automated Setup Script
```bash
# Download and run AWS setup script
wget https://raw.githubusercontent.com/your-username/MovieRecommendor/main/server/scripts/aws-setup.sh
chmod +x aws-setup.sh
./aws-setup.sh
```

**This script installs:**
- ✅ Docker & Docker Compose
- ✅ Nginx (system level)
- ✅ UFW Firewall
- ✅ fail2ban security
- ✅ Certbot for SSL
- ✅ Monitoring tools
- ✅ Log rotation

### 2.2 Manual Installation (Alternative)
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose  
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install other dependencies
sudo apt install -y nginx certbot python3-certbot-nginx ufw fail2ban htop
```

---

## 📂 Step 3: Deploy Application

### 3.1 Clone Repository
```bash
# Create application directory
mkdir -p /home/ubuntu/cinemahint-server
cd /home/ubuntu/cinemahint-server

# Clone your repository
git clone https://github.com/your-username/MovieRecommendor.git .
cd server

# Or clone directly if you have separate server repo
# git clone https://github.com/your-username/cinemahint-server.git .
```

### 3.2 Configure Environment
```bash
# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env
```

**Required Environment Variables:**
```env
# Environment
NODE_ENV=production
PORT=5000

# Database - MongoDB Atlas
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/cinemahint?retryWrites=true&w=majority

# Redis (Docker container)
REDIS_URL=redis://localhost:6379

# Authentication & Security
JWT_SECRET=your-super-secure-32-character-jwt-secret
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret

# External APIs
TMDB_API_KEY=your-tmdb-api-key
OPENAI_API_KEY=your-openai-api-key

# CORS & Frontend - Vercel Integration
FRONTEND_URL=https://your-app.vercel.app
ALLOWED_ORIGINS=https://your-app.vercel.app,http://localhost:3000,http://localhost:5173

# Domain Configuration (update with your domain)
API_DOMAIN=https://api.yourdomain.com

# Performance Settings
DAILY_RECOMMENDATION_LIMIT=5
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Caching (Redis TTL in seconds)
REDIS_TTL_USER_PROFILE=1800
REDIS_TTL_MOVIE_DETAILS=3600
REDIS_TTL_TMDB_POPULAR=900
REDIS_TTL_TMDB_SEARCH=600

# Logging & Monitoring
LOG_LEVEL=info
HEALTH_CHECK_TIMEOUT=5000

# Security
TRUST_PROXY=true
SECURE_COOKIES=true
```

---

## 🌐 Step 4: Domain & DNS Configuration

### 4.1 DNS Setup
**In your domain registrar (Namecheap, GoDaddy, etc.):**

Add **A Record:**
- **Host**: `api` (or `cinemahint`)
- **Value**: Your EC2 public IP address  
- **TTL**: 300 (5 minutes)

**Result**: `api.yourdomain.com` → Your EC2 IP

### 4.2 Update nginx Configuration
```bash
# Update server name in nginx config
sed -i 's/cinemahint.adilhusain.me/api.yourdomain.com/g' nginx/conf.d/default.conf
```

---

## 🔒 Step 5: SSL Certificate Setup

### 5.1 Test HTTP Access First
```bash
# Deploy without SSL first
docker-compose up -d

# Check status
docker-compose ps

# Test HTTP access
curl http://api.yourdomain.com/api/health
```

### 5.2 Get SSL Certificate
```bash
# Stop nginx container to free port 80
docker-compose stop nginx

# Get Let's Encrypt certificate
sudo certbot certonly --standalone \
  --non-interactive \
  --agree-tos \
  --email your-email@gmail.com \
  --domains api.yourdomain.com

# Copy certificates to nginx directory
sudo mkdir -p nginx/ssl
sudo cp /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/api.yourdomain.com/privkey.pem nginx/ssl/private.key
sudo chown $USER:$USER nginx/ssl/*

# Start nginx with SSL
docker-compose up -d nginx
```

### 5.3 Setup Auto-Renewal
```bash
# Add certbot auto-renewal to crontab
echo "0 12 * * * /usr/bin/certbot renew --quiet && docker-compose restart nginx" | sudo crontab -
```

---

## 🔧 Step 6: Deploy Application

### 6.1 Build and Start Services
```bash
# Build and start all services
docker-compose up -d

# Check all services are running
docker-compose ps

# Should show:
# - cinemahint-redis (healthy)
# - cinemahint-app (healthy)
# - cinemahint-nginx (running)
```

### 6.2 Test Deployment
```bash
# Test health endpoint
curl https://api.yourdomain.com/api/health

# Test CORS preflight
curl -H "Origin: https://your-app.vercel.app" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://api.yourdomain.com/api/auth/google -v

# Should return proper CORS headers without duplicates
```

---

## 📱 Step 7: Frontend Integration

### 7.1 Update Google OAuth
**In Google Cloud Console → APIs & Services → Credentials:**

**Authorized JavaScript Origins:**
```
https://your-app.vercel.app
https://api.yourdomain.com
http://localhost:3000
http://localhost:5173
```

**Authorized Redirect URIs:**
```
https://your-app.vercel.app/auth/callback
https://your-app.vercel.app/
https://api.yourdomain.com/auth/callback
https://api.yourdomain.com/
http://localhost:3000/auth/callback
http://localhost:3000/
```

### 7.2 Update Vercel Environment Variables
**In Vercel Dashboard → Project → Settings → Environment Variables:**
```
VITE_API_BASE=https://api.yourdomain.com/api
VITE_GOOGLE_CLIENT_ID=your-google-client-id
```

### 7.3 Redeploy Frontend
Redeploy your Vercel frontend to pick up the new environment variables.

---

## 📊 Step 8: Monitoring & Maintenance

### 8.1 Health Checks
```bash
# Check application health
curl https://api.yourdomain.com/api/health

# Check Docker containers
docker-compose ps

# View logs
docker-compose logs -f

# Check resource usage
docker stats
```

### 8.2 Backup Configuration
```bash
# Manual backup
./backups/backup.sh

# Check automated backups (runs daily at 2 AM)
crontab -l

# View backup files
ls -la backups/
```

### 8.3 Useful Commands
```bash
# Restart services
docker-compose restart

# Update application
git pull origin main
docker-compose build --no-cache
docker-compose up -d

# Check nginx syntax
docker-compose exec nginx nginx -t

# View nginx logs
docker-compose logs nginx

# Check SSL certificate expiry
sudo certbot certificates
```

---

## 🚨 Troubleshooting

### Common Issues:

#### 1. CORS Errors
- ✅ Ensure nginx is NOT adding CORS headers (let Express handle it)
- ✅ Verify `ALLOWED_ORIGINS` in `.env` includes your Vercel domain
- ✅ Check Google OAuth origins include both domains

#### 2. SSL Certificate Issues
```bash
# Check certificate status
sudo certbot certificates

# Renew certificate manually
sudo certbot renew --dry-run

# Check nginx SSL configuration
docker-compose exec nginx nginx -t
```

#### 3. Container Health Issues
```bash
# Check container logs
docker-compose logs [service-name]

# Restart unhealthy containers
docker-compose restart [service-name]

# Rebuild containers
docker-compose down && docker-compose up -d --build
```

#### 4. Database Connection Issues
- ✅ Verify MongoDB Atlas connection string
- ✅ Check MongoDB Atlas network access (whitelist EC2 IP)
- ✅ Ensure database user has proper permissions

---

## 🎯 Performance Targets

### Expected Performance:
- ✅ Response time < 500ms for cached requests
- ✅ Response time < 2s for database queries  
- ✅ 99.9% uptime
- ✅ Redis hit rate > 80%

### Resource Usage:
- ✅ CPU usage < 70%
- ✅ Memory usage < 80%
- ✅ Disk usage < 85%

---

## 📝 Final Checklist

- [ ] EC2 instance launched with proper security groups
- [ ] Domain DNS pointing to EC2 IP
- [ ] SSL certificate installed and working
- [ ] All Docker containers running and healthy
- [ ] MongoDB Atlas connection working
- [ ] Redis caching functional
- [ ] CORS configured for Vercel domain
- [ ] Google OAuth updated with production URLs
- [ ] Vercel environment variables updated
- [ ] Health checks passing
- [ ] Auto-renewal for SSL configured
- [ ] Backups configured and tested
- [ ] Monitoring and logging setup

---

## 🚀 **Your CinemaHint API is now production-ready!**

**Access your API at**: `https://api.yourdomain.com/api/`
**Frontend**: `https://your-app.vercel.app`

For scaling and load balancing, see `DEPLOY_SCALE.md`.