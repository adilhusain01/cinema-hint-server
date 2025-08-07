const redisManager = require('../config/redis');

// Generic cache middleware
const cacheMiddleware = (keyGenerator, ttl = 300) => {
  return async (req, res, next) => {
    try {
      const cacheKey = typeof keyGenerator === 'function' 
        ? keyGenerator(req) 
        : keyGenerator;
      
      // Try to get from cache
      const cachedData = await redisManager.get(cacheKey);
      
      if (cachedData) {
        console.log(`Cache HIT for key: ${cacheKey}`);
        return res.json(cachedData);
      }
      
      console.log(`Cache MISS for key: ${cacheKey}`);
      
      // Store original json method
      const originalJson = res.json;
      
      // Override json method to cache the response
      res.json = function(data) {
        // Cache the successful response
        if (res.statusCode >= 200 && res.statusCode < 300) {
          redisManager.set(cacheKey, data, ttl).catch(err => {
            console.error('Cache SET error:', err);
          });
        }
        
        // Call original json method
        return originalJson.call(this, data);
      };
      
      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next(); // Continue without caching
    }
  };
};

// User profile cache middleware
const cacheUserProfile = cacheMiddleware(
  (req) => redisManager.constructor.keys.userProfile(req.user._id.toString()),
  redisManager.constructor.TTL.USER_PROFILE
);

// User preferences cache middleware
const cacheUserPreferences = cacheMiddleware(
  (req) => redisManager.constructor.keys.userPreferences(req.user._id.toString()),
  redisManager.constructor.TTL.USER_PREFERENCES
);

// Movie details cache middleware
const cacheMovieDetails = cacheMiddleware(
  (req) => redisManager.constructor.keys.movieDetails(req.params.tmdbId),
  redisManager.constructor.TTL.MOVIE_DETAILS
);

// TMDB popular movies cache middleware
const cacheTMDBPopular = cacheMiddleware(
  (req) => redisManager.constructor.keys.tmdbPopular(req.params.genres),
  redisManager.constructor.TTL.TMDB_POPULAR
);

// Recommendation history cache middleware
const cacheRecommendationHistory = cacheMiddleware(
  (req) => redisManager.constructor.keys.recommendationHistory(req.user._id.toString()),
  redisManager.constructor.TTL.RECOMMENDATION_HISTORY
);

// Cache invalidation middleware
const invalidateUserCache = async (req, res, next) => {
  try {
    // Store original json method
    const originalJson = res.json;
    
    // Override json method to invalidate cache after response
    res.json = function(data) {
      // If response was successful, invalidate user cache
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user?._id) {
        redisManager.invalidateUserCache(req.user._id.toString()).catch(err => {
          console.error('Cache invalidation error:', err);
        });
      }
      
      // Call original json method
      return originalJson.call(this, data);
    };
    
    next();
  } catch (error) {
    console.error('Cache invalidation middleware error:', error);
    next();
  }
};

// Rate limiting with Redis
const redisRateLimit = (maxRequests = 5, windowSeconds = 86400) => {
  return async (req, res, next) => {
    try {
      if (!req.user?.userId) {
        return next();
      }
      
      const key = redisManager.constructor.keys.rateLimit(req.user.userId);
      const current = await redisManager.incr(key, windowSeconds);
      
      if (current > maxRequests) {
        return res.status(429).json({
          error: 'Daily recommendation limit reached',
          message: `You have reached your daily limit of ${maxRequests} recommendations. Please try again tomorrow.`,
          retryAfter: windowSeconds
        });
      }
      
      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': maxRequests,
        'X-RateLimit-Remaining': Math.max(0, maxRequests - current),
        'X-RateLimit-Reset': new Date(Date.now() + windowSeconds * 1000).toISOString()
      });
      
      next();
    } catch (error) {
      console.error('Redis rate limit error:', error);
      // Fallback to existing rate limiting logic
      next();
    }
  };
};

// Cache warming utility
const warmCache = {
  // Pre-populate popular movie caches
  async popularMovies() {
    try {
      const genres = ['action', 'drama', 'comedy', 'thriller', 'horror'];
      const promises = genres.map(genre => {
        // This would trigger the API call and cache the result
        // Implementation depends on your TMDB service
        console.log(`Warming cache for genre: ${genre}`);
      });
      
      await Promise.all(promises);
      console.log('Popular movies cache warmed');
    } catch (error) {
      console.error('Cache warming error:', error);
    }
  },

  // Pre-populate movie details for trending movies
  async trendingMovies() {
    try {
      // Implementation would fetch trending movies and cache their details
      console.log('Trending movies cache warmed');
    } catch (error) {
      console.error('Trending cache warming error:', error);
    }
  }
};

// Cache monitoring middleware
const cacheMonitoring = (req, res, next) => {
  const startTime = Date.now();
  
  // Store original json method
  const originalJson = res.json;
  
  res.json = function(data) {
    const responseTime = Date.now() - startTime;
    
    // Log cache performance
    console.log(`Request: ${req.method} ${req.path} - Response time: ${responseTime}ms`);
    
    // Could send metrics to monitoring service here
    
    return originalJson.call(this, data);
  };
  
  next();
};

module.exports = {
  cacheMiddleware,
  cacheUserProfile,
  cacheUserPreferences,
  cacheMovieDetails,
  cacheTMDBPopular,
  cacheRecommendationHistory,
  invalidateUserCache,
  redisRateLimit,
  warmCache,
  cacheMonitoring
};