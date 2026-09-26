# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

This is a full-stack movie recommendation application built with React + Vite frontend and Node.js/Express backend. The app provides AI-powered movie recommendations through a multi-step preference collection process.

**Technology Stack:**
- **Frontend**: React 18 + Vite, Tailwind CSS v4, Framer Motion, Lucide React icons
- **Backend**: Node.js/Express with comprehensive middleware stack
- **Database**: MongoDB with Mongoose ODM
- **Cache**: Redis (optional, graceful fallback)
- **External APIs**: TMDB for movie data, OpenAI GPT for recommendations
- **Auth**: Google OAuth 2.0 with JWT tokens

### Key Architecture Patterns

**Client-Side State Management:**
- Main app state managed in `App.jsx` with step-based navigation
- Custom `useGoogleAuth` hook for authentication flow
- Step progression: welcome → genres → movies → context → dealbreakers → processing → recommendation
- API communication centralized through `ApiClient` class in `utils/api.js`

**Server-Side Organization:**
- Modular route structure: `/api/auth`, `/api/movies`, `/api/users`
- Middleware stack: Helmet security, CORS, compression, rate limiting, error handling
- Models with advanced MongoDB features (Maps for genre-based preferences)
- Redis caching with graceful degradation
- External service integration with retry logic and timeout handling

**Data Storage Strategy:**
- User preferences stored as MongoDB Maps organized by genre names
- Movie data cached to prevent re-recommendations
- Recommendation history with deduplication
- Watchlist functionality with genre-based organization

## Development Commands

### Client Development
```bash
cd client
npm run dev          # Start Vite dev server (localhost:5173)
npm run build        # Production build
npm run lint         # ESLint with React hooks and refresh plugins
npm run preview      # Preview production build locally
```

### Server Development
```bash
cd server
npm run dev          # Start with nodemon auto-reload
npm start            # Production server start
npm test             # Jest test suite
```

### Full-Stack Development
Start both client and server in separate terminals for full development environment.

## Environment Configuration

### Client Environment (`.env` in `/client`)
```env
VITE_API_BASE=http://localhost:3001/api    # Backend API URL
VITE_GOOGLE_CLIENT_ID=your-client-id       # Google OAuth client ID
```

### Server Environment (`.env` in `/server`)
```env
# Database
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/cinemahint

# External APIs
OPENAI_API_KEY=sk-your-openai-key
TMDB_API_KEY=your-tmdb-api-key
GOOGLE_CLIENT_ID=your-google-client-id

# Security
JWT_SECRET=your-jwt-secret

# CORS & Frontend
FRONTEND_URL=http://localhost:5173
ALLOWED_ORIGINS=additional,origins,comma,separated

# Optional Cache
REDIS_URL=redis://localhost:6379

# Optional Config
NODE_ENV=development
PORT=3001
```

## Key Implementation Details

### Authentication Flow
- Google OAuth integration with credential validation
- JWT tokens for stateless authentication
- Session verification with automatic refresh
- Protected routes with auth middleware

### User Preference System
- Preferences stored as MongoDB Maps indexed by genre names
- Liked/disliked movies organized by genre for intelligent recommendations
- Genre ID to name conversion for consistent storage
- Automatic preference updates based on user feedback

### Recommendation Engine
- OpenAI GPT integration with user context
- Alternative recommendation system to avoid duplicates
- Daily recommendation limits (5 per user per day)
- Feedback loop for improving recommendations

### Caching Strategy
- Redis caching for TMDB API responses
- User profile and preference caching
- Popular movies cached by genre
- Cache invalidation on user preference updates

### Error Handling & Monitoring
- Comprehensive error middleware with logging
- Rate limiting to prevent API abuse
- Health check endpoints with service status
- CORS configuration for development and production origins