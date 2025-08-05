const redisManager = require('../config/redis');
const axios = require('axios');

class TMDBCacheService {
  constructor() {
    this.baseURL = 'https://api.themoviedb.org/3';
    this.apiKey = process.env.TMDB_API_KEY;
    this.maxRetries = 3;
    this.retryDelay = 1000;
  }

  // Create axios instance with retry logic
  createHttpClient() {
    const client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      params: {
        api_key: this.apiKey
      }
    });

    // Add request interceptor for logging
    client.interceptors.request.use(
      (config) => {
        console.log(`TMDB API Request: ${config.url}`);
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor for retry logic
    client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const config = error.config;
        
        if (!config || !config.retry) {
          config.retry = 0;
        }

        if (config.retry < this.maxRetries && error.response?.status >= 500) {
          config.retry++;
          const delay = this.retryDelay * Math.pow(2, config.retry - 1);
          
          console.log(`TMDB API retry ${config.retry}/${this.maxRetries} after ${delay}ms`);
          
          await new Promise(resolve => setTimeout(resolve, delay));
          return client(config);
        }

        return Promise.reject(error);
      }
    );

    return client;
  }

  // Cached movie search
  async searchMovies(query, page = 1) {
    const cacheKey = redisManager.constructor.keys.tmdbSearch(query, page);
    
    try {
      // Try cache first
      const cached = await redisManager.get(cacheKey);
      if (cached) {
        console.log(`TMDB Search Cache HIT: ${query} (page ${page})`);
        return cached;
      }

      console.log(`TMDB Search Cache MISS: ${query} (page ${page})`);

      // Make API request
      const client = this.createHttpClient();
      const response = await client.get('/search/movie', {
        params: { query, page }
      });

      const data = response.data;
      
      // Cache successful response
      await redisManager.set(cacheKey, data, redisManager.constructor.TTL.TMDB_SEARCH);
      
      return data;
    } catch (error) {
      console.error(`TMDB search error for "${query}":`, error.message);
      throw error;
    }
  }

  // Cached movie details
  async getMovieDetails(tmdbId) {
    const cacheKey = redisManager.constructor.keys.tmdbMovieCache(tmdbId);
    
    try {
      // Try cache first
      const cached = await redisManager.get(cacheKey);
      if (cached) {
        console.log(`TMDB Movie Cache HIT: ${tmdbId}`);
        return cached;
      }

      console.log(`TMDB Movie Cache MISS: ${tmdbId}`);

      // Make API request
      const client = this.createHttpClient();
      const response = await client.get(`/movie/${tmdbId}`, {
        params: {
          append_to_response: 'credits,videos,keywords'
        }
      });

      const data = response.data;
      
      // Cache successful response
      await redisManager.set(cacheKey, data, redisManager.constructor.TTL.TMDB_MOVIE);
      
      return data;
    } catch (error) {
      console.error(`TMDB movie details error for ID ${tmdbId}:`, error.message);
      throw error;
    }
  }

  // Cached popular movies by genre
  async getPopularMovies(genres, page = 1) {
    const cacheKey = redisManager.constructor.keys.tmdbPopular(`${genres}:${page}`);
    
    try {
      // Try cache first
      const cached = await redisManager.get(cacheKey);
      if (cached) {
        console.log(`TMDB Popular Cache HIT: ${genres} (page ${page})`);
        return cached;
      }

      console.log(`TMDB Popular Cache MISS: ${genres} (page ${page})`);

      // Make API request
      const client = this.createHttpClient();
      const params = {
        page,
        sort_by: 'popularity.desc',
        'vote_count.gte': 100,
        'vote_average.gte': 6.0
      };

      if (genres && genres !== 'all') {
        params.with_genres = genres;
      }

      const response = await client.get('/discover/movie', { params });
      const data = response.data;
      
      // Cache successful response
      await redisManager.set(cacheKey, data, redisManager.constructor.TTL.TMDB_POPULAR);
      
      return data;
    } catch (error) {
      console.error(`TMDB popular movies error for genres "${genres}":`, error.message);
      throw error;
    }
  }

  // Cached trending movies
  async getTrendingMovies(timeWindow = 'week') {
    const cacheKey = `tmdb:trending:${timeWindow}`;
    
    try {
      // Try cache first
      const cached = await redisManager.get(cacheKey);
      if (cached) {
        console.log(`TMDB Trending Cache HIT: ${timeWindow}`);
        return cached;
      }

      console.log(`TMDB Trending Cache MISS: ${timeWindow}`);

      // Make API request
      const client = this.createHttpClient();
      const response = await client.get(`/trending/movie/${timeWindow}`);
      const data = response.data;
      
      // Cache for shorter time as trending changes frequently
      await redisManager.set(cacheKey, data, 2 * 60 * 60); // 2 hours
      
      return data;
    } catch (error) {
      console.error(`TMDB trending movies error:`, error.message);
      throw error;
    }
  }

  // Batch movie details with caching
  async getBatchMovieDetails(tmdbIds) {
    const results = [];
    const uncachedIds = [];
    
    // Check cache for each movie
    for (const id of tmdbIds) {
      const cacheKey = redisManager.constructor.keys.tmdbMovieCache(id);
      const cached = await redisManager.get(cacheKey);
      
      if (cached) {
        results.push({ id, data: cached, fromCache: true });
      } else {
        uncachedIds.push(id);
      }
    }

    // Fetch uncached movies with rate limiting
    const batchSize = 5; // TMDB rate limit consideration
    
    for (let i = 0; i < uncachedIds.length; i += batchSize) {
      const batch = uncachedIds.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (id) => {
        try {
          const data = await this.getMovieDetails(id);
          return { id, data, fromCache: false };
        } catch (error) {
          console.error(`Batch fetch error for movie ${id}:`, error.message);
          return { id, error: error.message };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Add delay between batches to respect rate limits
      if (i + batchSize < uncachedIds.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    return results;
  }

  // Cache preloading for popular content
  async preloadPopularContent() {
    try {
      console.log('Starting TMDB cache preloading...');
      
      const genres = [
        '28',   // Action
        '35',   // Comedy  
        '18',   // Drama
        '53',   // Thriller
        '27',   // Horror
        '10749', // Romance
        '878'   // Science Fiction
      ];

      // Preload popular movies for each genre
      const preloadPromises = genres.map(genre => 
        this.getPopularMovies(genre, 1).catch(err => 
          console.error(`Preload error for genre ${genre}:`, err.message)
        )
      );

      // Preload trending movies
      preloadPromises.push(
        this.getTrendingMovies('week').catch(err =>
          console.error('Preload trending error:', err.message)
        )
      );

      await Promise.all(preloadPromises);
      console.log('TMDB cache preloading completed');
    } catch (error) {
      console.error('TMDB cache preloading failed:', error);
    }
  }

  // Cache invalidation
  async invalidateMovieCache(tmdbId) {
    const cacheKey = redisManager.constructor.keys.tmdbMovieCache(tmdbId);
    await redisManager.del(cacheKey);
  }

  async invalidateSearchCache(query) {
    const pattern = `tmdb:search:*${Buffer.from(query).toString('base64')}*`;
    await redisManager.invalidatePattern(pattern);
  }

  // Cache statistics
  async getCacheStats() {
    try {
      const stats = {
        totalKeys: 0,
        movieDetailsKeys: 0,
        searchKeys: 0,
        popularKeys: 0,
        trendingKeys: 0
      };

      if (redisManager.isConnected) {
        const allKeys = await redisManager.client.keys('tmdb:*');
        stats.totalKeys = allKeys.length;

        stats.movieDetailsKeys = allKeys.filter(key => key.startsWith('tmdb:movie:')).length;
        stats.searchKeys = allKeys.filter(key => key.startsWith('tmdb:search:')).length;
        stats.popularKeys = allKeys.filter(key => key.startsWith('tmdb:popular:')).length;
        stats.trendingKeys = allKeys.filter(key => key.startsWith('tmdb:trending:')).length;
      }

      return stats;
    } catch (error) {
      console.error('Error getting TMDB cache stats:', error);
      return { error: error.message };
    }
  }
}

// Create singleton instance
const tmdbCacheService = new TMDBCacheService();

module.exports = tmdbCacheService;