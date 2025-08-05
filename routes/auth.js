const express = require('express');
const jwt = require('jsonwebtoken');
const { client } = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

router.post('/google', async (req, res) => {
  try {
    console.log('Google auth request received');
    console.log('Request body keys:', Object.keys(req.body || {}));
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    const { token, credential } = req.body;
    console.log('Extracted token:', token ? 'Present' : 'Missing');
    console.log('Extracted credential:', credential ? 'Present' : 'Missing');
    
    const idToken = token || credential; // Handle both formats
    
    if (!idToken) {
      console.error('No token found in request body:', req.body);
      return res.status(400).json({ error: 'No token provided' });
    }
    
    console.log('Using token for verification:', idToken.substring(0, 50) + '...');
    
    const ticket = await client.verifyIdToken({
      idToken: idToken,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    let user = await User.findOne({ googleId });
    
    if (!user) {
      user = new User({
        googleId,
        email,
        name,
        profilePicture: picture,
        preferences: {
          likedMovies: new Map(),
          dislikedMovies: new Map()
        }
      });
      await user.save();
    }

    const jwtToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token: jwtToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture
      }
    });
  } catch (error) {
    console.error('Google auth error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      requestBody: req.body
    });
    res.status(401).json({ 
      error: 'Invalid Google token',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;