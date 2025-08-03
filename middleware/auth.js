const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid token.' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token.' });
  }
};

const rateLimitMiddleware = async (req, res, next) => {
  try {
    const user = req.user;
    const now = new Date();
    const resetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    
    if (!user.checkDailyLimit()) {
      const hoursUntilReset = Math.ceil((resetTime - now) / (1000 * 60 * 60));
      return res.status(429).json({ 
        error: `Daily recommendation limit reached. Please try again in ${hoursUntilReset} hours.`,
        limit: 5,
        current: user.dailyRecommendations.count,
        resetTime: resetTime
      });
    }
    
    next();
  } catch (error) {
    res.status(500).json({ error: 'Rate limit check failed.' });
  }
};

module.exports = { authMiddleware, rateLimitMiddleware, client };