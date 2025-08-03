const mongoose = require('mongoose');

// Helper function to create genre map schema
const createGenreMapSchema = () => ({
  type: Map,
  of: [{
    tmdbId: { type: Number, required: true },
    title: { type: String, required: true },
    genres: { type: [String], default: [] },
    _id: false
  }],
  default: {}
});

const userSchema = new mongoose.Schema({
  googleId: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  profilePicture: String,
  preferences: {
    // Store liked movies organized by genre name
    likedMovies: createGenreMapSchema(),
    // Store disliked movies organized by genre name
    dislikedMovies: createGenreMapSchema(),
  },
  dailyRecommendations: {
    count: { type: Number, default: 0 },
    date: { type: Date, default: Date.now }
  },
  recommendationHistory: [{
    movieId: Number,
    title: String,
    accepted: Boolean,
    timestamp: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

// Helper method to check if a movie exists in a genre map
userSchema.methods.hasMovieInMap = function(genreMap, tmdbId) {
  for (const genreId in genreMap) {
    if (genreMap[genreId].some(movie => movie.tmdbId === tmdbId)) {
      return true;
    }
  }
  return false;
};

// Helper method to update array fields by appending new values
userSchema.methods.updateArrayField = function(field, newValues) {
  // If newValues is not an array, make it an array
  const values = Array.isArray(newValues) ? newValues : [newValues];
  
  const validValues = values.filter(v => v && v.trim() !== '');
  
  // Add only unique values
  validValues.forEach(value => {
    if (!this.preferences[field].includes(value)) {
      this.preferences[field].push(value);
    }
  });
  
  return this.save();
};

// Add or update a liked movie
userSchema.methods.addLikedMovie = function(movie) {
  // Convert to Map if it's not already
  if (!(this.preferences.likedMovies instanceof Map)) {
    this.preferences.likedMovies = new Map();
  }
  if (!(this.preferences.dislikedMovies instanceof Map)) {
    this.preferences.dislikedMovies = new Map();
  }

  // Convert genre IDs to names for storage
  const genreNames = (movie.genres || []).map(genreId => {
    // If it's already a name, use it as is
    if (typeof genreId === 'string') return genreId.toLowerCase();
    
    // Otherwise, convert from ID to name
    const genreMap = {
      28: 'action', 12: 'adventure', 16: 'animation', 35: 'comedy', 80: 'crime',
      99: 'documentary', 18: 'drama', 10751: 'family', 14: 'fantasy', 36: 'history',
      27: 'horror', 10402: 'music', 9648: 'mystery', 10749: 'romance', 878: 'scifi',
      10770: 'tvmovie', 53: 'thriller', 10752: 'war', 37: 'western'
    };
    return genreMap[genreId] || null;
  }).filter(Boolean);

  // Remove from disliked if present
  for (const [genreName, movies] of this.preferences.dislikedMovies.entries()) {
    const filteredMovies = movies.filter(m => m.tmdbId !== movie.tmdbId);
    if (filteredMovies.length === 0) {
      this.preferences.dislikedMovies.delete(genreName);
    } else {
      this.preferences.dislikedMovies.set(genreName, filteredMovies);
    }
  }
  
  const movieData = {
    tmdbId: movie.tmdbId,
    title: movie.title,
    genres: genreNames // Store genre names instead of IDs
  };
  
  // Add to each genre
  genreNames.forEach(genreName => {
    
    // Initialize genre array if it doesn't exist
    if (!this.preferences.likedMovies.has(genreName)) {
      this.preferences.likedMovies.set(genreName, []);
    }
    
    // Check if movie already exists in this genre
    const genreMovies = this.preferences.likedMovies.get(genreName);
    const existingIndex = genreMovies.findIndex(m => m.tmdbId === movie.tmdbId);
    
    // Update or add movie
    if (existingIndex >= 0) {
      genreMovies[existingIndex] = movieData;
    } else {
      genreMovies.push(movieData);
    }
    this.preferences.likedMovies.set(genreName, genreMovies);
  });
  
  return this.save();
};

// Add a disliked movie
userSchema.methods.addDislikedMovie = function(movie) {
  // Convert to Map if it's not already
  if (!(this.preferences.dislikedMovies instanceof Map)) {
    this.preferences.dislikedMovies = new Map();
  }
  if (!(this.preferences.likedMovies instanceof Map)) {
    this.preferences.likedMovies = new Map();
  }

  // Convert genre IDs to names for storage
  const genreNames = (movie.genres || []).map(genreId => {
    // If it's already a name, use it as is
    if (typeof genreId === 'string') return genreId.toLowerCase();
    
    // Otherwise, convert from ID to name
    const genreMap = {
      28: 'action', 12: 'adventure', 16: 'animation', 35: 'comedy', 80: 'crime',
      99: 'documentary', 18: 'drama', 10751: 'family', 14: 'fantasy', 36: 'history',
      27: 'horror', 10402: 'music', 9648: 'mystery', 10749: 'romance', 878: 'scifi',
      10770: 'tvmovie', 53: 'thriller', 10752: 'war', 37: 'western'
    };
    return genreMap[genreId] || null;
  }).filter(Boolean);

  // Remove from liked if present
  for (const [genreName, movies] of this.preferences.likedMovies.entries()) {
    const filteredMovies = movies.filter(m => m.tmdbId !== movie.tmdbId);
    if (filteredMovies.length === 0) {
      this.preferences.likedMovies.delete(genreName);
    } else {
      this.preferences.likedMovies.set(genreName, filteredMovies);
    }
  }
  
  const movieData = {
    tmdbId: movie.tmdbId,
    title: movie.title,
    genres: genreNames // Store genre names instead of IDs
  };
  
  // Add to each genre
  genreNames.forEach(genreName => {

    // Initialize genre array if it doesn't exist
    if (!this.preferences.dislikedMovies.has(genreName)) {
      this.preferences.dislikedMovies.set(genreName, []);
    }
    
    // Check if movie already exists in this genre
    const genreMovies = this.preferences.dislikedMovies.get(genreName);
    const existingIndex = genreMovies.findIndex(
      m => m.tmdbId === movie.tmdbId
    );
    
    // Update or add movie
    if (existingIndex >= 0) {
      genreMovies[existingIndex] = movieData;
    } else {
      genreMovies.push(movieData);
    }
    this.preferences.dislikedMovies.set(genreName, genreMovies);
  });
  
  return this.save();
};

// Add to recommendation history with deduplication
// Returns true if a new recommendation was added, false if it was a duplicate
userSchema.methods.addRecommendation = function(recommendation) {
  // Check if this movie was already recommended
  const isDuplicate = this.recommendationHistory.some(
    r => r.movieId === recommendation.movieId
  );
  
  if (isDuplicate) {
    return false;
  }
  
  // Add the new recommendation
  this.recommendationHistory.push({
    movieId: recommendation.movieId,
    title: recommendation.title,
    accepted: recommendation.accepted,
  });
  
  // Keep only the 100 most recent recommendations
  this.recommendationHistory.sort((a, b) => b.timestamp - a.timestamp);
  if (this.recommendationHistory.length > 100) {
    this.recommendationHistory = this.recommendationHistory.slice(0, 100);
  }
  
  return true;
};

// Reset daily recommendation count
userSchema.methods.checkDailyLimit = function() {
  const today = new Date();
  const userDate = new Date(this.dailyRecommendations.date);
  
  if (today.toDateString() !== userDate.toDateString()) {
    this.dailyRecommendations.count = 0;
    this.dailyRecommendations.date = today;
  }
  
  return this.dailyRecommendations.count < 5; // 5 recommendations per day
};

module.exports = mongoose.model('User', userSchema);