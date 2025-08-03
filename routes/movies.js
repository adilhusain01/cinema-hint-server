const express = require('express');
const OpenAI = require('openai');
const { authMiddleware, rateLimitMiddleware } = require('../middleware/auth');
const User = require('../models/User');
const Movie = require('../models/Movie');
const axiosInstance = require('../utils/axios');


const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// TMDB API configuration
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_API_KEY = process.env.TMDB_API_KEY;

// Configure axios instance for TMDB requests
const tmdbRequest = async (url) => {
  try {
    const response = await axiosInstance.get(url, {
      retry: 3,
      retryDelay: 1000,
      timeout: 10000,
    });
    return response.data;
  } catch (error) {
    console.error('TMDB API Error:', error.message);
    throw new Error('Failed to fetch movies. Please try again later.');
  }
};

// Get curated movies for preference calibration
router.get('/popular/:genres?', authMiddleware, async (req, res) => {
  try {
    const { genres } = req.params;
    const user = req.user;
    
    // Get user's already rated movies from the new genre-based structure
    const ratedMovieIds = new Set();
    
    // Get all liked movies
    for (const movies of user.preferences.likedMovies.values()) {
      movies.forEach(movie => ratedMovieIds.add(movie.tmdbId));
    }
    
    // Get all disliked movies
    for (const movies of user.preferences.dislikedMovies.values()) {
      movies.forEach(movie => ratedMovieIds.add(movie.tmdbId));
    }

    const genreMap = {
      action: 28,
      adventure: 12,
      animation: 16,
      comedy: 35,
      crime: 80,
      documentary: 99,
      drama: 18,
      family: 10751,
      fantasy: 14,
      history: 36,
      horror: 27,
      music: 10402,
      mystery: 9648,
      romance: 10749,
      scifi: 878,
      tvmovie: 10770,
      thriller: 53,
      war: 10752,
      western: 37
    };

    // Base criteria for quality movies
    let baseParams = {
      'vote_count.gte': 1000, // Minimum number of votes to ensure reliability
      'vote_average.gte': 6.5, // Minimum rating threshold
      'with_original_language': 'en', // English language movies
      'sort_by': 'vote_average.desc', // Sort by rating
      'page': 1 // Start with first page
    };

    // Handle multiple genres
    if (genres && genres.trim().toLowerCase() !== 'all') {
      try {
        const genreKeys = genres.split(',').map(g => g.trim().toLowerCase());
        const genreIds = genreKeys
          .map(key => genreMap[key])
          .filter(Boolean); // Remove undefined values

        if (genreIds.length > 0) {
          baseParams.with_genres = genreIds.join('|'); // TMDB uses | for OR between genres
        } else {
          console.warn(`No valid genre keys found in: "${genres}"`);
          // Continue with no genre filter if no valid genres found
        }
      } catch (error) {
        console.error('Error processing genres:', error);
        // Continue with no genre filter if there's an error
      }
    }

    let topRatedData, recentData;
    
    try {
      // Try to get a mix of classic and recent quality movies
      [topRatedData, recentData] = await Promise.all([

        // Get top-rated movies of all time for this genre
        tmdbRequest(`${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&` + 
          new URLSearchParams({
            ...baseParams,
            'primary_release_date.lte': '2020-12-31'
          })),
        
        // Get recent well-rated movies
        tmdbRequest(`${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&` + 
          new URLSearchParams({
            ...baseParams,
            'primary_release_date.gte': '2021-01-01',
            'sort_by': 'popularity.desc' // For recent movies, prioritize popularity
          }))
      ]);

      // console.log(topRatedData);
      // console.log(recentData);
      

      // Convert Set to Array for includes()
      const ratedMovieIdsArray = Array.from(ratedMovieIds);
      
      // Combine and filter results
      let allMovies = [...topRatedData.results, ...recentData.results]
        .filter(movie => 
          movie.poster_path && // Must have a poster
          movie.overview && // Must have a description
          !ratedMovieIdsArray.includes(movie.id) // Haven't been rated by user
        )
        .sort((a, b) => {
          // Custom sorting: balance between rating, popularity, and vote count
          const scoreA = (a.vote_average * Math.log10(a.vote_count)) * (a.popularity / 100);
          const scoreB = (b.vote_average * Math.log10(b.vote_count)) * (b.popularity / 100);
          return scoreB - scoreA;
        })
        .slice(0, 8) // Take top 8 after sorting
        .map(movie => ({
          tmdbId: movie.id,
          title: movie.title,
          year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
          rating: movie.vote_average,
          genres: movie.genre_ids,
          posterPath: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
        }));

      // If we don't have enough movies, try with relaxed criteria
      if (allMovies.length < 8) {
        const relaxedParams = {
          ...baseParams,
          'vote_count.gte': 500,
          'vote_average.gte': 6.0,
          'with_original_language': null
        };

        const relaxedData = await tmdbRequest(`${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&` + 
          new URLSearchParams(relaxedParams));
        
        const relaxedMovies = relaxedData.results
          .filter(movie => 
            movie.poster_path &&
            movie.overview &&
            !ratedMovieIdsArray.includes(movie.id) &&
            !allMovies.find(m => m.tmdbId === movie.id)
          )
          .map(movie => ({
            tmdbId: movie.id,
            title: movie.title,
            year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
            rating: movie.vote_average,
            genres: movie.genre_ids,
            posterPath: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
          }));

        allMovies = [...allMovies, ...relaxedMovies].slice(0, 8);
      }

      // console.log(allMovies);
      

      res.json(allMovies);
    } catch (error) {
      console.error('Error fetching popular movies:', error);
      res.status(500).json({ error: 'Failed to fetch movies' });
    }
  } catch (error) {
    console.error('Error in popular movies route:', error);
    res.status(500).json({ error: 'Failed to fetch movies' });
  }
});

