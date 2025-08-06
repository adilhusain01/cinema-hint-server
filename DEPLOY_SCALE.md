# 🚀 CinemaHint Scaling & Load Balancing Guide

**Guide for scaling CinemaHint to handle high traffic with load balancing, clustering, and horizontal scaling.**

## 📊 When to Scale

Scale your deployment when you experience:
- ✅ High CPU usage (> 80% consistently)
- ✅ High memory usage (> 90% consistently) 
- ✅ Response times > 2 seconds
- ✅ More than 1000 concurrent users
- ✅ Database connection limits reached

---

## 🏗️ Scaling Architecture Options

### Option 1: Vertical Scaling (Scale Up)
**Upgrade your EC2 instance:**
- `t3.medium` → `t3.large` → `t3.xlarge`
- `c5.large` → `c5.xlarge` (CPU optimized)
- `r5.large` → `r5.xlarge` (Memory optimized)

### Option 2: Horizontal Scaling (Scale Out) ⭐ Recommended
**Multiple instances with load balancing:**
- Application Load Balancer (ALB)
- Multiple EC2 instances
- Redis cluster
- MongoDB Atlas (already scalable)

---

## 🎯 Option 2: Horizontal Scaling Setup

### Architecture Overview:
```
Internet → AWS ALB → [EC2-1, EC2-2, EC2-3] → MongoDB Atlas
                        ↓
                   Redis Cluster
```

---

## 🔧 Step 1: Load Balancer Setup

### 1.1 Create Application Load Balancer
**In AWS Console → EC2 → Load Balancers:**

1. **Create Application Load Balancer**
2. **Scheme**: Internet-facing
3. **IP address type**: IPv4
4. **Listeners**: HTTP (80), HTTPS (443)
5. **Availability Zones**: Select 2+ AZs
6. **Security Groups**: Allow HTTP/HTTPS from internet

### 1.2 Target Group Configuration
```bash
# Target Group Settings:
Protocol: HTTP
Port: 80
Health check path: /api/health
Health check interval: 30 seconds
Healthy threshold: 2
Unhealthy threshold: 5
```

### 1.3 SSL Certificate (ALB Level)
**Use AWS Certificate Manager:**
1. Request certificate for `api.yourdomain.com`
2. Add certificate to ALB HTTPS listener
3. Redirect HTTP → HTTPS

---

## 🖥️ Step 2: Multiple EC2 Instances

### 2.1 Launch Additional Instances
```bash
# Launch 2-3 additional EC2 instances
# Use same AMI/configuration as your working instance
# Or create AMI from working instance for consistency
```

### 2.2 Deploy to Each Instance
**On each new instance:**
```bash
# Clone and setup
git clone https://github.com/your-username/MovieRecommendor.git
cd MovieRecommendor/server

# Copy .env from working instance
scp -i key.pem ubuntu@working-instance:/path/to/.env .env

# Deploy
docker-compose up -d
```

### 2.3 Update nginx for ALB
**On each instance, update nginx configuration:**
```nginx
# Remove SSL from nginx (ALB handles SSL termination)
server {
    listen 80;
    server_name _;
    
    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
    
    # Proxy to application
    location / {
        proxy_pass http://cinemahint_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 30s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

---

## 🗄️ Step 3: Redis Clustering

### 3.1 External Redis Setup
**Option A: AWS ElastiCache Redis**
```bash
# Create Redis cluster in ElastiCache
# Update .env on all instances:
REDIS_URL=your-elasticache-endpoint:6379
```

**Option B: Redis Cluster with Docker**
```yaml
# docker-compose.redis.yml for dedicated Redis instance
version: '3.8'
services:
  redis-master:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    
  redis-replica-1:
    image: redis:7-alpine
    command: redis-server --replicaof redis-master 6379 --appendonly yes
    depends_on:
      - redis-master
    
  redis-replica-2:
    image: redis:7-alpine
    command: redis-server --replicaof redis-master 6379 --appendonly yes
    depends_on:
      - redis-master

volumes:
  redis_data:
```

### 3.2 Update Application for Redis Cluster
```javascript
// In your Redis configuration, add cluster support
const redis = require('redis');

const client = redis.createCluster({
  rootNodes: [
    { host: 'redis-master', port: 6379 },
    { host: 'redis-replica-1', port: 6379 },
    { host: 'redis-replica-2', port: 6379 }
  ],
  defaults: {
    password: process.env.REDIS_PASSWORD
  }
});
```

---

## 🚀 Step 4: Scaled Deployment

### 4.1 Use Scaling Docker Compose
```bash
# Use the scaling configuration
docker-compose -f docker-compose.yml -f docker-compose.scale.yml up -d

# Scale application containers
docker-compose -f docker-compose.yml -f docker-compose.scale.yml up -d --scale app=3
```

### 4.2 Automated Deployment Script
```bash
# Use the scaling deployment script
chmod +x scripts/scale-deploy.sh
./scripts/scale-deploy.sh

