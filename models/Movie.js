const mongoose = require('mongoose');

const movieSchema = new mongoose.Schema({
  tmdbId: { type: Number, required: true, unique: true },
  title: { type: String, required: true },
  overview: String,
  releaseDate: Date,
  year: { 
    type: Number,
    get: function() {
      return this.releaseDate ? new Date(this.releaseDate).getFullYear() : null;
    }
  },
  genres: [String],
  rating: { 
    type: Number,
    alias: 'voteAverage' // This allows us to use both names
  },
  posterPath: String,
  backdropPath: String,
  runtime: Number,
  director: String,
  cast: [String],
}, {
  timestamps: true
});

movieSchema.index({ genres: 1 });
movieSchema.index({ rating: -1 });

module.exports = mongoose.model('Movie', movieSchema);