// Save user preferences (legacy, prefer using PUT /users/preferences)
router.post('/preferences', authMiddleware, async (req, res) => {
  try {
    const { likedMovies, dislikedMovies } = req.body;
    const update = { $set: {} };
    
    // Handle liked/disliked movies
    if (likedMovies) {
      update.$set['preferences.likedMovies'] = likedMovies;
    }
    
    if (dislikedMovies) {
      update.$set['preferences.dislikedMovies'] = dislikedMovies;
    }
    
    // Update the user
    const user = await User.findByIdAndUpdate(
      req.user._id,
      update,
      { new: true, runValidators: true }
    );
    
    res.json({ 
      success: true
    });
    
  } catch (error) {
    console.error('Error saving preferences:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to save preferences' 
    });
  }
});

router.post('/recommend', authMiddleware, rateLimitMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const { genres, moods, socialContext, dealBreakers } = req.body;

    // Access the Map data directly instead of using toObject()
    const likedMovies = user.preferences.likedMovies || new Map();
    const dislikedMovies = user.preferences.dislikedMovies || new Map();

    // Convert Maps to plain objects if they are Maps
    const likedMoviesObj = likedMovies instanceof Map ? Object.fromEntries(likedMovies) : likedMovies;
    const dislikedMoviesObj = dislikedMovies instanceof Map ? Object.fromEntries(dislikedMovies) : dislikedMovies;

    // Filter liked and disliked movies based on selected genres
    let filteredLikedMovies = {};
    let filteredDislikedMovies = {};

    if (genres && genres.length > 0) {
      // If specific genres are selected, only get movies from those genres
      genres.forEach(selectedGenre => {
        const genreKey = selectedGenre.toLowerCase();
        
        // Get liked movies for this genre
        if (likedMoviesObj[genreKey] && Array.isArray(likedMoviesObj[genreKey])) {
          filteredLikedMovies[genreKey] = likedMoviesObj[genreKey];
        }
        
        // Get disliked movies for this genre
        if (dislikedMoviesObj[genreKey] && Array.isArray(dislikedMoviesObj[genreKey])) {
          filteredDislikedMovies[genreKey] = dislikedMoviesObj[genreKey];
        }
      });
    } else {
      // If no specific genres selected, use all movies
      filteredLikedMovies = likedMoviesObj;
      filteredDislikedMovies = dislikedMoviesObj;
    }

    // Create a clean preferences object with filtered data
    const preferences = {
      genres,
      likedMovies: filteredLikedMovies,
      dislikedMovies: filteredDislikedMovies,
      moods,
      socialContext,
      dealBreakers,
      previouslyRecommended: user.recommendationHistory.map(rec => rec.title).join(', ') || ''
    };
    
    console.log('Session preferences with filtered movies:', preferences);

    // Build recommendation prompt with the filtered preferences
    const prompt = buildRecommendationPrompt(preferences);
    
    let attempts = 0;
    const maxAttempts = 3; // Maximum attempts to get a new recommendation
    
    while (attempts < maxAttempts) {
      // Get AI recommendation
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are an expert movie recommender. Provide exactly one movie recommendation with detailed reasoning. Return response in valid JSON format only (no markdown code blocks) with fields: title, year, reason, genre, rating."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.7 + (attempts * 0.1) // Increase randomness with each attempt
      });

      let aiResponse;
      try {
        // Clean the response content to handle potential markdown formatting
        let responseContent = completion.choices[0].message.content.trim();
        
        // Remove markdown code blocks if present
        if (responseContent.startsWith('```json')) {
          responseContent = responseContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (responseContent.startsWith('```')) {
          responseContent = responseContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        aiResponse = JSON.parse(responseContent);
      } catch (parseError) {
        console.error('JSON parsing error:', parseError);
        console.error('Raw response:', completion.choices[0].message.content);
        attempts++;
        continue; // Try again with increased temperature
      }
      
      // Validate required fields
      if (!aiResponse.title || !aiResponse.reason) {
        console.error('Invalid AI response structure:', aiResponse);
        attempts++;
        continue;
      }
      
      // Get movie details from TMDB
      const movieDetails = await searchMovieOnTMDB(aiResponse.title, aiResponse.year);
      
      if (!movieDetails) {
        attempts++;
        continue;
      }

      // Check if this movie was already recommended
      const alreadyRecommended = user.recommendationHistory.some(
        rec => rec.movieId === movieDetails.tmdbId
      );

      if (!alreadyRecommended) {
        // Create recommendation
        const recommendation = {
          movieId: movieDetails.tmdbId,
          title: movieDetails.title,
          accepted: null,
        };

        // Add to history only if it's a new recommendation
        const isNewRecommendation = user.addRecommendation(recommendation);
        
        if (isNewRecommendation) {
          // Increment daily recommendation count only when we find a new recommendation
          user.dailyRecommendations.count += 1;
          
          // Save the user document with the new recommendation
          await user.save();

          const finalRecommendation = {
            ...movieDetails,
            reason: aiResponse.reason,
          };

          return res.json(finalRecommendation);
        }
      }
      
      attempts++;
    }

    // If we couldn't find a new recommendation after max attempts
    return res.status(404).json({ 
      error: 'Could not find a new movie recommendation. Try adjusting your preferences or try again later.'
    });

  } catch (error) {
    console.error('Error generating recommendation:', error);
    res.status(500).json({ error: 'Failed to generate recommendation' });
  }
});


