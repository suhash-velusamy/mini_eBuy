const mongoose = require('mongoose');

const bidSchema = new mongoose.Schema(
  {
    auction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      required: true,
      index: true,
    },
    bidder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 100, // paise
    },
    idempotencyKey: {
      type: String,
      sparse: true,
      index: true,
    },
    extendedClosing: {
      type: Boolean,
      default: false,
    },
    isAutomatic: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

bidSchema.virtual('amountINR').get(function () {
  return this.amount / 100;
});

// Index to quickly fetch bids for an auction ordered by time descending
bidSchema.index({ auction: 1, createdAt: -1 });
bidSchema.index({ bidder: 1, createdAt: -1 });

module.exports = mongoose.model('Bid', bidSchema);
