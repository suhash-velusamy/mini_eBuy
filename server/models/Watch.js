const mongoose = require('mongoose');

const watchSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    keywords: {
      type: [String],
      required: true,
      validate: {
        validator: function (v) {
          return Array.isArray(v) && v.length > 0 && v.some((k) => k && k.trim().length > 0);
        },
        message: 'At least one keyword is required',
      },
    },
    category: {
      type: String,
      trim: true,
      default: null,
    },
    condition: {
      type: String,
      enum: ['New', 'Like New', 'Good', 'Fair', 'Poor', null],
      default: null,
    },
    maxPrice: {
      type: Number, // integer paise
      min: 0,
      default: null,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastMatchedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

watchSchema.virtual('maxPriceINR').get(function () {
  return this.maxPrice ? this.maxPrice / 100 : null;
});

// Index to quickly fetch user watches
watchSchema.index({ user: 1, active: 1 });

module.exports = mongoose.model('Watch', watchSchema);
