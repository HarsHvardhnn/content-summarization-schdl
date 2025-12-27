const mongoose = require('mongoose');

const contentSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['text', 'url'],
    required: true,
    index: true
  },
  input: {
    type: String,
    required: true
  },
  extractedContent: {
    type: String
  },
  summary: {
    type: String
  },
  status: {
    type: String,
    enum: ['pending', 'failed', 'completed'],
    default: 'pending',
    required: true,
    index: true
  },
  deletedAt: {
    type: Date,
    default: null,
    index: true
  }
}, {
  timestamps: true,
  collection: 'contents'
});

contentSchema.index({ createdAt: -1 });
contentSchema.index({ updatedAt: -1 });
contentSchema.index({ type: 1, createdAt: -1 });
contentSchema.index({ status: 1, createdAt: -1 });

const Content = mongoose.model('Content', contentSchema);

module.exports = Content;


