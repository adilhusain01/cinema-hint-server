# CinemaHint Server Deployment

This is the server-only deployment for CinemaHint movie recommendation API. The client will be deployed separately to Vercel.

## 🚀 Quick AWS EC2 Deployment

### 1. Setup EC2 Instance
```bash
# On your EC2 instance
wget https://raw.githubusercontent.com/your-username/MovieRecommendor/main/server/scripts/aws-setup.sh
chmod +x aws-setup.sh
./aws-setup.sh
```

### 2. Clone Server Repository
```bash
# Navigate to server directory
cd /home/ubuntu/cinemahint-server

# Clone only the server folder (or full repo and navigate to server)
git clone https://github.com/your-username/MovieRecommendor.git .
cd server
```

### 3. Configure Environment
```bash
# Copy environment template
cp .env.example .env

# Edit with your production values
nano .env
```

### 4. Deploy Server
```bash
# Make sure you're in the server directory
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

## 📋 Required Environment Variables

```env
# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/cinemahint
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-secure-32-char-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# External APIs
TMDB_API_KEY=your-tmdb-api-key
OPENAI_API_KEY=your-openai-api-key

# CORS for Vercel Frontend
FRONTEND_URL=https://your-vercel-app.vercel.app
ALLOWED_ORIGINS=https://your-vercel-app.vercel.app
```

## 🔗 Frontend Integration

Your Vercel-deployed React app should make API calls to:
```
http://your-ec2-ip/api/
```

## 📊 Monitoring

- **Health Check**: `http://your-ec2-ip/api/health`
- **Logs**: `docker-compose logs -f`
- **Status**: `docker-compose ps`

## 🔧 Available Scripts

- `scripts/deploy.sh` - Basic production deployment
- `scripts/scale-deploy.sh` - Load-balanced deployment with 3+ instances
- `scripts/aws-setup.sh` - Initial EC2 instance setup

## 🏗️ Architecture

- **API Server**: Node.js/Express (port 5000)
- **Database**: MongoDB (containerized for development, Atlas for production)
- **Cache**: Redis (containerized)
- **Reverse Proxy**: Nginx with CORS for Vercel
- **Container**: Docker with health checks

## 🛡️ Security Features

- Rate limiting on API endpoints
- CORS configured for Vercel
- Security headers
- Firewall (UFW) configuration
- fail2ban for intrusion prevention
- SSL/HTTPS support (optional)

Perfect for server-only deployment with Vercel frontend!