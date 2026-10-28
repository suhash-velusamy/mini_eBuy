const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        'OUTBID',
        'ENDING_SOON',
        'PROVISIONAL_WIN',
        'SELLER_APPROVAL_REQUIRED',
        'SELLER_APPROVED',
        'SELLER_REJECTED',
        'AUCTION_UNSOLD',
        'ITEM_RESERVED',
        'SALE_COMPLETED',
        'LISTING_CANCELLED',
        'FAILED_PICKUP',
      ],
      index: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    auction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      required: true,
    },
    readAt: {
      type: Date,
      default: null,
      index: true,
    },
    deduplicationKey: {
      type: String,
      sparse: true,
      unique: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
