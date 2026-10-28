const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const {
  getCategories,
  getAuctionStats,
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
  setAutoBid,
  getAutoBids,
  deleteAutoBid,
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

// Dynamic Public Metadata routes (must be before /:id)
router.get('/categories', getCategories);
router.get('/stats', getAuctionStats);

// Public auction routes
router.get('/', getAuctions);
router.get('/:id', getAuctionById);
router.get('/:id/bids', getAuctionBids);

// Protected routes
router.post('/', protect, upload.array('photos', 5), createAuction);
router.patch('/:id', protect, updateAuction);
router.post('/:id/cancel', protect, cancelAuction);
router.post('/:id/bids', protect, bidLimiter, placeBid);

// Phase 2 Automatic Proxy Bidding routes
router.put('/:id/auto-bid', protect, bidLimiter, setAutoBid);
router.get('/:id/auto-bids', getAutoBids);
router.delete('/:id/auto-bid', protect, deleteAutoBid);

// Seller action routes
router.post('/:id/approve', protect, approveBid);
router.post('/:id/reject', protect, rejectBid);
router.post('/:id/confirm-handover', protect, confirmHandover);
router.post('/:id/failed-pickup', protect, recordFailedPickup);
router.post('/:id/handover', protect, (req, res) => {
  if (req.body.result === 'failed_pickup') {
    return recordFailedPickup(req, res);
  }
  return confirmHandover(req, res);
});

module.exports = router;
