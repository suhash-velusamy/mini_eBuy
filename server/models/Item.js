const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Item title is required'],
      trim: true,
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [3000, 'Description cannot exceed 3000 characters'],
    },
    condition: {
      type: String,
      required: [true, 'Condition is required'],
      enum: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
      index: true,
    },
    photos: {
      type: [String],
      validate: {
        validator: function (val) {
          return Array.isArray(val) && val.length > 0;
        },
        message: 'At least one photo is required',
      },
    },
    // Stored as integer paise (1 INR = 100 paise)
    startingPrice: {
      type: Number,
      required: [true, 'Starting price is required'],
      min: [100, 'Starting price must be at least ₹1 (100 paise)'],
    },
    minimumIncrement: {
      type: Number,
      required: [true, 'Minimum increment is required'],
      min: [100, 'Minimum increment must be at least ₹1 (100 paise)'],
      default: 5000, // ₹50 default
    },
    currentLeadingBid: {
      type: Number,
      default: null,
    },
    currentLeadingBidder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    bidCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    closingAt: {
      type: Date,
      required: [true, 'Closing date and time is required'],
      index: true,
    },
    status: {
      type: String,
      enum: [
        'Active',
        'Pending Approval',
        'Reserved',
        'Sold',
        'Unsold',
        'Cancelled',
        'Rejected',
        'Failed Pickup',
      ],
      default: 'Active',
      index: true,
    },
    provisionalWinner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    winningAmount: {
      type: Number,
      default: null,
    },
    sellerDecision: {
      decision: { type: String, enum: ['Approved', 'Rejected', null], default: null },
      decidedAt: { type: Date, default: null },
      reason: { type: String, default: '' },
    },
    reservedAt: {
      type: Date,
      default: null,
    },
    soldAt: {
      type: Date,
      default: null,
    },
    cancellationReason: {
      type: String,
      default: '',
    },
    outcomeReason: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtuals to convert paise into INR for easy frontend consumption
itemSchema.virtual('startingPriceINR').get(function () {
  return this.startingPrice ? this.startingPrice / 100 : 0;
});

itemSchema.virtual('minimumIncrementINR').get(function () {
  return this.minimumIncrement ? this.minimumIncrement / 100 : 0;
});

itemSchema.virtual('currentLeadingBidINR').get(function () {
  return this.currentLeadingBid ? this.currentLeadingBid / 100 : null;
});

itemSchema.virtual('winningAmountINR').get(function () {
  return this.winningAmount ? this.winningAmount / 100 : null;
});

// Minimum next valid bid in paise
itemSchema.virtual('minNextBid').get(function () {
  if (!this.currentLeadingBid) {
    return this.startingPrice;
  }
  return this.currentLeadingBid + this.minimumIncrement;
});

itemSchema.virtual('minNextBidINR').get(function () {
  return this.minNextBid / 100;
});

// Indexes for search and query performance
itemSchema.index({ title: 'text', description: 'text' });
itemSchema.index({ status: 1, closingAt: 1 });
itemSchema.index({ status: 1, createdAt: -1 });
itemSchema.index({ seller: 1, createdAt: -1 });

module.exports = mongoose.model('Item', itemSchema);
