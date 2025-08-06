# 🚀 Production Deployment Guide for CinemaHint

**Frontend**: https://cinemahint.vercel.app (Vercel)  
**Backend**: AWS EC2 (this server)  
**Database**: MongoDB Atlas  

## ✅ Pre-Deployment Checklist

All configurations have been updated for your production setup:

- ✅ **Frontend URL**: Updated to `https://cinemahint.vercel.app`
- ✅ **CORS Headers**: Configured for your Vercel domain
- ✅ **MongoDB**: Configured for Atlas (no local container)
- ✅ **Redis**: Containerized for caching
- ✅ **Docker**: Server-only build optimized
- ✅ **nginx**: API proxy with proper CORS

## 🔧 Environment Configuration

Create your `.env` file with these exact values:

```env
# Environment
NODE_ENV=production
PORT=5000

# Database - Your MongoDB Atlas connection string
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/cinemahint?retryWrites=true&w=majority

# Redis (Docker container)
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your-secure-redis-password

# Authentication & Security
JWT_SECRET=your-super-secure-32-character-jwt-secret
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret

# External APIs
TMDB_API_KEY=your-tmdb-api-key
OPENAI_API_KEY=your-openai-api-key

# CORS & Frontend - Vercel Integration
FRONTEND_URL=https://cinemahint.vercel.app
ALLOWED_ORIGINS=https://cinemahint.vercel.app

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

## 🚀 AWS EC2 Deployment Steps

### 1. Setup EC2 Instance
```bash
# Connect to your EC2 instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# Run AWS setup script
wget https://raw.githubusercontent.com/your-username/MovieRecommendor/main/server/scripts/aws-setup.sh
chmod +x aws-setup.sh
./aws-setup.sh
```

### 2. Clone Server Repository
```bash
# Create server directory
mkdir -p /home/ubuntu/cinemahint-server
cd /home/ubuntu/cinemahint-server

# Clone your repository
git clone https://github.com/your-username/MovieRecommendor.git .

# Navigate to server folder
cd server

# Or if you have a separate server repository:
# git clone https://github.com/your-username/cinemahint-server.git .
```

### 3. Configure Environment
```bash
# Copy environment template
cp .env.example .env

# Edit with your production values
nano .env

# IMPORTANT: Add your real API keys and MongoDB Atlas connection string!
```

### 4. Fix Docker Permissions
```bash
# Add user to docker group and apply changes
newgrp docker

# Test Docker access
docker --version
docker ps
```

### 5. Deploy Server
```bash
# Make deploy script executable
chmod +x scripts/deploy.sh

# Deploy the server
./scripts/deploy.sh
```

## 📊 Post-Deployment Verification

### 1. Check Services Status
```bash
# Check all containers
docker-compose ps

# Should show:
# - cinemahint-redis (healthy)
# - cinemahint-app (healthy)  
# - cinemahint-nginx (running)
```

### 2. Test API Endpoints
```bash
# Health check
curl http://localhost/api/health

# Should return: {"status":"ok","timestamp":"...","services":...}
```

### 3. Test CORS from Vercel
Your Vercel app at `https://cinemahint.vercel.app` should now be able to make API calls to:
```
http://your-ec2-ip/api/auth/google
http://your-ec2-ip/api/users/profile
http://your-ec2-ip/api/movies/recommendations
# etc...
```

## 🔗 Frontend Integration

Update your Vercel frontend's API base URL to:
```javascript
// In your React app's API configuration
const API_BASE_URL = "http://your-ec2-public-ip";

// Example API calls:
fetch(`${API_BASE_URL}/api/auth/google`, {
  method: 'POST',
  credentials: 'include', // Important for CORS cookies
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(data)
});
```

## 🛡️ Security Features Enabled

- ✅ CORS configured specifically for `https://cinemahint.vercel.app`
- ✅ Rate limiting on API endpoints
- ✅ Security headers (XSS, CSRF protection)
- ✅ UFW firewall configured
- ✅ fail2ban for intrusion prevention
- ✅ Redis password protection
- ✅ JWT secure cookies

## 📈 Monitoring & Maintenance

### Check Application Health
```bash
# View logs
docker-compose logs -f

# Check resource usage
docker stats

# Check Redis cache performance
docker exec -it cinemahint-redis redis-cli info stats
```

### Daily Maintenance Commands
```bash
# Restart services if needed
docker-compose restart

# Update application (pull latest changes)
git pull origin main
docker-compose build --no-cache
docker-compose up -d
```

## 🚨 Troubleshooting

### Common Issues:

1. **CORS Errors**: Ensure your Vercel app URL matches exactly in nginx config
2. **MongoDB Connection**: Verify MongoDB Atlas connection string and whitelist EC2 IP
3. **API Not Accessible**: Check security group allows HTTP (80) and your app port (5000)
4. **Redis Connection**: Verify Redis container is running with `docker-compose ps`

### Get Your EC2 Public IP:
```bash
curl -s ifconfig.me
```

## 🎯 Final Steps

1. ✅ Deploy server to EC2 using steps above
2. ✅ Get your EC2 public IP address  
3. ✅ Update your Vercel frontend to use: `http://your-ec2-ip/api/`
4. ✅ Test the full application flow
5. ✅ Purchase domain and configure SSL (optional)

**Your CinemaHint server is production-ready for MongoDB Atlas + Vercel integration!** 🎬