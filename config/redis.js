const redis = require('redis');

class RedisManager {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      this.client = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        retry_strategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          console.log(`Redis connection attempt ${times}, retrying in ${delay}ms`);
          return delay;
        }
      });

      this.client.on('error', (err) => {
        console.error('Redis Client Error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('Redis Client Connected');
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        console.log('Redis Client Ready');
        this.isConnected = true;
      });

      this.client.on('end', () => {
        console.log('Redis Client Disconnected');
        this.isConnected = false;
      });

      await this.client.connect();
      console.log('Redis connection established successfully');
      
      return this.client;
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      this.isConnected = false;
      
      // In development, continue without Redis
      if (process.env.NODE_ENV === 'development') {
        console.warn('Continuing without Redis in development mode');
        return null;
      }
      
      throw error;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
    }
  }

  // Cache key generators
  static keys = {
    userProfile: (userId) => `user:profile:${userId}`,
    userPreferences: (userId) => `user:preferences:${userId}`,
    movieDetails: (tmdbId) => `movie:details:${tmdbId}`,
    tmdbSearch: (query, page = 1) => `tmdb:search:${Buffer.from(`${query}:${page}`).toString('base64')}`,
    tmdbPopular: (genres) => `tmdb:popular:${genres || 'all'}`,
    userSession: (userId) => `session:${userId}`,
    rateLimit: (userId) => `ratelimit:${userId}`,
    recommendationHistory: (userId) => `history:${userId}`,
    tmdbMovieCache: (tmdbId) => `tmdb:movie:${tmdbId}`
  };

  // Cache TTL values (in seconds)
  static TTL = {
    USER_PROFILE: 10 * 60,        // 10 minutes
    USER_PREFERENCES: 15 * 60,    // 15 minutes
    MOVIE_DETAILS: 24 * 60 * 60,  // 24 hours
    TMDB_SEARCH: 6 * 60 * 60,     // 6 hours
    TMDB_POPULAR: 12 * 60 * 60,   // 12 hours
    SESSION: 7 * 24 * 60 * 60,    // 7 days
    RATE_LIMIT: 24 * 60 * 60,     // 24 hours
    RECOMMENDATION_HISTORY: 30 * 60, // 30 minutes
    TMDB_MOVIE: 24 * 60 * 60      // 24 hours
  };

  // Generic cache methods
  async get(key) {
    if (!this.isConnected || !this.client) {
      return null;
    }
    
    try {
      const result = await this.client.get(key);
      return result ? JSON.parse(result) : null;
    } catch (error) {
      console.error(`Redis GET error for key ${key}:`, error);
      return null;
    }
  }

  async set(key, value, ttl = null) {
    if (!this.isConnected || !this.client) {
      return false;
    }
    
    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await this.client.setEx(key, ttl, serialized);
      } else {
        await this.client.set(key, serialized);
      }
      return true;
    } catch (error) {
      console.error(`Redis SET error for key ${key}:`, error);
      return false;
    }
  }

  async del(key) {
    if (!this.isConnected || !this.client) {
      return false;
    }
    
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error(`Redis DEL error for key ${key}:`, error);
      return false;
    }
  }

  async exists(key) {
    if (!this.isConnected || !this.client) {
      return false;
    }
    
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`Redis EXISTS error for key ${key}:`, error);
      return false;
    }
  }

  // Increment with expiration (for rate limiting)
  async incr(key, ttl = null) {
    if (!this.isConnected || !this.client) {
      return 0;
    }
    
    try {
      const multi = this.client.multi();
      multi.incr(key);
      if (ttl) {
        multi.expire(key, ttl);
      }
      const results = await multi.exec();
      return results[0];
    } catch (error) {
      console.error(`Redis INCR error for key ${key}:`, error);
      return 0;
    }
  }

  // Cache invalidation patterns
  async invalidateUserCache(userId) {
    const keysToDelete = [
      RedisManager.keys.userProfile(userId),
      RedisManager.keys.userPreferences(userId),
      RedisManager.keys.recommendationHistory(userId)
    ];
    
    for (const key of keysToDelete) {
      await this.del(key);
    }
  }

  async invalidatePattern(pattern) {
    if (!this.isConnected || !this.client) {
      return false;
    }
    
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
      return true;
    } catch (error) {
      console.error(`Redis pattern invalidation error for ${pattern}:`, error);
      return false;
    }
  }

  // Health check
  async healthCheck() {
    if (!this.isConnected || !this.client) {
      return { status: 'disconnected', message: 'Redis client not connected' };
    }
    
    try {
      await this.client.ping();
      return { status: 'healthy', message: 'Redis connection is healthy' };
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }

  // Statistics
  async getStats() {
    if (!this.isConnected || !this.client) {
      return { connected: false };
    }
    
    try {
      const info = await this.client.info();
      return {
        connected: true,
        info: info,
        keyCount: await this.client.dbSize()
      };
    } catch (error) {
      return { connected: false, error: error.message };
    }
  }
}

// Create singleton instance
const redisManager = new RedisManager();

module.exports = redisManager;