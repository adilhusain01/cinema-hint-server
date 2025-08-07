const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

// Import Redis and cache services
const redisManager = require('./config/redis');
const tmdbCacheService = require('./services/tmdbCache');
const { cacheMonitoring } = require('./middleware/cache');

const authRoutes = require('./routes/auth');
const movieRoutes = require('./routes/movies');
const userRoutes = require('./routes/users');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

// Security middleware
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false
  })
);
app.use(compression());
app.use(morgan('combined'));

// CORS configuration
const allowedOrigins = [
  // Development origins
  'http://localhost:5173',
  'http://localhost:5174', 
  'http://localhost:5175',
  'http://localhost:3000',
  'http://localhost:3001',
  // Production origins
  process.env.FRONTEND_URL || 'https://cinemahint.com'
];

// Add additional allowed origins from environment
if (process.env.ALLOWED_ORIGINS) {
  const additionalOrigins = process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim());
  allowedOrigins.push(...additionalOrigins);
}

console.log('🌐 CORS allowed origins:', allowedOrigins);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Cache monitoring middleware (optional)
if (process.env.NODE_ENV === 'development') {
  app.use(cacheMonitoring);
}

// Initialize Redis connection
const initializeRedis = async () => {
  try {
    await redisManager.connect();
    console.log('Redis connection initialized');
    
    // Preload cache in production
    if (process.env.NODE_ENV === 'production') {
      setTimeout(() => {
        tmdbCacheService.preloadPopularContent().catch(err => 
          console.error('Cache preloading failed:', err)
        );
      }, 5000); // Wait 5 seconds after startup
    }
  } catch (error) {
    console.error('Redis initialization failed:', error);
    if (process.env.NODE_ENV === 'production') {
      console.error('Redis is required in production mode');
      process.exit(1);
    }
  }
};

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('Connected to MongoDB');
  // Initialize Redis after MongoDB connection
  initializeRedis();
})
.catch((err) => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/movies', movieRoutes);
app.use('/api/users', userRoutes);

// Health check with Redis status
app.get('/api/health', async (req, res) => {
  try {
    const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    const redisHealth = await redisManager.healthCheck();
    
    const health = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      services: {
        mongodb: mongoStatus,
        redis: redisHealth,
        environment: process.env.NODE_ENV || 'development'
      }
    };

    // Add cache statistics in development
    if (process.env.NODE_ENV === 'development') {
      health.cache = await tmdbCacheService.getCacheStats();
    }

    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Error handling middleware
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;