router.post('/feedback', authMiddleware, async (req, res) => {
  try {
    const { movieId, title, accepted, genres = [], rating } = req.body;
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prepare movie data with genres if available
    const movieData = { 
      tmdbId: movieId, 
      title,
      genres: Array.isArray(genres) ? genres : [genres], // Ensure genres is an array
      rating: rating || (accepted ? 5 : 1)
    };

    // Update liked/disliked movies
    if (accepted) {
      await user.addLikedMovie(movieData);
    } else {
      await user.addDislikedMovie(movieData);
    }

    // Add to recommendation history
    await user.addRecommendation({
      movieId,
      title,
      reason: 'User feedback',
      accepted,
      timestamp: new Date()
    });

    // Get updated user with preferences (only liked/disliked movies)
    const updatedUser = await User.findById(user._id)
      .select('preferences.likedMovies preferences.dislikedMovies')
      .lean();
    
    res.json({ 
      success: true, 
      preferences: {
        likedMovies: updatedUser.preferences?.likedMovies || {},
        dislikedMovies: updatedUser.preferences?.dislikedMovies || {}
      }
    });
    
  } catch (error) {
    console.error('Error saving feedback:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to save feedback',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.post('/backup', authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const { selectedGenres = [], moods = [], socialContext = '', dealBreakers = [] } = req.body;
    
    // Create a temporary preferences object with the current session data
    const sessionPreferences = {
      ...user.preferences.toObject(),
      // Add session-specific preferences
      selectedGenres,
      moods,
      socialContext,
      dealBreakers
    };
    
    // Get 2-3 backup recommendations
    const backupPrompt = buildBackupRecommendationPrompt(sessionPreferences);
    
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "Provide 2-3 alternative movie recommendations in valid JSON array format only (no markdown code blocks). Each should have: title, year, reason, genre."
        },
        {
          role: "user",
          content: backupPrompt
        }
      ],
      max_tokens: 800,
      temperature: 0.8
    });

    let backupMovies;
    try {
      // Clean the response content to handle potential markdown formatting
      let responseContent = completion.choices[0].message.content.trim();
      
      // Remove markdown code blocks if present
      if (responseContent.startsWith('```json')) {
        responseContent = responseContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (responseContent.startsWith('```')) {
        responseContent = responseContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      backupMovies = JSON.parse(responseContent);
    } catch (parseError) {
      console.error('JSON parsing error in backup recommendations:', parseError);
      console.error('Raw response:', completion.choices[0].message.content);
      return res.status(500).json({ error: 'Failed to parse backup recommendations' });
    }

    // Ensure backupMovies is an array
    if (!Array.isArray(backupMovies)) {
      console.error('Backup movies response is not an array:', backupMovies);
      return res.status(500).json({ error: 'Invalid backup recommendations format' });
    }
    
    // Enrich backup movies with TMDB data
    const enrichedBackups = await Promise.all(
      backupMovies.map(async (movie) => {
        if (!movie?.title) return null;
        try {
          const details = await searchMovieOnTMDB(movie.title, movie.year);
          return details ? { ...details, reason: movie.reason } : null;
        } catch (error) {
          console.error(`Error fetching details for ${movie.title}:`, error);
          return null;
        }
      })
    );

    res.json(enrichedBackups.filter(movie => movie !== null));
  } catch (error) {
    console.error('Error generating backup recommendations:', error);
    res.status(500).json({ error: 'Failed to generate backup recommendations' });
  }
});

