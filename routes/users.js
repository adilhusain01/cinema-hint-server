const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

// Get user profile with preferences
router.get('/profile', authMiddleware, async (req, res) => {
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

// Get recommendation history
router.get('/history', authMiddleware, async (req, res) => {
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

// Get user preferences
router.get('/preferences', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('preferences')
      .lean();
      
    // console.log(user);
    
    res.json(user.preferences || {});
  } catch (error) {
    console.error('Error fetching preferences:', error);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

// Update user preferences
router.put('/preferences', authMiddleware, async (req, res) => {
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

module.exports = router;