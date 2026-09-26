# CinemaHint Deployment Guide

## Overview
CinemaHint is an AI-powered movie recommendation web application that helps users discover their next favorite movie through personalized suggestions.

**Website**: https://cinemahint.com

## Architecture
- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js + Express + MongoDB
- **Deployment**: Vercel (Frontend) + MongoDB Atlas (Database)
- **Authentication**: Google OAuth 2.0
- **AI**: OpenAI GPT API
- **Movie Data**: The Movie Database (TMDB) API

## Pre-deployment Checklist

### 1. Environment Variables Setup

#### Client (.env)
```env
VITE_API_BASE=https://cinemahint.com/api
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
VITE_APP_NAME=CinemaHint
VITE_APP_URL=https://cinemahint.com
```

#### Server (.env)
```env
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/cinemahint?retryWrites=true&w=majority
REDIS_URL=redis://your-redis-url:6379
JWT_SECRET=your-super-secure-jwt-secret-key-min-32-chars-long
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
TMDB_API_KEY=your-themoviedb-api-key
OPENAI_API_KEY=sk-your-openai-api-key
FRONTEND_URL=https://cinemahint.com
ALLOWED_ORIGINS=https://cinemahint.com,https://www.cinemahint.com
DAILY_RECOMMENDATION_LIMIT=10
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
LOG_LEVEL=info
```

### 2. Required Services Setup

#### MongoDB Atlas
1. Create a MongoDB Atlas cluster
2. Create a database user with read/write permissions
3. Whitelist Vercel's IP addresses (or use 0.0.0.0/0 for all IPs)
4. Get the connection string and update `MONGODB_URI`

#### Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized origins: `https://cinemahint.com`
6. Add authorized redirect URIs: `https://cinemahint.com`
7. Copy the Client ID to both client and server environment variables

#### TMDB API
1. Sign up at [The Movie Database](https://www.themoviedb.org/)
2. Go to Settings > API
3. Request an API key
4. Copy the API key to `TMDB_API_KEY`

#### OpenAI API
1. Sign up at [OpenAI](https://platform.openai.com/)
2. Create an API key
3. Copy the API key to `OPENAI_API_KEY`
4. Ensure you have sufficient credits/billing set up

#### Redis (Optional but Recommended)
1. Sign up for a Redis service (Redis Cloud, Upstash, etc.)
2. Get the connection URL
3. Update `REDIS_URL` environment variable

## Vercel Deployment Steps

### 1. Deploy Backend
1. Create a new Vercel project
2. Connect your GitHub repository
3. Set the root directory to `server`
4. Configure environment variables in Vercel dashboard
5. Deploy the backend

### 2. Deploy Frontend
1. Create another Vercel project (or use the same one with different settings)
2. Set the root directory to `client`
3. Configure build settings:
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Configure environment variables in Vercel dashboard
5. Deploy the frontend

### 3. Domain Configuration
1. In Vercel dashboard, go to your frontend project
2. Navigate to Settings > Domains
3. Add your custom domain: `cinemahint.com`
4. Follow Vercel's instructions to configure DNS records
5. Enable automatic HTTPS

## Post-deployment Verification

### 1. Health Checks
- [ ] Website loads at https://cinemahint.com
- [ ] Google OAuth login works
- [ ] Movie recommendations generate successfully
- [ ] Watchlist functionality works
- [ ] Profile page displays correctly
- [ ] Movie gallery loads
- [ ] Mobile responsiveness works
- [ ] PWA features work (installable, offline support)

### 2. Performance Checks
- [ ] Page load speed < 3 seconds
- [ ] Core Web Vitals pass
- [ ] Images optimize and load quickly
- [ ] API responses are fast

### 3. SEO Checks
- [ ] Meta tags are correct
- [ ] Open Graph tags work (test with Facebook debugger)
- [ ] Twitter cards work
- [ ] Sitemap.xml accessible
- [ ] Robots.txt accessible
- [ ] Structured data validates

## Monitoring & Maintenance

### 1. Vercel Analytics
- Enable Vercel Analytics for performance monitoring
- Set up alerts for deployment failures

### 2. Database Monitoring
- Monitor MongoDB Atlas for performance and usage
- Set up alerts for connection issues

### 3. API Usage Monitoring
- Monitor OpenAI API usage and costs
- Monitor TMDB API rate limits
- Set up billing alerts

### 4. Regular Maintenance
- Update dependencies monthly
- Monitor security vulnerabilities
- Review and rotate API keys quarterly
- Back up database regularly

## Troubleshooting

### Common Issues

#### 1. OAuth Not Working
- Verify Google Client ID is correct in both environments
- Check authorized origins and redirect URIs in Google Console
- Ensure domain matches exactly (no trailing slashes)

#### 2. API Errors
- Check environment variables are set correctly
- Verify API keys are valid and have sufficient credits
- Check network connectivity and firewall settings

#### 3. Database Connection Issues
- Verify MongoDB URI is correct
- Check IP whitelist in MongoDB Atlas
- Ensure database user has correct permissions

#### 4. Build Failures
- Check Node.js version compatibility
- Verify all dependencies are installed
- Check for TypeScript/ESLint errors

### Support
For technical issues:
1. Check Vercel deployment logs
2. Check browser console for errors
3. Check database logs in MongoDB Atlas
4. Review API usage in respective dashboards

## Security Considerations

### 1. Environment Variables
- Never commit .env files to version control
- Use strong, unique JWT secrets
- regularly rotate API keys

### 2. CORS Configuration
- Restrict allowed origins to your domain only
- Use HTTPS everywhere in production

### 3. Rate Limiting
- Configure appropriate rate limits
- Monitor for abuse patterns

### 4. Data Protection
- Encrypt sensitive data
- Follow GDPR/privacy law requirements
- Implement proper session management

## Performance Optimization

### 1. Frontend
- Implement code splitting
- Optimize images and assets
- Use CDN for static assets
- Enable compression

### 2. Backend
- Implement Redis caching
- Optimize database queries
- Use connection pooling
- Enable gzip compression

### 3. Database
- Create appropriate indexes
- Monitor query performance
- Implement data archiving if needed

---

## Quick Deploy Commands

```bash
# Install dependencies
cd client && npm install
cd ../server && npm install

# Build frontend
cd client && npm run build

# Test locally
cd client && npm run preview
cd ../server && npm start

# Deploy to Vercel (after setting up project)
vercel --prod
```

## Environment Variables Checklist
- [ ] `VITE_GOOGLE_CLIENT_ID` (Client)
- [ ] `VITE_API_BASE` (Client)
- [ ] `MONGODB_URI` (Server)
- [ ] `JWT_SECRET` (Server)
- [ ] `GOOGLE_CLIENT_ID` (Server)
- [ ] `TMDB_API_KEY` (Server)
- [ ] `OPENAI_API_KEY` (Server)
- [ ] `FRONTEND_URL` (Server)
- [ ] `NODE_ENV=production` (Server)

Remember to test thoroughly in a staging environment before deploying to production!