// Helper function to analyze genre preferences from liked movies
function analyzeGenrePreferences({ likedMovies = [] }) {
  const genreCounts = {};
  
  // Process each movie and count genres
  likedMovies.forEach(movie => {
    if (movie.genres && Array.isArray(movie.genres)) {
      movie.genres.forEach(genre => {
        // Ensure genre is a string and convert to lowercase for consistency
        const genreName = String(genre).toLowerCase().trim();
        if (genreName) {
          genreCounts[genreName] = (genreCounts[genreName] || 0) + 1;
        }
      });
    }
  });
  
  // Convert to array, sort by count (descending), and filter out any empty genres
  return Object.entries(genreCounts)
    .map(([genreId, count]) => ({ genreId, count }))
    .filter(genre => genre.genreId) // Filter out any empty genre names
    .sort((a, b) => b.count - a.count);
}

function buildRecommendationPrompt(preferences) {
  let prompt = "I need a movie recommendation with the following preferences:\n\n";
  
  // 1. Include selected genres from session if any
  if (preferences.genres?.length > 0) {
    prompt += `Preferred genres: ${preferences.genres.join(', ')}\n`;
  }
  
  // 2. Include information from liked movies (already filtered by genre in the route)
  if (preferences.likedMovies && Object.keys(preferences.likedMovies).length > 0) {
    // Get all liked movies from the filtered data
    const allLikedMovies = [];
    for (const genreMovies of Object.values(preferences.likedMovies)) {
      if (Array.isArray(genreMovies)) {
        allLikedMovies.push(...genreMovies);
      }
    }
    
    // Remove duplicates by tmdbId
    const uniqueLikedMovies = Array.from(
      new Map(allLikedMovies.map(m => [m.tmdbId, m])).values()
    );
    
    if (uniqueLikedMovies.length > 0) {
      const movieContext = preferences.genres?.length > 0 
        ? `my selected genres (${preferences.genres.join(', ')})` 
        : 'general preferences';
        
      prompt += `Liked movies in ${movieContext}: ${uniqueLikedMovies.map(m => 
        m.genres?.length > 0 
          ? `${m.title} (${m.genres.join(', ')})`
          : m.title
      ).join(', ')}\n`;
      
      // If no specific genres selected, analyze genre preferences
      if (!preferences.genres?.length > 0) {
        const likedGenres = analyzeGenrePreferences({ likedMovies: uniqueLikedMovies });
        if (likedGenres.length > 0) {
          prompt += `User tends to like these genres: ${likedGenres.slice(0, 5).map(g => g.genreId).join(', ')}`;
          if (likedGenres.length > 5) prompt += ` and ${likedGenres.length - 5} more`;
          prompt += '\n';
        }
      }
    }
  }
  
  // 3. Include information from disliked movies (already filtered by genre in the route)
  if (preferences.dislikedMovies && Object.keys(preferences.dislikedMovies).length > 0) {
    // Get all disliked movies from the filtered data
    const allDislikedMovies = [];
    for (const genreMovies of Object.values(preferences.dislikedMovies)) {
      if (Array.isArray(genreMovies)) {
        allDislikedMovies.push(...genreMovies);
      }
    }
    
    if (allDislikedMovies.length > 0) {
      const movieContext = preferences.genres?.length > 0 
        ? `my selected genres (${preferences.genres.join(', ')})` 
        : 'general preferences';
        
      prompt += `Disliked movies in ${movieContext}: ${allDislikedMovies.map(m => 
        m.genres?.length > 0 
          ? `${m.title} (${m.genres.join(', ')})`
          : m.title
      ).join(', ')}\n`;
      
      // If no specific genres selected, analyze genre preferences
      if (!preferences.genres?.length > 0) {
        const dislikedGenres = analyzeGenrePreferences({ likedMovies: allDislikedMovies });
        if (dislikedGenres.length > 0) {
          prompt += `User tends to dislike these genres: ${dislikedGenres.slice(0, 5).map(g => g.genreId).join(', ')}`;
          if (dislikedGenres.length > 5) prompt += ` and ${dislikedGenres.length - 5} more`;
          prompt += '\n';
        }
      }
    }
  }
  
  // 4. Include mood and social context from session
  if (preferences.moods?.length > 0) {
    prompt += `Current mood: ${preferences.moods.join(', ')}\n`;
  }
  
  if (preferences.socialContext) {
    prompt += `Watching context: ${preferences.socialContext}\n`;
  }
  
  // 5. Include deal breakers from session
  if (preferences.dealBreakers?.length > 0) {
    prompt += `Avoid: ${preferences.dealBreakers.join(', ')}\n`;
  }

  // 6. Exclude previously recommended movies
  if (preferences.previouslyRecommended) {
    prompt += `Do not recommend these previously suggested movies: ${preferences.previouslyRecommended}\n`;
  }
  
  // 7. Add specific emphasis on moods and social context
  if ((preferences.moods?.length > 0) || preferences.socialContext) {
    prompt += "\nImportant: ";
    if (preferences.moods?.length > 0) {
      if (preferences.moods.length === 1) {
        prompt += `The viewer is in a ${preferences.moods[0]} mood. `;
      } else {
        const lastMood = preferences.moods[preferences.moods.length - 1];
        const otherMoods = preferences.moods.slice(0, -1);
        prompt += `The viewer is in a ${otherMoods.join(', ')} and ${lastMood} mood. `;
      }
    }
    if (preferences.socialContext) {
      prompt += `They will be watching with ${preferences.socialContext}. `;
    }
    prompt += "Please consider this carefully in your recommendation.\n";
  }
  
  // 8. Final instructions
  prompt += "\nRecommend ONE movie with clear reasoning. ";
  
  if (preferences.genres?.length > 0) {
    prompt += `The recommendation should be from the selected genres (${preferences.genres.join(', ')}) and `;
    prompt += "should align with the liked movies and avoid the patterns of disliked movies from these specific genres. ";
  } else {
    prompt += "The recommendation should match their preferred genres and avoid movies that match the taste of their disliked movies. ";
  }
  
  prompt += "If the user has specified moods or social context, ensure the movie is appropriate for that context. ";
  prompt += "Return your response in valid JSON format with these fields: title, year, reason, genre, rating.";
    
  console.log('Generated recommendation prompt:', prompt);
  return prompt;
}