# This will:
# - Deploy with 3 app instances
# - Setup Redis cluster
# - Configure load balancing
# - Setup monitoring
```

---

## 📊 Step 5: Monitoring & Auto-Scaling

### 5.1 CloudWatch Monitoring
**Set up CloudWatch alarms:**
```bash
# CPU Utilization > 80%
# Memory Utilization > 85%  
# Response Time > 2 seconds
# Error Rate > 5%
```

### 5.2 Auto Scaling Group (Advanced)
**Create Auto Scaling Group:**
1. **Launch Template**: Use your working instance AMI
2. **Min**: 2 instances
3. **Max**: 10 instances  
4. **Desired**: 3 instances
5. **Scaling Policies**: Based on CPU/Memory

### 5.3 Application Monitoring
```yaml
# Add Prometheus & Grafana for detailed monitoring
services:
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      
  grafana:
    image: grafana/grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
```

---

## ⚡ Step 6: Performance Optimization

### 6.1 Database Optimization
```javascript
// Connection pooling for MongoDB
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI, {
  maxPoolSize: 50,        // Maximum number of connections
  minPoolSize: 10,        // Minimum number of connections
  maxIdleTimeMS: 30000,   // Close connections after 30 seconds of inactivity
  serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
});
```

### 6.2 Redis Optimization
```redis
# redis.conf optimizations for high traffic
maxmemory 1gb
maxmemory-policy allkeys-lru
tcp-keepalive 300
timeout 300

# Connection pooling
maxclients 10000
```

### 6.3 Application Optimization
```javascript
// Add clustering to your Node.js app
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  
  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died`);
    cluster.fork();
  });
} else {
  // Start your Express app
  require('./server.js');
}
```

---

## 🔧 Step 7: Testing Scaled Setup

### 7.1 Load Testing
```bash
# Install Apache Bench
sudo apt install apache2-utils

# Test with 1000 requests, 50 concurrent
ab -n 1000 -c 50 https://api.yourdomain.com/api/health

# Test with wrk (more advanced)
wrk -t12 -c400 -d30s https://api.yourdomain.com/api/health
```

### 7.2 Failover Testing
```bash
# Stop one instance to test failover
docker-compose stop app

# Traffic should automatically route to other instances
# Check ALB target group health in AWS Console
```

---

## 📈 Performance Targets (Scaled)

### Expected Performance:
- ✅ Handle 10,000+ concurrent users
- ✅ Response time < 200ms for cached requests
- ✅ Response time < 1s for database queries
- ✅ 99.99% uptime with redundancy
- ✅ Auto-scaling based on demand

### Scaling Metrics:
- ✅ CPU usage < 60% average across instances
- ✅ Memory usage < 70% average across instances
- ✅ Redis hit rate > 90%
- ✅ Database connection pool utilization < 80%

---

## 💰 Cost Optimization

### Cost-Effective Scaling:
1. **Use Spot Instances** for non-critical workloads
2. **Auto Scaling** to reduce instances during low traffic
3. **Reserved Instances** for baseline capacity
4. **CloudWatch monitoring** to optimize resource usage

### Estimated Costs (US-East-1):
- **ALB**: ~$20/month
- **3x t3.medium**: ~$90/month
- **ElastiCache Redis**: ~$50/month  
- **Total**: ~$160/month (high availability)

---

## 🚨 Troubleshooting Scaled Setup

### Common Issues:

#### 1. Session Stickiness
**Problem**: User sessions not persisting across instances
**Solution**: Use Redis for session storage
```javascript
const session = require('express-session');
const RedisStore = require('connect-redis')(session);

app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));
```

#### 2. Database Connection Limits
**Problem**: Too many database connections
**Solution**: Connection pooling and optimization
```javascript
// Limit connections per instance
mongoose.connect(uri, {
  maxPoolSize: 20  // Reduce if you have many instances
});
```

#### 3. Redis Memory Issues
**Problem**: Redis running out of memory
**Solution**: 
```redis
# Increase Redis memory or use LRU eviction
maxmemory 2gb
maxmemory-policy allkeys-lru
```

---

## 📋 Scaling Checklist

**Before Scaling:**
- [ ] Monitor current resource usage
- [ ] Identify bottlenecks
- [ ] Test application with load testing tools
- [ ] Backup current working setup

**During Scaling:**
- [ ] Setup Application Load Balancer
- [ ] Launch additional EC2 instances
- [ ] Configure external Redis/ElastiCache
- [ ] Update DNS to point to ALB
- [ ] Configure health checks
- [ ] Test failover scenarios

**After Scaling:**
- [ ] Monitor performance improvements
- [ ] Verify auto-scaling policies
- [ ] Test complete user flows
- [ ] Setup automated monitoring alerts
- [ ] Document new architecture

---

## 🎯 **Your CinemaHint is now enterprise-ready!**

**Scaled Architecture:**
- ✅ **Load Balanced**: Multiple instances with ALB
- ✅ **High Availability**: Auto-failover and redundancy
- ✅ **Auto Scaling**: Dynamic scaling based on demand
- ✅ **Performance**: Optimized for thousands of concurrent users
- ✅ **Monitoring**: Complete observability and alerting

**Ready to handle viral traffic!** 🚀