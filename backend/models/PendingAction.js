const mongoose = require('mongoose');

const pendingActionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      required: true,
      index: true,
    },
    maxAmount: {
      type: Number, // integer paise
      required: true,
      min: 100,
    },
    type: {
      type: String,
      enum: ['auto_bid'],
      default: 'auto_bid',
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'expired'],
      default: 'pending',
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

pendingActionSchema.virtual('maxAmountINR').get(function () {
  return this.maxAmount / 100;
});

module.exports = mongoose.model('PendingAction', pendingActionSchema);

