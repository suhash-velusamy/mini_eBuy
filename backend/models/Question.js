const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema(
  {
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      required: true,
      index: true,
    },
    asker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      minlength: [10, 'Question must be at least 10 characters.'],
      maxlength: [300, 'Question cannot exceed 300 characters.'],
    },
    answer: {
      type: String,
      trim: true,
      default: null,
      maxlength: [600, 'Answer cannot exceed 600 characters.'],
    },
    answeredAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['visible', 'hidden', 'flagged'],
      default: 'visible',
      index: true,
    },
    normalizedText: {
      type: String,
      required: true,
      index: true,
    },
    helpfulCount: {
      type: Number,
      default: 0,
    },
    flagCount: {
      type: Number,
      default: 0,
    },
    flaggedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound index for user question limit check and sorting
questionSchema.index({ item: 1, asker: 1 });
questionSchema.index({ item: 1, status: 1, answeredAt: -1, createdAt: -1 });

module.exports = mongoose.model('Question', questionSchema);

