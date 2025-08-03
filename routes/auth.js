const express = require('express');
const jwt = require('jsonwebtoken');
const { client } = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

router.post('/google', async (req, res) => {
  try {
    const { token } = req.body;
    
    const ticket = await client.verifyIdToken({
      idToken: token,
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
          genres: [],
          likedMovies: [],
          dislikedMovies: [],
          dealBreakers: []
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
    res.status(401).json({ error: 'Invalid Google token' });
  }
});

module.exports = router;