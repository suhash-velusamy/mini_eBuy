const mongoose = require('mongoose');

const autoBidSchema = new mongoose.Schema(
  {
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    maxAmount: {
      type: Number,
      required: [true, 'Maximum bid amount is required'],
      min: [100, 'Maximum bid must be at least ₹1 (100 paise)'],
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual to convert paise to INR
autoBidSchema.virtual('maxAmountINR').get(function () {
  return this.maxAmount ? this.maxAmount / 100 : 0;
});

// One active AutoBid per (user, item)
autoBidSchema.index({ item: 1, user: 1 }, { unique: true });
autoBidSchema.index({ item: 1, active: 1, maxAmount: -1, createdAt: 1 });

module.exports = mongoose.model('AutoBid', autoBidSchema);
