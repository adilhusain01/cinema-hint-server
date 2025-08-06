const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { 
  cacheUserProfile, 
  cacheUserPreferences, 
  cacheRecommendationHistory,
  invalidateUserCache 
} = require('../middleware/cache');
const User = require('../models/User');

const router = express.Router();

// Get user profile with preferences (cached)
router.get('/profile', authMiddleware, cacheUserProfile, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-googleId -__v -createdAt -updatedAt')
      .lean();
      
    // Calculate daily limit info
    const dailyLimit = {
      used: user.dailyRecommendations.count,
      limit: 5,
      resetTime: new Date(user.dailyRecommendations.date.getTime() + 24 * 60 * 60 * 1000)
    };
    
    // Remove internal fields and add computed fields
    const { dailyRecommendations, ...userData } = user;
    
    res.json({
      ...userData,
      dailyLimit
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Get recommendation history (cached)
router.get('/history', authMiddleware, cacheRecommendationHistory, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const user = await User.findById(req.user._id)
      .select('recommendationHistory')
      .slice('recommendationHistory', [skip, parseInt(limit)])
      .sort('-recommendationHistory.timestamp')
      .lean();
    
    res.json(user.recommendationHistory || []);
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Get user preferences (cached)
router.get('/preferences', authMiddleware, cacheUserPreferences, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('preferences');
      
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Convert Maps to plain objects for JSON serialization
    const preferences = {
      likedMovies: {},
      dislikedMovies: {}
    };
    
    // Convert likedMovies Map to object
    if (user.preferences.likedMovies instanceof Map) {
      for (const [genre, movies] of user.preferences.likedMovies.entries()) {
        preferences.likedMovies[genre] = movies;
      }
    } else if (user.preferences.likedMovies) {
      preferences.likedMovies = user.preferences.likedMovies;
    }
    
    // Convert dislikedMovies Map to object  
    if (user.preferences.dislikedMovies instanceof Map) {
      for (const [genre, movies] of user.preferences.dislikedMovies.entries()) {
        preferences.dislikedMovies[genre] = movies;
      }
    } else if (user.preferences.dislikedMovies) {
      preferences.dislikedMovies = user.preferences.dislikedMovies;
    }
    
    res.json(preferences);
  } catch (error) {
    console.error('Error fetching preferences:', error);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

// Update user preferences (invalidates cache)
router.put('/preferences', authMiddleware, invalidateUserCache, async (req, res) => {
  try {
    const { 
      genres, 
      likedMovies, 
      dislikedMovies, 
      moods, 
      socialContext, 
      dealBreakers 
    } = req.body;
    
    const update = { $set: {} };
    
    // Handle array updates
    if (genres) {
      update.$addToSet = { 'preferences.genres': { $each: genres } };
    }
    
    if (moods) {
      update.$set['preferences.moods'] = moods;
    }
    
    if (socialContext) {
      update.$set['preferences.socialContext'] = socialContext;
    }
    
    if (dealBreakers) {
      update.$addToSet = {
        ...update.$addToSet,
        'preferences.dealBreakers': { $each: dealBreakers }
      };
    }
    
    if (likedMovies) {
      // For the new genre-based structure, we'll use the model methods instead of direct updates
      const user = await User.findById(req.user._id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Add each liked movie using the model method which handles the genre-based structure
      for (const movie of likedMovies) {
        await user.addLikedMovie({
          tmdbId: movie.tmdbId,
          title: movie.title,
          genres: movie.genres || [],
          rating: movie.rating || 5,
          releaseDate: movie.releaseDate,
          posterPath: movie.posterPath,
          overview: movie.overview
        });
      }
    }
    
    if (dislikedMovies) {
      const user = await User.findById(req.user._id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Add each disliked movie using the model method which handles the genre-based structure
      for (const movie of dislikedMovies) {
        await user.addDislikedMovie({
          tmdbId: movie.tmdbId,
          title: movie.title,
          genres: movie.genres || []
        });
      }
    }
    
    // Update the user
    const user = await User.findByIdAndUpdate(
      req.user._id,
      update,
      { new: true, runValidators: true }
    );
    
    res.json({ 
      success: true, 
      preferences: user.preferences 
    });
    
  } catch (error) {
    console.error('Error updating preferences:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update preferences' 
    });
  }
});



// Clear specific preference
router.delete('/preferences/:field', authMiddleware, async (req, res) => {
  try {
    const { field } = req.params;
    const validFields = ['genres', 'moods', 'socialContext', 'dealBreakers'];
    
    if (!validFields.includes(field)) {
      return res.status(400).json({ error: 'Invalid preference field' });
    }
    
    const update = { $set: { [`preferences.${field}`]: [] } };
    
    await User.findByIdAndUpdate(
      req.user._id,
      update,
      { new: true }
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error(`Error clearing ${field}:`, error);
    res.status(500).json({ error: `Failed to clear ${field}` });
  }
});

// Get user's watchlist
router.get('/watchlist', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('watchlist')
      .lean();
    
    res.json(user.watchlist || []);
  } catch (error) {
    console.error('Error fetching watchlist:', error);
    res.status(500).json({ error: 'Failed to fetch watchlist' });
  }
});

// Add movie to watchlist
router.post('/watchlist', authMiddleware, async (req, res) => {
  try {
    const { tmdbId, title, genres, posterPath, rating, year } = req.body;
    
    if (!tmdbId || !title) {
      return res.status(400).json({ error: 'Movie ID and title are required' });
    }
    
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    await user.addToWatchlist({
      tmdbId,
      title,
      genres: genres || [],
      posterPath,
      rating,
      year
    });
    
    res.json({ success: true, message: 'Movie added to watchlist' });
  } catch (error) {
    console.error('Error adding to watchlist:', error);
    res.status(500).json({ error: 'Failed to add movie to watchlist' });
  }
});

// Remove movie from watchlist
router.delete('/watchlist/:tmdbId', authMiddleware, async (req, res) => {
  try {
    const { tmdbId } = req.params;
    
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    await user.removeFromWatchlist(parseInt(tmdbId));
    
    res.json({ success: true, message: 'Movie removed from watchlist' });
  } catch (error) {
    console.error('Error removing from watchlist:', error);
    res.status(500).json({ error: 'Failed to remove movie from watchlist' });
  }
});

// Check if movie is in watchlist
router.get('/watchlist/check/:tmdbId', authMiddleware, async (req, res) => {
  try {
    const { tmdbId } = req.params;
    
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const isInWatchlist = user.isInWatchlist(parseInt(tmdbId));
    
    res.json({ isInWatchlist });
  } catch (error) {
    console.error('Error checking watchlist:', error);
    res.status(500).json({ error: 'Failed to check watchlist' });
  }
});

// Remove movie from liked movies
router.delete('/preferences/liked/:tmdbId', authMiddleware, async (req, res) => {
  try {
    const { tmdbId } = req.params;
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Remove movie from all genres in liked movies
    for (const [genreName, movies] of user.preferences.likedMovies.entries()) {
      const filteredMovies = movies.filter(m => m.tmdbId !== parseInt(tmdbId));
      if (filteredMovies.length === 0) {
        user.preferences.likedMovies.delete(genreName);
      } else {
        user.preferences.likedMovies.set(genreName, filteredMovies);
      }
    }
    
    await user.save();
    res.json({ success: true, message: 'Movie removed from liked movies' });
  } catch (error) {
    console.error('Error removing from liked movies:', error);
    res.status(500).json({ error: 'Failed to remove movie from liked movies' });
  }
});

// Remove movie from disliked movies
router.delete('/preferences/disliked/:tmdbId', authMiddleware, async (req, res) => {
  try {
    const { tmdbId } = req.params;
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Remove movie from all genres in disliked movies
    for (const [genreName, movies] of user.preferences.dislikedMovies.entries()) {
      const filteredMovies = movies.filter(m => m.tmdbId !== parseInt(tmdbId));
      if (filteredMovies.length === 0) {
        user.preferences.dislikedMovies.delete(genreName);
      } else {
        user.preferences.dislikedMovies.set(genreName, filteredMovies);
      }
    }
    
    await user.save();
    res.json({ success: true, message: 'Movie removed from disliked movies' });
  } catch (error) {
    console.error('Error removing from disliked movies:', error);
    res.status(500).json({ error: 'Failed to remove movie from disliked movies' });
  }
});

module.exports = router;