# CI/CD Pipeline Setup for CinemaHint Server

This document explains the automated CI/CD pipeline for deploying the CinemaHint server to AWS EC2.

## 🚀 Pipeline Overview

The CI/CD pipeline consists of three main workflows:

### 1. **Test and Build** (`test-and-build.yml`)
- **Triggers**: Push to `main`/`develop`, PRs to `main`
- **Purpose**: Runs tests, builds Docker image, performs security scans
- **Steps**:
  - Checkout code
  - Setup Node.js environment
  - Install dependencies
  - Run tests and linting
  - Build and test Docker image
  - Security audit

### 2. **Deploy Server** (`deploy-server.yml`)
- **Triggers**: Push to `main`, manual dispatch
- **Purpose**: Deploys to AWS EC2 production environment
- **Steps**:
  - Run tests and build
  - Deploy to EC2 via SSH
  - Health checks and verification
  - Rollback on failure

### 3. **Emergency Rollback** (`rollback.yml`)
- **Triggers**: Manual dispatch only
- **Purpose**: Emergency rollback to previous version
- **Steps**:
  - Backup current state
  - Rollback to specified commit
  - Health verification
  - Incident logging

## 🔧 Setup Instructions

### 1. GitHub Secrets Configuration

Add the following secrets to your **server repository** (`Settings > Secrets and variables > Actions`):

```bash
# EC2 Connection
EC2_HOST=cinemahint.adilhusain.me  # or your EC2 IP
EC2_USERNAME=ubuntu               # your EC2 username
EC2_SSH_KEY=your-private-ssh-key-content
EC2_SSH_PORT=22                  # optional, defaults to 22
```

### 2. SSH Key Setup

1. **Generate SSH key pair** (if not already done):
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/cinemahint-deploy -C "deploy@cinemahint"
   ```

2. **Add public key to EC2**:
   ```bash
   # Copy public key content
   cat ~/.ssh/cinemahint-deploy.pub
   
   # Add to EC2 ~/.ssh/authorized_keys
   ssh ubuntu@cinemahint.adilhusain.me
   echo "your-public-key-content" >> ~/.ssh/authorized_keys
   ```

3. **Add private key to GitHub Secrets**:
   - Copy the entire private key content (including headers)
   - Add as `EC2_SSH_KEY` secret in GitHub

### 3. EC2 Server Directory Structure

Ensure your EC2 instance has this directory structure:

```bash
# SSH into your EC2 instance
ssh ubuntu@cinemahint.adilhusain.me

# Navigate to server directory (adjust path as needed)
cd /home/ubuntu/cinemahint-server

# Or if it's in a different location:
# cd /home/ubuntu/MovieRecommendor/server

# Ensure your .env file is properly configured
ls -la .env

# Test current deployment
docker-compose ps
```

## 📁 Server Repository Structure

Your server repository should maintain this structure:

```
cinemahint-server/
├── .github/
│   └── workflows/
│       ├── deploy-server.yml
│       ├── test-and-build.yml
│       └── rollback.yml
├── Dockerfile
├── docker-compose.yml
├── package.json
├── server.js
├── nginx/
├── scripts/
├── routes/
├── models/
├── CICD_SETUP.md
└── README.md
```

## 🔄 Deployment Workflow

### Automatic Deployment

1. **Push changes** to `main` branch
2. **GitHub Actions** automatically triggers:
   - Tests run first (lint, unit tests, Docker build)
   - If tests pass, deployment to EC2 begins
3. **SSH connection** to EC2 server
4. **Git pull** latest changes
5. **Docker rebuild** and container restart with zero downtime
6. **Health checks** verify successful deployment
7. **Notification** of deployment status

### Manual Deployment

1. Go to your server repository on GitHub
2. Navigate to **Actions** tab
3. Select **Deploy Server to AWS EC2** workflow
4. Click **Run workflow**
5. Choose branch and click **Run workflow**

### Emergency Rollback

1. Go to **Actions** tab in your server repository
2. Select **Emergency Rollback** workflow
3. Click **Run workflow**
4. Specify:
   - **Target commit**: `HEAD~1` (previous commit) or specific commit SHA
   - **Reason**: Description of why you're rolling back
5. Click **Run workflow**

## 🔍 Monitoring and Debugging

### Check Deployment Status

```bash
# SSH to EC2
ssh ubuntu@cinemahint.adilhusain.me

# Navigate to server directory
cd /home/ubuntu/cinemahint-server

# Check service status
docker-compose ps

# View logs
docker-compose logs -f

# Check health
curl https://cinemahint.adilhusain.me/api/health
```

### GitHub Actions Logs

- Go to repository **Actions** tab
- Click on the workflow run
- View detailed logs for each step
- Download logs if needed

### Common Issues

1. **SSH Connection Failed**
   ```bash
   # Test SSH connection manually
   ssh -i ~/.ssh/cinemahint-deploy ubuntu@cinemahint.adilhusain.me
   
   # Check EC2 security group allows SSH (port 22)
   # Verify SSH key format in GitHub secrets
   ```

2. **Health Check Failed**
   ```bash
   # Check application logs
   docker-compose logs app
   
   # Verify environment variables
   cat .env
   
   # Check Redis and database connections
   docker-compose logs redis
   ```

3. **Docker Build Failed**
   ```bash
   # Test build locally
   docker build -t test-build .
   
   # Check Dockerfile syntax
   # Verify dependencies in package.json
   ```

## 🛡️ Security Features

- **SSH key authentication** (no passwords)
- **Secrets management** via GitHub Secrets
- **Security scanning** with npm audit
- **Secret detection** in code
- **SSL/HTTPS** enforced via Nginx
- **Container security** with non-root user

## 🎯 Production Deployment Path

Your deployment path should be:
```
GitHub (server repo) 
    ↓ 
GitHub Actions 
    ↓ 
SSH to EC2 
    ↓ 
/home/ubuntu/cinemahint-server 
    ↓ 
Docker Compose 
    ↓ 
https://cinemahint.adilhusain.me
```

## ✅ Next Steps

1. **Set up GitHub Secrets** with your EC2 connection details
2. **Test SSH connection** manually first
3. **Push a small change** to trigger the pipeline
4. **Monitor the deployment** in GitHub Actions
5. **Verify** the application at https://cinemahint.adilhusain.me

## 🆘 Support

If you encounter issues:

1. Check GitHub Actions logs for detailed error messages
2. Verify all secrets are set correctly in repository settings
3. Test SSH connection manually: `ssh ubuntu@cinemahint.adilhusain.me`
4. Check EC2 security groups allow SSH (port 22) and HTTPS (port 443)
5. Review server logs via SSH: `docker-compose logs`

---

**Ready to deploy!** 🚀 Push your changes to the main branch to see the CI/CD pipeline in action.