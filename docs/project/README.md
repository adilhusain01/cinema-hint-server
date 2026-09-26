# 🎬 CinemaHint - AI Movie Recommendation Platform

**A full-stack movie recommendation platform with AI-powered suggestions, built with React, Node.js, MongoDB, and Redis.**

## 🚀 **Live Production URLs**

- **Frontend**: https://cinemahint.vercel.app
- **API**: https://cinemahint.adilhusain.me/api
- **Health Check**: https://cinemahint.adilhusain.me/api/health

---

## 🏗️ **Architecture**

### **Frontend** (Vercel)
- **React** with Vite
- **Tailwind CSS** for styling
- **Google OAuth** authentication
- **Responsive design** for mobile/desktop

### **Backend** (AWS EC2)
- **Node.js/Express** API server
- **MongoDB Atlas** for data storage
- **Redis** for caching and sessions
- **Docker** containerization
- **nginx** reverse proxy with SSL

### **Infrastructure**
- **AWS EC2** for server hosting
- **Let's Encrypt** SSL certificates
- **Docker Compose** for orchestration
- **Automated backups** and monitoring

---

## ✨ **Features**

- 🎯 **AI-Powered Recommendations** using OpenAI GPT
- 🔐 **Google OAuth Authentication**
- ❤️ **Watchlist Management**
- 👍 **Movie Rating & Feedback**  
- 🎭 **Genre & Preference Selection**
- 🚫 **Deal-breaker Filters**
- 📱 **Mobile-Responsive Design**
- ⚡ **Redis Caching** for performance
- 🔍 **Movie Search & Gallery**
- 📊 **User Profile & History**

---

## 🛠️ **Technology Stack**

### Frontend
- React 18 + Vite
- Tailwind CSS
- Google OAuth 2.0
- Axios for API calls

### Backend  
- Node.js + Express
- MongoDB with Mongoose
- Redis for caching
- JWT authentication
- TMDB API integration
- OpenAI API integration

### Infrastructure
- Docker + Docker Compose
- nginx reverse proxy
- AWS EC2 hosting
- MongoDB Atlas
- Let's Encrypt SSL
- GitHub Actions (optional CI/CD)

---

## 🚀 **Quick Start - Local Development**

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- Redis (optional, will fallback gracefully)

### 1. Clone Repository
```bash
git clone https://github.com/your-username/MovieRecommendor.git
cd MovieRecommendor
```

### 2. Setup Backend
```bash
cd server
npm install
cp .env.example .env
# Edit .env with your API keys
npm run dev
```

### 3. Setup Frontend
```bash
cd ../client  
npm install
# Update .env with API endpoint
npm run dev
```

### 4. Visit Application
- Frontend: http://localhost:5173
- Backend: http://localhost:5000/api/health

---

## 🌐 **Production Deployment**

### Deploy to AWS EC2
```bash
# See complete guide in server/DEPLOY_AWS.md
cd server
./scripts/aws-setup.sh    # Setup EC2 instance
./scripts/deploy.sh       # Deploy application
```

### Deploy Frontend to Vercel
```bash
# Push to GitHub, then connect to Vercel
# Set environment variables in Vercel dashboard:
VITE_API_BASE=https://your-api-domain.com/api
VITE_GOOGLE_CLIENT_ID=your-google-client-id
```

### Scaling for High Traffic
```bash
# See complete scaling guide in server/DEPLOY_SCALE.md  
./scripts/scale-deploy.sh  # Deploy with load balancing
```

---

## 📚 **Documentation**

- **[AWS Deployment Guide](server/DEPLOY_AWS.md)** - Complete production deployment
- **[Scaling Guide](server/DEPLOY_SCALE.md)** - Load balancing & high availability
- **[API Documentation](server/API.md)** - REST API endpoints
- **[Environment Variables](server/.env.example)** - Configuration options

---

## 🔧 **Configuration**

### Required API Keys
```env
# Google OAuth (console.cloud.google.com)
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret

# TMDB API (themoviedb.org/settings/api)
TMDB_API_KEY=your-tmdb-key

# OpenAI API (platform.openai.com/api-keys)
OPENAI_API_KEY=your-openai-key

# MongoDB Atlas (mongodb.com/cloud/atlas)  
MONGODB_URI=mongodb+srv://user:pass@cluster.net/db
```

### Environment Setup
- **Development**: Use `.env` files in both `/server` and `/client`
- **Production**: Set environment variables in hosting platforms
- **Docker**: Environment variables are passed through `docker-compose.yml`

---

## 🧪 **Testing**

### Run Tests
```bash
# Backend tests
cd server
npm test

# Frontend tests  
cd client
npm test

# E2E tests
npm run test:e2e
```

### Load Testing
```bash
# Test API performance
ab -n 1000 -c 50 https://your-api.com/api/health
```

---

## 🐳 **Docker Development**

### Local Docker Setup
```bash
cd server
docker-compose up -d     # Start all services
docker-compose ps        # Check status
docker-compose logs -f   # View logs
```

### Production Docker
```bash
docker-compose --profile production up -d
```

---

## 📈 **Performance Features**

- ⚡ **Redis Caching**: User profiles, movie data, API responses
- 🔄 **Connection Pooling**: MongoDB and Redis optimizations
- 📦 **Compression**: Gzip compression for API responses
- 🛡️ **Rate Limiting**: Protection against API abuse
- 📊 **Health Checks**: Automated monitoring and healing
- 🚀 **CDN Ready**: Static assets optimized for CDN delivery

---

## 🔒 **Security Features**

- 🔐 **OAuth 2.0**: Secure Google authentication
- 🛡️ **JWT Tokens**: Stateless authentication
- 🚫 **Rate Limiting**: DDoS protection
- 📝 **Input Validation**: SQL injection prevention
- 🔒 **HTTPS**: SSL/TLS encryption
- 🛡️ **Security Headers**: XSS, CSRF protection
- 🚧 **CORS**: Configured for production domains

---

## 📊 **Monitoring**

- ❤️ **Health Checks**: `/api/health` endpoint
- 📝 **Logging**: Structured logging with timestamps
- 📈 **Metrics**: Redis and database performance
- 🔍 **Error Tracking**: Comprehensive error handling
- 📱 **Alerts**: Automated failure notifications

---

## 🤝 **Contributing**

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new features
5. Submit a pull request

---

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 **Acknowledgments**

- **TMDB API** for movie data
- **OpenAI** for AI recommendations
- **Google OAuth** for authentication
- **Vercel** for frontend hosting
- **MongoDB Atlas** for database hosting

---

## 📞 **Support**

- **Issues**: [GitHub Issues](https://github.com/your-username/MovieRecommendor/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/MovieRecommendor/discussions)
- **Email**: your-email@domain.com

---

**🎬 Built with ❤️ for movie lovers everywhere!**