function buildBackupRecommendationPrompt(preferences) {
  return buildRecommendationPrompt(preferences) + " Provide 2-3 different alternatives.";
}

// Search for a movie in our database first
async function findMovieInDatabase(title, year) {
  try {
    let query = { title: new RegExp(title, 'i') }; // Case insensitive search
    if (year) {
      query.releaseDate = {
        $gte: new Date(`${year}-01-01`),
        $lte: new Date(`${year}-12-31`)
      };
    }
    return await Movie.findOne(query);
  } catch (error) {
    console.error('Error searching movie in database:', error);
    return null;
  }
}

// Save movie to our database
async function saveMovieToDatabase(movieData) {
  try {
    const movie = new Movie({
      tmdbId: movieData.tmdbId,
      title: movieData.title,
      overview: movieData.overview,
      releaseDate: movieData.releaseDate,
      genres: movieData.genres,
      rating: movieData.rating, // This will also set voteAverage due to alias
      posterPath: movieData.posterPath,
      backdropPath: movieData.backdropPath,
      runtime: movieData.runtime,
      director: movieData.director,
      cast: movieData.cast,
      popularity: movieData.popularity || 0,
      voteCount: movieData.voteCount || 0
    });
    await movie.save();
    return movie;
  } catch (error) {
    console.error('Error saving movie to database:', error);
    return null;
  }
}

