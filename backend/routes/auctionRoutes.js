const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const {
  getAuctions,
  createAuction,
  getAuctionById,
  updateAuction,
  cancelAuction,
  getAuctionBids,
  placeBid,
  approveBid,
  rejectBid,
  confirmHandover,
  recordFailedPickup,
} = require('../controllers/auctionController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Rate limiter for bidding to prevent automated spam/abuse
const bidLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // Max 60 bids per minute per IP
  message: {
    success: false,
    message: 'Too many bidding requests. Please slow down and try again shortly.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public routes
router.get('/', getAuctions);
router.get('/:id', getAuctionById);
router.get('/:id/bids', getAuctionBids);

// Protected routes
router.post('/', protect, upload.array('photos', 5), createAuction);
router.patch('/:id', protect, updateAuction);
router.post('/:id/cancel', protect, cancelAuction);
router.post('/:id/bids', protect, bidLimiter, placeBid);

// Seller action routes
router.post('/:id/approve', protect, approveBid);
router.post('/:id/reject', protect, rejectBid);
router.post('/:id/confirm-handover', protect, confirmHandover);
router.post('/:id/failed-pickup', protect, recordFailedPickup);

module.exports = router;
