# 🐛 Debug Recommendation 404 Error

## Quick Fix for Production

The 404 error "Could not find a new movie recommendation" suggests the `generateMovieRecommendation` function is returning `null`. Here's how to debug and fix it:

### Step 1: Add Debug Logging (On AWS EC2)

```bash
# SSH into your EC2 instance
ssh -i your-key.pem ubuntu@your-ec2-public-ip

# Navigate to your server directory
cd /home/ubuntu/cinemahint-server

# Add debug logging to the recommendation endpoint
# Create a temporary patch file
cat > debug_patch.js << 'EOF'
// Add this debug logging to your recommendation endpoint
console.log('=== RECOMMENDATION DEBUG ===');
console.log('User ID:', user._id);
console.log('Request body:', req.body);
console.log('User preferences:', {
  likedMovies: user.preferences?.likedMovies,
  dislikedMovies: user.preferences?.dislikedMovies,
  recommendationHistory: user.recommendationHistory?.length || 0
});
console.log('OpenAI API Key exists:', !!process.env.OPENAI_API_KEY);
console.log('TMDB API Key exists:', !!process.env.TMDB_API_KEY);
EOF
```


### Step 2: Check Environment Variables

```bash
# Check if API keys are set
docker-compose exec app env | grep -E "(OPENAI_API_KEY|TMDB_API_KEY|MONGODB_URI)"

# If keys are missing, update .env file
nano .env

# Restart app container
docker-compose restart app
```

### Step 3: Check Logs

```bash
# View app logs in real-time
docker-compose logs -f app

# Try the recommendation again from frontend
# Check logs for debug output
```

### Step 4: Common Fixes

#### Fix 1: Missing/Invalid API Keys
```env
# In .env file, make sure these are set:
OPENAI_API_KEY=sk-your-actual-openai-key
TMDB_API_KEY=your-actual-tmdb-key
```

#### Fix 2: OpenAI Rate Limiting
```javascript
// In routes/movies.js, add retry logic for OpenAI
const completion = await openai.chat.completions.create({
  model: "gpt-3.5-turbo",
  messages: [...],
  max_tokens: 500,
  temperature: 0.7,
}, {
  timeout: 30000,  // 30 second timeout
  maxRetries: 3    // Retry 3 times
});
```

#### Fix 3: User Preferences Missing
```bash
# Check if user has preferences in MongoDB
# Connect to your MongoDB Atlas and run:
db.users.findOne({email: "your-test-email"}, {preferences: 1, recommendationHistory: 1})

# If preferences are empty, user needs to go through preference setup first
```

#### Fix 4: TMDB API Issues
```javascript
// Add TMDB fallback in generateMovieRecommendation function
try {
  // Try to get movie details from TMDB to validate recommendation
  const tmdbUrl = `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(movieData.title)}`;
  const tmdbResponse = await tmdbRequest(tmdbUrl);
  
  if (!tmdbResponse.results || tmdbResponse.results.length === 0) {
    console.log('Movie not found in TMDB, trying alternative...');
    continue; // Try next attempt
  }
} catch (tmdbError) {
  console.error('TMDB API Error:', tmdbError);
  continue; // Try next attempt
}
```

### Step 5: Quick Test Fix

```javascript
// Temporary fix: Add a fallback recommendation
if (!recommendation) {
  console.log('No recommendation generated, using fallback');
  
  // Return a popular movie as fallback
  const fallbackRecommendation = {
    title: "The Dark Knight",
    year: 2008,
    reason: "A critically acclaimed superhero film with excellent storytelling and performances.",
    genre: ["Action", "Crime", "Drama"],
    rating: 9.0,
    tmdbId: 155,
    poster_path: "/qJ2tW6WMUDux911r6m7haRef0WH.jpg"
  };
  
  return res.json(fallbackRecommendation);
}
```

### Step 6: Apply the Fix

```bash
# Edit the movies.js file with debugging
nano routes/movies.js

# Add console.log statements around lines 310-325:

console.log('=== RECOMMENDATION DEBUG START ===');
console.log('User ID:', user._id);
console.log('Preferences:', preferences);
console.log('OpenAI Key exists:', !!process.env.OPENAI_API_KEY);

const recommendation = await generateMovieRecommendation(user, preferences);

console.log('Generated recommendation:', recommendation);
console.log('=== RECOMMENDATION DEBUG END ===');

if (!recommendation) {
  console.log('CRITICAL: No recommendation generated!');
  return res.status(404).json({ 
    error: 'Could not find a new movie recommendation. Try adjusting your preferences or try again later.'
  });
}

# Save and restart
docker-compose restart app

# Test again and check logs
docker-compose logs -f app
```

### Step 7: Most Likely Solutions

1. **Missing OpenAI API Key**: Check your .env file
2. **OpenAI API Quota Exceeded**: Check your OpenAI dashboard
3. **User has no preferences**: User needs to complete preference setup
4. **TMDB API Rate Limiting**: Add delay between requests
5. **Database connection issues**: Check MongoDB Atlas connection

### Quick Debug Commands

```bash
# Check if recommendation endpoint is accessible
curl -X POST https://cinemahint.adilhusain.me/api/movies/recommend \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{"genres":["Action"],"moods":["Exciting"],"socialContext":"alone"}'

# Check health endpoint
curl https://cinemahint.adilhusain.me/api/health

# Check app logs for errors
docker-compose logs --tail=50 app | grep -i error
```

Try these debugging steps and let me know what the logs show!