async function searchMovieOnTMDB(title, year) {
  try {
    // First check our database
    const dbMovie = await findMovieInDatabase(title, year);
    if (dbMovie) {
      console.log(`Found movie in database: ${title}`);
      return dbMovie;
    }

    // If not in database, search TMDB
    const searchUrl = `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}`;
    const response = await axiosInstance.get(searchUrl, {
      retry: 3,
      retryDelay: 1000,
      timeout: 15000
    });
    
    if (!response.data.results || response.data.results.length === 0) {
      console.log(`No results found for movie: ${title}`);
      return null;
    }
    
    let movie = response.data.results[0];
    
    // If year provided, try to find exact match
    if (year && response.data.results.length > 1) {
      const exactMatch = response.data.results.find(m => 
        m.release_date && new Date(m.release_date).getFullYear() === parseInt(year)
      );
      if (exactMatch) movie = exactMatch;
    }
    
    if (!movie) return null;
    
    // Get detailed movie info
    const detailsUrl = `${TMDB_BASE_URL}/movie/${movie.id}?api_key=${TMDB_API_KEY}&append_to_response=credits`;
    const detailsResponse = await axiosInstance.get(detailsUrl, {
      retry: 3,
      retryDelay: 1000,
      timeout: 15000
    });
    const details = detailsResponse.data;
    
    const movieData = {
      tmdbId: details.id,
      title: details.title,
      overview: details.overview,
      releaseDate: details.release_date,
      genres: details.genres.map(g => g.name),
      rating: details.vote_average,
      posterPath: details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : null,
      backdropPath: details.backdrop_path ? `https://image.tmdb.org/t/p/w1280${details.backdrop_path}` : null,
      runtime: details.runtime,
      director: details.credits?.crew?.find(c => c.job === 'Director')?.name,
      cast: details.credits?.cast?.slice(0, 5).map(c => c.name) || [],
      popularity: details.popularity,
      voteCount: details.vote_count
      // year is now a virtual field calculated from releaseDate
    };

    // Save to our database for future queries
    await saveMovieToDatabase(movieData);
    
    return movieData;
  } catch (error) {
    console.error('Error searching movie on TMDB:', error);
    return null;
  }
}

module.exports = router;